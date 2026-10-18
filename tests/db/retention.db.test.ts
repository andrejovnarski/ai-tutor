import { describe, it, expect, vi } from "vitest";
import { admin, makeParent, latestEmailTo, mailCountTo } from "../helpers/admin";

vi.mock("server-only", () => ({}));
// onSend runs just before a mail goes out, e.g. to simulate a parent signing in mid-run.
const hook = vi.hoisted(() => ({ onSend: null as null | ((to: string) => Promise<void>) }));
vi.mock("../../src/server/email/mailer", async (orig) => {
  const real = await orig<typeof import("../../src/server/email/mailer")>();
  return {
    ...real,
    getMailer: () => ({
      send: async (m: Parameters<ReturnType<typeof real.getMailer>["send"]>[0]) => {
        if (hook.onSend) await hook.onSend(m.to);
        return real.getMailer().send(m);
      },
    }),
  };
});
const distress = vi.hoisted(() => ({ fail: false }));
vi.mock("../../src/server/distress/report", async (orig) => {
  const real = await orig<typeof import("../../src/server/distress/report")>();
  return {
    ...real,
    sendPendingDistressEmails: async () => {
      if (distress.fail) throw new Error("distress retry down");
      return real.sendPendingDistressEmails();
    },
  };
});
const { runRetention, deleteIfStillInactive } = await import("../../src/server/retention");
const { GET } = await import("../../src/app/api/cron/retention/route");

const run = Date.now();
const DAY = 86_400_000;
const NOW = new Date();
const ago = (d: number) => new Date(NOW.getTime() - d * DAY).toISOString();
const emailOf = (n: string) => `ret-${n}-${run}@test.dev`;
const SUBJECT = "Your Brightling AI account will be deleted in 30 days";

async function setRow(id: string, patch: Record<string, unknown>) {
  const { error } = await admin().from("parents").update(patch).eq("id", id);
  expect(error).toBeNull();
}
const row = async (id: string) => (await admin().from("parents").select("*").eq("id", id).maybeSingle()).data;
async function seedKid(parentId: string) {
  const { data, error } = await admin().from("kids")
    .insert({ parent_id: parentId, nickname: "Kit", grade: "K", age_band: "5-7", avatar: "fox" }).select().single();
  expect(error).toBeNull();
  return data.id as string;
}

describe("retention", () => {
  it("warns an inactive parent once, with a sign-in link", async () => {
    const p = await makeParent(emailOf("w"), { consent: true });
    await setRow(p.userId, { last_active_at: ago(366) });
    const first = await runRetention(NOW);
    expect(first.warned).toBeGreaterThanOrEqual(1);
    expect((await row(p.userId))!.retention_warned_at).not.toBeNull();
    const mail = await latestEmailTo(emailOf("w"));
    expect(mail.Subject).toBe(SUBJECT);
    expect(mail.Text).toContain(`${process.env.APP_ORIGIN}/sign-in`);
    expect(mail.Text.toLowerCase()).toContain("signing in");
    expect(await mailCountTo(emailOf("w"), `subject:"${SUBJECT}"`)).toBe(1);

    await runRetention(NOW);
    expect(await mailCountTo(emailOf("w"), `subject:"${SUBJECT}"`)).toBe(1);
  });

  it("does not warn an active or recently active parent", async () => {
    const p = await makeParent(emailOf("act"), { consent: true });
    await setRow(p.userId, { last_active_at: ago(364) });
    await runRetention(NOW);
    expect((await row(p.userId))!.retention_warned_at).toBeNull();
    expect(await mailCountTo(emailOf("act"), `subject:"${SUBJECT}"`)).toBe(0);
  });

  it("deletes a parent warned 31 days ago who is still inactive, with their kids", async () => {
    const p = await makeParent(emailOf("d"), { consent: true });
    const kid = await seedKid(p.userId);
    await setRow(p.userId, { last_active_at: ago(400), retention_warned_at: ago(31), retention_warn_sent_at: ago(31) });
    const r = await runRetention(NOW);
    expect(r.deleted).toBeGreaterThanOrEqual(1);
    expect(await row(p.userId)).toBeNull();
    expect((await admin().auth.admin.getUserById(p.userId)).data.user).toBeNull();
    expect((await admin().from("kids").select("id").eq("id", kid)).data).toHaveLength(0);
  });

  it("never deletes a parent whose warning was claimed but not sent", async () => {
    const p = await makeParent(emailOf("ns"), { consent: true });
    await setRow(p.userId, { last_active_at: ago(400), retention_warned_at: ago(31) });
    const r = await runRetention(NOW);
    expect(await row(p.userId)).not.toBeNull(); // not deleted: it is re-claimed and warned instead
    expect(r.warned).toBeGreaterThanOrEqual(1);
    expect(await mailCountTo(emailOf("ns"), `subject:"${SUBJECT}"`)).toBe(1);
    expect((await row(p.userId))!.retention_warn_sent_at).not.toBeNull();
  });

  it("a sent time older than the current claim does not count: no deletion, the parent is warned again", async () => {
    // Left over from an earlier cycle (a sign-in raced the sent_at write); the new claim's send never happened.
    const p = await makeParent(emailOf("ss"), { consent: true });
    await setRow(p.userId, { last_active_at: ago(800), retention_warned_at: ago(31), retention_warn_sent_at: ago(400) });
    expect(await deleteIfStillInactive(admin(), p.userId, ago(30), ago(365))).toBe(false);
    const r = await runRetention(NOW);
    expect(await row(p.userId)).not.toBeNull();
    expect(r.warned).toBeGreaterThanOrEqual(1);
    expect(await mailCountTo(emailOf("ss"), `subject:"${SUBJECT}"`)).toBe(1);
    const after = (await row(p.userId))!;
    expect(new Date(after.retention_warned_at).getTime()).toBeGreaterThanOrEqual(NOW.getTime() - 1000);
    expect(new Date(after.retention_warn_sent_at).getTime()).toBeGreaterThanOrEqual(new Date(after.retention_warned_at).getTime());
  });

  it("a sign-in between the claim and the sent_at write leaves no sent time behind", async () => {
    const p = await makeParent(emailOf("rc"), { consent: true });
    await setRow(p.userId, { last_active_at: ago(400) });
    hook.onSend = async (to) => {
      if (to === emailOf("rc")) expect((await p.client.rpc("touch_activity")).error).toBeNull();
    };
    try {
      await runRetention(NOW);
    } finally {
      hook.onSend = null;
    }
    const after = (await row(p.userId))!;
    expect(after.retention_warned_at).toBeNull();
    expect(after.retention_warn_sent_at).toBeNull();
  });

  it("a new claim clears a leftover sent time", async () => {
    const p = await makeParent(emailOf("cl"), { consent: true });
    await setRow(p.userId, { last_active_at: ago(400), retention_warn_sent_at: ago(300) });
    let atSend: unknown = "not called";
    hook.onSend = async (to) => {
      if (to !== emailOf("cl")) return;
      atSend = (await row(p.userId))!.retention_warn_sent_at; // claimed, not yet sent
      throw new Error("mail down"); // the run dies before the send
    };
    try {
      await runRetention(NOW);
    } finally {
      hook.onSend = null;
    }
    expect(atSend).toBeNull();
  });

  it("retries a stale claim with no sent time, but not a fresh one", async () => {
    const stale = await makeParent(emailOf("st"), { consent: true });
    const fresh = await makeParent(emailOf("fr"), { consent: true });
    await setRow(stale.userId, { last_active_at: ago(400), retention_warned_at: ago(2) });
    await setRow(fresh.userId, { last_active_at: ago(400), retention_warned_at: new Date(NOW.getTime() - 3_600_000).toISOString() });
    await runRetention(NOW);
    expect(await mailCountTo(emailOf("st"), `subject:"${SUBJECT}"`)).toBe(1);
    expect(await mailCountTo(emailOf("fr"), `subject:"${SUBJECT}"`)).toBe(0);
  });

  it("does not delete a stale candidate who touched activity after the list was built", async () => {
    const p = await makeParent(emailOf("race"), { consent: true });
    await setRow(p.userId, { last_active_at: ago(400), retention_warned_at: ago(31), retention_warn_sent_at: ago(31) });
    await p.client.rpc("touch_activity");
    const before = ago(30), inactive = ago(365);
    expect(await deleteIfStillInactive(admin(), p.userId, before, inactive)).toBe(false);
    expect(await row(p.userId)).not.toBeNull();
  });

  it("keeps a parent warned only 10 days ago", async () => {
    const p = await makeParent(emailOf("k"), { consent: true });
    await setRow(p.userId, { last_active_at: ago(400), retention_warned_at: ago(10) });
    await runRetention(NOW);
    expect(await row(p.userId)).not.toBeNull();
  });

  it("a warned parent who touches activity is cleared and survives the next run", async () => {
    const p = await makeParent(emailOf("t"), { consent: true });
    await setRow(p.userId, { last_active_at: ago(400), retention_warned_at: ago(31), retention_warn_sent_at: ago(31) });
    const { error } = await p.client.rpc("touch_activity");
    expect(error).toBeNull();
    expect((await row(p.userId))!.retention_warned_at).toBeNull();
    await runRetention(NOW);
    expect(await row(p.userId)).not.toBeNull();
  });

  it("touch_activity changes last_active_at only once within an hour", async () => {
    const p = await makeParent(emailOf("o"), { consent: true });
    await setRow(p.userId, { last_active_at: ago(5) });
    await p.client.rpc("touch_activity");
    const first = (await row(p.userId))!.last_active_at;
    expect(new Date(first).getTime()).toBeGreaterThan(NOW.getTime() - 60_000);
    await new Promise((r) => setTimeout(r, 50));
    await p.client.rpc("touch_activity");
    expect((await row(p.userId))!.last_active_at).toBe(first);
  });

  it("touch_activity is not callable by anon", async () => {
    const { anon } = await import("../helpers/admin");
    const { error } = await anon().rpc("touch_activity");
    expect(error).not.toBeNull();
  });

  it("purges distress flags older than 30 days and keeps newer ones", async () => {
    const p = await makeParent(emailOf("f"), { consent: true });
    const kid = await seedKid(p.userId);
    const mk = (d: number) => ({ kid_id: kid, line: `x${d}`, at: ago(d), emailed_at: ago(d) });
    const { error } = await admin().from("distress_flags").insert([mk(31), mk(29)]);
    expect(error).toBeNull();
    const r = await runRetention(NOW);
    expect(r.purgedFlags).toBeGreaterThanOrEqual(1);
    const left = (await admin().from("distress_flags").select("line").eq("kid_id", kid)).data!.map((f) => f.line);
    expect(left).toEqual(["x29"]);
  });

  it("a failing phase does not stop the others; the counts are still returned", async () => {
    const p = await makeParent(emailOf("ph"), { consent: true });
    const kid = await seedKid(p.userId);
    const { error } = await admin().from("distress_flags").insert({ kid_id: kid, line: "old", at: ago(40), emailed_at: ago(40) });
    expect(error).toBeNull();
    await setRow(p.userId, { last_active_at: ago(400) });
    distress.fail = true;
    try {
      const r = await runRetention(NOW);
      expect(r).toMatchObject({ distressSent: 0 });
      expect(r.warned).toBeGreaterThanOrEqual(1);
      expect(r.purgedFlags).toBeGreaterThanOrEqual(1);
    } finally {
      distress.fail = false;
    }
    expect((await admin().from("distress_flags").select("id").eq("kid_id", kid)).data).toHaveLength(0);
  });

  it("emails an unsent distress flag before purging, and pages parents", async () => {
    const p = await makeParent(emailOf("u"), { consent: true });
    const kid = await seedKid(p.userId);
    const { error } = await admin().from("distress_flags").insert({ kid_id: kid, line: "retry me", at: ago(2) });
    expect(error).toBeNull();
    const q = await makeParent(emailOf("pg"), { consent: true });
    await setRow(q.userId, { last_active_at: ago(500) });
    const r = await runRetention(NOW, 1);
    expect(r.distressSent).toBeGreaterThanOrEqual(1);
    expect((await latestEmailTo(emailOf("u"))).Text).toContain("retry me");
    expect((await row(q.userId))!.retention_warned_at).not.toBeNull();
  });
});

describe("retention route", () => {
  const auth = { authorization: `Bearer ${process.env.CRON_SECRET}` };
  it("a wrong or missing token returns 401 and changes nothing", async () => {
    const p = await makeParent(emailOf("r"), { consent: true });
    await setRow(p.userId, { last_active_at: ago(400) });
    for (const headers of [{} as Record<string, string>, { authorization: "Bearer nope" }]) {
      const res = await GET(new Request("http://x/api/cron/retention", { headers }));
      expect(res.status).toBe(401);
    }
    expect((await row(p.userId))!.retention_warned_at).toBeNull();
    expect(await mailCountTo(emailOf("r"))).toBe(0);
  });

  it("with the token it runs and returns counts; a second call does not warn again", async () => {
    const p = await makeParent(emailOf("r2"), { consent: true });
    await setRow(p.userId, { last_active_at: ago(400) });
    const res = await GET(new Request("http://x/api/cron/retention", { headers: auth }));
    expect(res.status).toBe(200);
    expect(Object.keys(await res.json()).sort()).toEqual(["deleted", "distressSent", "purgedFlags", "warned"]);
    await GET(new Request("http://x/api/cron/retention", { headers: auth }));
    expect(await mailCountTo(emailOf("r2"), `subject:"${SUBJECT}"`)).toBe(1);
  });
});
