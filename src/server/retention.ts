import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getMailer } from "./email/mailer";
import { sendPendingDistressEmails } from "./distress/report";
import { env } from "./env";

const DAY = 86_400_000;

/** Refreshes the signed-in parent's last_active_at (at most hourly) and clears any retention warning. Never throws. */
export async function touchActivity(db: SupabaseClient): Promise<void> {
  try {
    const { error } = await db.rpc("touch_activity");
    if (error) console.error("touch_activity failed", error.message);
  } catch (e) {
    console.error("touch_activity failed", e instanceof Error ? e.message : e);
  }
}

/** Deletes the account atomically, only if it is still warned (warning sent) and inactive; false if the parent came back. */
export async function deleteIfStillInactive(db: SupabaseClient, id: string, warnedBefore: string, inactiveBefore: string): Promise<boolean> {
  const { data, error } = await db.rpc("retention_delete", { p_parent: id, p_warned_before: warnedBefore, p_inactive_before: inactiveBefore });
  if (error) throw new Error(error.message);
  return data === true;
}

/** Calls `fn` on each page of matching parent ids. Keyset paging by id, so rows changed by `fn` do not shift the pages. */
async function eachPage(
  query: (after: string | null, size: number) => PromiseLike<{ data: { id: string }[] | null; error: { message: string } | null }>,
  size: number,
  fn: (ids: string[]) => Promise<void>,
): Promise<void> {
  let after: string | null = null;
  for (;;) {
    const { data, error } = await query(after, size);
    if (error) throw new Error(error.message);
    const ids = (data ?? []).map((r) => r.id);
    if (ids.length) await fn(ids);
    if (ids.length < size) return;
    after = ids[ids.length - 1]!;
  }
}

/**
 * Spec §8: 12 months inactive, then a warning, then deletion 30 days later unless the parent became active again.
 * The warning is claimed (retention_warned_at set where still null) before the email, so repeated or overlapping
 * runs warn once; a failed send releases the claim for the next run. Unsent distress emails get a last attempt
 * before flags older than 30 days are purged. Each phase runs even if an earlier one failed; failures are logged.
 */
export async function runRetention(
  now: Date,
  pageSize = 500,
): Promise<{ warned: number; deleted: number; purgedFlags: number; distressSent: number }> {
  const db = createClient(env.supabaseUrl(), env.supabaseSecretKey(), { auth: { persistSession: false, autoRefreshToken: false } });
  const nowIso = now.toISOString();
  const inactiveBefore = new Date(now.getTime() - 365 * DAY).toISOString();
  // Never warned, or claimed over a day ago and not sent for that claim (the run died or the release failed): claimable.
  // retention_warn_unsent (generated, 0008) also treats a sent time older than the claim as unsent.
  const unwarned = `retention_warned_at.is.null,and(retention_warn_unsent.is.true,retention_warned_at.lte.${new Date(now.getTime() - DAY).toISOString()})`;
  const warnedBefore = new Date(now.getTime() - 30 * DAY).toISOString();

  let warned = 0;
  await phase("warn", () => eachPage(
    (after, size) => {
      let q = db.from("parents").select("id").lte("last_active_at", inactiveBefore).or(unwarned).order("id").limit(size);
      if (after) q = q.gt("id", after);
      return q;
    },
    pageSize,
    async (ids) => {
      for (const id of ids) {
        // The claim also clears any sent time left from an earlier cycle, so it cannot vouch for this one.
        const claim = await db.from("parents").update({ retention_warned_at: nowIso, retention_warn_sent_at: null })
          .eq("id", id).or(unwarned).lte("last_active_at", inactiveBefore).select("id");
        if (claim.error) throw claim.error;
        if (!claim.data.length) continue;
        try {
          const { data: user, error: ue } = await db.auth.admin.getUserById(id);
          const to = user?.user?.email;
          if (ue || !to) throw ue ?? new Error("parent has no email");
          const link = `${env.appOrigin()}/sign-in`;
          await getMailer().send({
            to,
            subject: "Your Brightling AI account will be deleted in 30 days",
            text: `Your Brightling AI account has been inactive for a year, so we will delete it, and your children's progress, in 30 days.\n\nTo keep it, just sign in: ${link}\n\nSigning in keeps your account.`,
            html: `<p>Your Brightling AI account has been inactive for a year, so we will delete it, and your children's progress, in 30 days.</p><p>To keep it, just <a href="${link}">sign in</a>. Signing in keeps your account.</p>`,
          });
          // Only for this claim: if the parent signed in meanwhile (claim cleared), nothing is recorded.
          const sent = await db.from("parents").update({ retention_warn_sent_at: new Date().toISOString() })
            .eq("id", id).eq("retention_warned_at", nowIso);
          if (sent.error) console.error("retention warn_sent_at not recorded", id, sent.error.message);
          warned++;
        } catch (e) {
          const release = await db.from("parents").update({ retention_warned_at: null }).eq("id", id).eq("retention_warned_at", nowIso);
          if (release.error) console.error("retention claim release failed", id, release.error.message);
          console.error("retention warning failed", id, e instanceof Error ? e.message : e);
        }
      }
    },
  ));

  let deleted = 0;
  await phase("delete", () => eachPage(
    (after, size) => {
      let q = db.from("parents").select("id").lte("retention_warned_at", warnedBefore).eq("retention_warn_unsent", false).lte("last_active_at", inactiveBefore).order("id").limit(size);
      if (after) q = q.gt("id", after);
      return q;
    },
    pageSize,
    async (ids) => {
      for (const id of ids) {
        try {
          if (await deleteIfStillInactive(db, id, warnedBefore, inactiveBefore)) {
            deleted++;
            console.info("retention deleted account", id);
          }
        } catch (e) {
          console.error("retention delete failed", id, e instanceof Error ? e.message : e);
        }
      }
    },
  ));

  let distressSent = 0;
  await phase("distress retry", async () => {
    distressSent = (await sendPendingDistressEmails()).sent;
  });
  let purgedFlags = 0;
  await phase("distress purge", async () => {
    const purge = await db.from("distress_flags").delete().lt("at", warnedBefore).select("id");
    if (purge.error) throw purge.error;
    purgedFlags = purge.data.length;
  });

  return { warned, deleted, purgedFlags, distressSent };
}

/** Runs one retention phase; a failure is logged and does not stop the later phases (the next run retries). */
async function phase(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    console.error(`retention ${name} phase failed`, e instanceof Error ? e.message : e);
  }
}
