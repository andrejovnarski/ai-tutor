import { describe, it, expect, beforeAll, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { admin, anon, makeParent, latestEmailTo, mailCountTo } from "../helpers/admin";

const who = vi.hoisted(() => ({ client: null as unknown as SupabaseClient }));
vi.mock("server-only", () => ({}));
vi.mock("../../src/server/supabase", () => ({ createServerSupabase: async () => who.client }));

const mail = vi.hoisted(() => ({ fail: false }));
vi.mock("../../src/server/email/mailer", async (orig) => {
  const real = await orig<typeof import("../../src/server/email/mailer")>();
  return {
    ...real,
    getMailer: () => ({
      send: async (m: Parameters<ReturnType<typeof real.getMailer>["send"]>[0]) => {
        if (mail.fail) throw new Error("mail down");
        return real.getMailer().send(m);
      },
    }),
  };
});

import { sendPendingDistressEmails } from "../../src/server/distress/report";
import { POST as sayPost } from "../../src/app/api/kids/[kidId]/say/route";

const run = Date.now();
let A: { userId: string; client: SupabaseClient };
let B: { userId: string; client: SupabaseClient };
let kidA: string;
const emailA = `distress-a-${run}@test.dev`;

const ctx = (kidId: string) => ({ params: Promise.resolve({ kidId }) });
const say = (text: unknown) => new Request("http://x/api", { method: "POST", body: JSON.stringify({ text }) });
const flags = async () => (await admin().from("distress_flags").select("*").eq("kid_id", kidA)).data ?? [];
// Only distress mail: the weekly-report test emails every consented parent, this one included.
const mailCount = (to: string) => mailCountTo(to, 'subject:"said something that worried us"');

beforeAll(async () => {
  A = await makeParent(emailA, { consent: true });
  B = await makeParent(`distress-b-${run}@test.dev`, { consent: true });
  const { data, error } = await A.client.from("kids")
    .insert({ parent_id: A.userId, nickname: "Ann", grade: "K", age_band: "5-7", avatar: "fox" }).select().single();
  expect(error).toBeNull();
  kidA = data.id;
});

describe("say route", () => {
  it("a non-hit stores nothing and sends nothing", async () => {
    who.client = A.client;
    const before = await mailCount(emailA);
    const res = await sayPost(say("I killed it at math"), ctx(kidA));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: null });
    expect(await flags()).toHaveLength(0);
    expect(await mailCount(emailA)).toBe(before);
  });

  it("another family's kid is a 404 and nothing is stored", async () => {
    who.client = B.client;
    expect((await sayPost(say("I want to die"), ctx(kidA))).status).toBe(404);
    expect(await flags()).toHaveLength(0);
    expect(await mailCount(emailA)).toBe(0);
  });

  it("a signed-out caller is a 404", async () => {
    who.client = anon();
    expect((await sayPost(say("I want to die"), ctx(kidA))).status).toBe(404);
    expect(await flags()).toHaveLength(0);
  });

  it("501 characters and bad bodies are 400", async () => {
    who.client = A.client;
    expect((await sayPost(say("a".repeat(501)), ctx(kidA))).status).toBe(400);
    expect((await sayPost(say(""), ctx(kidA))).status).toBe(400);
    expect((await sayPost(say(5), ctx(kidA))).status).toBe(400);
    expect(await flags()).toHaveLength(0);
  });

  it("a hit stores one row, emails the parent, and replies with the spec line", async () => {
    who.client = A.client;
    const res = await sayPost(say("sometimes I want to die."), ctx(kidA));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: "That sounds hard. Please tell a grown-up you trust." });
    const rows = await flags();
    expect(rows).toHaveLength(1);
    expect(rows[0].line).toBe("sometimes I want to die.");
    expect(rows[0].emailed_at).not.toBeNull();
    const mail = await latestEmailTo(emailA);
    expect(mail.Subject).toBe("Ann said something that worried us");
    expect(mail.Text).toContain("sometimes I want to die.");
    expect(mail.Text).toContain("Math Friend is not a crisis service. If your child may be in danger, call 911. For a mental health crisis, call or text 988.");
  });

  it("if the email fails the kid still hears the line, the row is kept unsent, and the retry sends it", async () => {
    who.client = A.client;
    const before = await mailCount(emailA);
    mail.fail = true;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    let res;
    try {
      res = await sayPost(say("my brother hits me"), ctx(kidA));
    } finally {
      mail.fail = false;
    }
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: "That sounds hard. Please tell a grown-up you trust." });
    expect(JSON.stringify(err.mock.calls)).not.toContain("hits me");
    err.mockRestore();
    const pending = (await flags()).filter((f) => f.emailed_at === null);
    expect(pending).toHaveLength(1);
    expect(await mailCount(emailA)).toBe(before);

    const { sent } = await sendPendingDistressEmails();
    expect(sent).toBeGreaterThanOrEqual(1);
    expect((await flags()).filter((f) => f.emailed_at === null)).toHaveLength(0);
    expect((await latestEmailTo(emailA)).Text).toContain("my brother hits me");
    expect(await mailCount(emailA)).toBe(before + 1);
  });
});
