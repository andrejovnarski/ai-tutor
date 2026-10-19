import { describe, it, expect, beforeAll, vi } from "vitest";
import { mailpitMailer } from "../../src/server/email/mailer";
import { admin, makeParent, latestEmailTo, mailCountTo } from "../helpers/admin";

vi.mock("server-only", () => ({}));
// Seam for the "parent deleted mid-sweep" test: runs just before the cron claims a row in report_sends.
let beforeClaim: (() => Promise<void>) | null = null;
vi.mock("@supabase/supabase-js", async (orig) => {
  const actual = await orig<typeof import("@supabase/supabase-js")>();
  return {
    ...actual,
    createClient: (...args: Parameters<typeof actual.createClient>) => {
      const client = actual.createClient(...args);
      const from = client.from.bind(client);
      client.from = ((table: string) => {
        const q = from(table);
        if (table !== "report_sends") return q;
        const insert = q.insert.bind(q);
        q.insert = ((...a: Parameters<typeof q.insert>) =>
          // Thenable: defer the hook until the insert is awaited, then run it first.
          Promise.resolve(beforeClaim?.()).then(() => insert(...a))) as unknown as typeof q.insert;
        return q;
      }) as typeof client.from;
      return client;
    },
  };
});
const { sendWeeklyReports } = await import("../../src/server/report/send");
const { GET } = await import("../../src/app/api/cron/weekly-report/route");

const run = Date.now();
const SUNDAY_5PM = new Date("2026-10-11T21:00:00Z"); // Sunday 17:00 EDT
const SUNDAY_4PM = new Date("2026-10-11T20:00:00Z");
const SUNDAY_6PM = new Date("2026-10-11T22:00:00Z");
const SUNDAY_7PM = new Date("2026-10-11T23:00:00Z");
const WEEK_START = "2026-10-04";
const day = (d: number, minute = 0) => new Date(Date.UTC(2026, 9, d, 15, minute)).toISOString();

const emailOf = (id: string) => `rep-${id}-${run}@test.dev`;
let parent: string, noConsent: string;
const reportRows = async (id: string) =>
  (await admin().from("report_sends").select("*").eq("parent_id", id)).data ?? [];
const mailCount = mailCountTo;

async function seedKid(parentId: string, nickname: string) {
  const { data, error } = await admin().from("kids")
    .insert({ parent_id: parentId, nickname, grade: "K", age_band: "5-7", avatar: "fox" }).select().single();
  expect(error).toBeNull();
  return data.id as string;
}

beforeAll(async () => {
  parent = (await makeParent(emailOf("a"), { consent: true })).userId;
  noConsent = (await makeParent(emailOf("b"))).userId;
  const kid = await seedKid(parent, "Zoe");
  await seedKid(noConsent, "Nope");
  const a = admin();
  const sessions: string[] = [];
  for (const startedDay of [6, 8]) {
    const { data, error } = await a.from("sessions").insert({ kid_id: kid, state: {}, started_at: day(startedDay), ended_at: day(startedDay, 20) }).select().single();
    expect(error).toBeNull();
    sessions.push(data.id as string);
  }
  const attempt = (s: string, d: number, m: number, tag: string | null) => ({
    kid_id: kid, session_id: s, skill_id: "add-within-10.count-on", template_id: "t", seed: 1, level: 1, answer: 3,
    result: tag ? "wrong" : "correct", mistake_tag: tag, style: null, time_ms: 60_000, at: day(d, m), try: 1, mode: "practice",
  });
  const { error } = await a.from("attempts").insert([
    attempt(sessions[0]!, 6, 0, "off-by-ten"), attempt(sessions[0]!, 6, 9, null), // 10 min
    attempt(sessions[1]!, 8, 0, "off-by-ten"), attempt(sessions[1]!, 8, 19, null), // 20 min
    attempt(sessions[1]!, 1, 0, "added-instead"), // outside the window
  ]);
  expect(error).toBeNull();
  const { error: se } = await a.from("skill_state").insert({
    kid_id: kid, skill_id: "add-within-10.count-on", p_known: 0.5, attempts: 3, level: 1, correct_streak: 0, wrong_streak: 0,
    placed: false, recent_tags: [], mastered_at: day(9),
  });
  expect(se).toBeNull();
});

describe("weekly report", () => {
  it("emails a consented parent a summary once, and only on Sunday 17:00 Eastern", async () => {
    const email = emailOf("a");
    expect((await sendWeeklyReports(SUNDAY_4PM)).sent).toBe(0);
    expect(await reportRows(parent)).toHaveLength(0);

    expect((await sendWeeklyReports(SUNDAY_5PM)).sent).toBeGreaterThanOrEqual(1);
    const rows = await reportRows(parent);
    expect(rows).toHaveLength(1);
    expect(rows[0].week_start).toBe(WEEK_START);

    const mail = await latestEmailTo(email);
    expect(mail.Subject).toBe("Your week with Brightling AI");
    expect(mail.Text).toContain("Zoe");
    expect(mail.Text).toContain("2 sessions");
    expect(mail.Text).toContain("30 minutes");
    expect(mail.Text).toContain("Count on"); // skill name mastered this week
    expect(mail.Text.toLowerCase()).toContain("tens");
    expect(mail.Text).not.toMatch(/undefined|NaN|null/);
    expect(mail.Text).not.toContain("Adding when"); // the out-of-window tag appears only once, so is not stuck

    expect(await mailCount(email)).toBe(1);
    await sendWeeklyReports(SUNDAY_5PM);
    expect(await reportRows(parent)).toHaveLength(1);
    expect(await mailCount(email)).toBe(1);
  });

  it("adds one rewards line when REWARDS=on, and none when off", async () => {
    const r = await makeParent(emailOf("r"), { consent: true });
    const kid = await seedKid(r.userId, "Rae");
    const lastActivity = Date.parse(day(8));
    const { data: sess, error } = await admin().from("sessions").insert({
      kid_id: kid, started_at: day(8), ended_at: day(8, 20),
      state: { problems: 4, firstTryCorrect: 2, mastered: [], lastActivity },
    }).select().single();
    expect(error).toBeNull();
    const { error: ae } = await admin().from("attempts").insert({
      kid_id: kid, session_id: sess!.id, skill_id: "add-within-10.count-on", template_id: "t", seed: 1, level: 1, answer: 3,
      result: "correct", mistake_tag: null, style: null, time_ms: 60_000, at: day(8), try: 1, mode: "practice",
    });
    expect(ae).toBeNull();
    vi.stubEnv("REWARDS", "on");
    try {
      await sendWeeklyReports(SUNDAY_5PM);
    } finally {
      vi.unstubAllEnvs();
    }
    expect(await reportRows(r.userId)).toHaveLength(1);
    const mail = await latestEmailTo(emailOf("r"));
    expect(mail.Text).toMatch(/Rae earned \d+ stickers?\./);
    expect(mail.Text).not.toMatch(/undefined|NaN|null/);
    // Rewards off (the default): the earlier mails carry no rewards line.
    expect((await latestEmailTo(emailOf("a"))).Text).not.toMatch(/ earned \d+ sticker/);
  });

  it("retries after a failed send in a later hour that Sunday, then stays idempotent", async () => {
    const f = await makeParent(emailOf("f"), { consent: true });
    await seedKid(f.userId, "Fay");
    const real = mailpitMailer.send;
    const spy = vi.spyOn(mailpitMailer, "send").mockImplementation((m) =>
      m.to === emailOf("f") ? Promise.reject(new Error("boom")) : real(m));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    await sendWeeklyReports(SUNDAY_5PM);
    spy.mockRestore();
    quiet.mockRestore();
    expect(await reportRows(f.userId)).toHaveLength(0);
    expect(await mailCount(emailOf("f"))).toBe(0);

    expect((await sendWeeklyReports(SUNDAY_6PM)).sent).toBeGreaterThanOrEqual(1);
    expect(await mailCount(emailOf("f"))).toBe(1);
    expect((await reportRows(f.userId))[0].week_start).toBe(WEEK_START);
    await sendWeeklyReports(SUNDAY_7PM);
    expect(await mailCount(emailOf("f"))).toBe(1);
    expect(await reportRows(f.userId)).toHaveLength(1);
  });

  it("skips a parent deleted between being listed and claimed, and still sends to the rest", async () => {
    const gone = await makeParent(emailOf("h"), { consent: true });
    await seedKid(gone.userId, "Hal");
    const stays = await makeParent(emailOf("i"), { consent: true });
    await seedKid(stays.userId, "Ida");
    let deleted = false;
    beforeClaim = async () => {
      if (deleted) return;
      deleted = true;
      expect((await admin().auth.admin.deleteUser(gone.userId)).error).toBeNull();
    };
    try {
      // The hook fires at the sweep's first claim, so the parent is gone before its own claim whatever its position.
      await expect(sendWeeklyReports(SUNDAY_5PM)).resolves.toBeDefined();
    } finally {
      beforeClaim = null;
    }
    expect(deleted).toBe(true);
    expect(await reportRows(gone.userId)).toHaveLength(0);
    expect(await reportRows(stays.userId)).toHaveLength(1);
    expect(await mailCount(emailOf("i"))).toBe(1);
  });

  it("pages through all consented parents", async () => {
    const ids: string[] = [];
    for (const n of ["g1", "g2", "g3"]) {
      const g = await makeParent(emailOf(n), { consent: true });
      await seedKid(g.userId, n);
      ids.push(g.userId);
    }
    await sendWeeklyReports(SUNDAY_5PM, 1);
    for (const [i, id] of ids.entries()) {
      expect(await reportRows(id), `g${i + 1}`).toHaveLength(1);
      expect(await mailCount(emailOf(`g${i + 1}`))).toBe(1);
    }
  });

  it("sends nothing to a parent without consent", async () => {
    await sendWeeklyReports(SUNDAY_5PM);
    expect(await reportRows(noConsent)).toHaveLength(0);
    expect(await mailCount(emailOf("b"))).toBe(0);
  });

  it("the route needs the bearer secret and sends nothing without it", async () => {
    const c = await makeParent(emailOf("c"), { consent: true });
    await seedKid(c.userId, "Cal");
    const url = `http://x/api/cron/weekly-report?now=${SUNDAY_5PM.getTime()}`;
    const res = await GET(new Request(url));
    expect(res.status).toBe(401);
    expect(await reportRows(c.userId)).toHaveLength(0);
    expect(await mailCount(emailOf("c"))).toBe(0);

    const ok = await GET(new Request(`http://x/api/cron/weekly-report?now=${SUNDAY_4PM.getTime()}`, {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ sent: 0 });
  });
});
