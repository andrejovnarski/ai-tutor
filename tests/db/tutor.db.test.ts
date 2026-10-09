// Nova's lines through the play routes (handlers called directly, TUTOR_VOICE canned unless a fake voice is set).
// Review focus: the answer never reaches the browser in a line before the kid has tried, and the kid's name never
// reaches a turn plan (what would be sent to Claude).
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { admin, makeParent } from "../helpers/admin";
import type { TurnPlan } from "../../src/server/tutor/types";
import type { TutorVoice } from "../../src/server/tutor/voice";

const who = vi.hoisted(() => ({ client: null as unknown as SupabaseClient }));
const tutor = vi.hoisted(() => ({ plans: [] as TurnPlan[], voice: null as TutorVoice | null }));
vi.mock("server-only", () => ({}));
vi.mock("../../src/server/supabase", () => ({ createServerSupabase: async () => who.client }));
vi.mock("../../src/server/tutor/voice", async (orig) => {
  const real = await orig<typeof import("../../src/server/tutor/voice")>();
  return {
    ...real,
    getTutorVoice: () => tutor.voice ?? real.getTutorVoice(),
    speak: (plan: TurnPlan, ctx: Parameters<typeof real.speak>[1]) => {
      tutor.plans.push(plan);
      return real.speak(plan, ctx);
    },
  };
});

import { POST as turnPost } from "../../src/app/api/kids/[kidId]/turn/route";
import { POST as answerPost } from "../../src/app/api/kids/[kidId]/answer/route";
import { POST as sayPost } from "../../src/app/api/kids/[kidId]/say/route";
import { numbersIn } from "../../src/server/tutor/guards";
import { userMessage } from "../../src/server/tutor/prompt";
import { SupabaseRepo } from "../../src/server/persist/supabaseRepo";

const NAME = "Zephyrina";
const DISTRESS = "That sounds hard. Please tell a grown-up you trust.";
const run = Date.now();
let A: { userId: string; client: SupabaseClient };

const ctx = (kidId: string) => ({ params: Promise.resolve({ kidId }) });
const post = (body: unknown) => new Request("http://x/api", { method: "POST", body: JSON.stringify(body) });
const openState = async (kid: string) =>
  (await admin().from("sessions").select("version, state").eq("kid_id", kid).is("ended_at", null).single()).data!;

async function newKid(ageBand: "5-7" | "8-11", grade: string) {
  const { data, error } = await A.client.from("kids")
    .insert({ parent_id: A.userId, nickname: NAME, grade, age_band: ageBand, avatar: "fox" }).select().single();
  expect(error).toBeNull();
  return data.id as string;
}

beforeAll(async () => {
  A = await makeParent(`tutor-a-${run}@test.dev`, { consent: true });
  who.client = A.client;
});
afterEach(() => { tutor.voice = null; });

type Line = { say: string; tone: string; show?: string };
const isLine = (l: Line) => {
  expect(typeof l.say).toBe("string");
  expect(l.say).not.toMatch(/\{name\}|\{answer\}/);
  expect(["cheer", "calm", "curious"]).toContain(l.tone);
};

describe("Nova in play", () => {
  it("the turn has a line with the name filled; the answer has line and nextLine", async () => {
    const kid = await newKid("5-7", "K");
    const t = await turnPost(post({}), ctx(kid));
    expect(t.status).toBe(200);
    const { version, line } = await t.json();
    isLine(line);
    const { state } = await openState(kid);
    const a = await answerPost(post({ version, given: state.pending.problem.answer }), ctx(kid));
    expect(a.status).toBe(200);
    const body = await a.json();
    isLine(body.line);
    isLine(body.nextLine);
    const stale = await answerPost(post({ version, given: 1 }), ctx(kid));
    expect(stale.status).toBe(409);
    isLine((await stale.json()).line);
  });

  it(`stores raw lines and never puts the nickname in a plan or a Claude message`, async () => {
    const kid = await newKid("8-11", "3");
    tutor.plans = [];
    // A Claude-like voice that always says the name, so filled text would show up if it were ever fed back.
    tutor.voice = { line: async () => ({ say: "Ready, {name}? Take a look.", tone: "curious", cacheRead: 0 }) };
    const seen: string[] = [];
    let v = (await (await turnPost(post({}), ctx(kid))).json()).version;
    for (let i = 0; i < 4; i++) {
      const { state } = await openState(kid);
      const res = await answerPost(post({ version: v, given: state.pending.problem.answer + (i % 2 ? 0 : 1000) }), ctx(kid));
      const b = await res.json();
      seen.push(b.line.say, b.nextLine?.say ?? "");
      v = b.version;
    }
    await sayPost(post({ text: "tell me a joke" }), ctx(kid));
    expect(seen.some((s) => s.includes(NAME))).toBe(true); // the browser does get the name
    expect(tutor.plans.length).toBeGreaterThan(8);
    for (const p of tutor.plans) {
      expect(JSON.stringify(p)).not.toContain(NAME);
      expect(userMessage(p)).not.toContain(NAME);
    }
    const { state } = await openState(kid);
    expect(state.tutorRecent.length).toBeGreaterThan(0);
    expect(state.tutorRecent.length).toBeLessThanOrEqual(3);
    expect(JSON.stringify(state)).not.toContain(NAME);
  });

  it("Review focus 1: over 30 seeded problems per voice, no present, wrong or hint line says the answer", async () => {
    for (const leaky of [false, true]) {
      const kid = await newKid(leaky ? "8-11" : "5-7", leaky ? "2" : "1");
      // The leaky voice tries to blurt the answer every time; the guards must swap in a canned line.
      if (leaky) tutor.voice = {
        line: async (plan) => ({ say: `Hmm, {name}, it is ${plan.answer}!`, tone: "cheer", cacheRead: 0 }),
      };
      let { version, turn, line } = await (await turnPost(post({}), ctx(kid))).json();
      const checked = { present: 0, feedback: 0 };
      const check = (say: string, ans: number, problemNums: number[], what: keyof typeof checked) => {
        checked[what]++;
        if (!problemNums.includes(ans)) expect(numbersIn(say), `${say} (answer ${ans})`).not.toContain(ans);
      };
      for (let n = 0; n < 30; n++) {
        if (turn.kind !== "problem") break;
        const { state } = await openState(kid);
        const ans: number = state.pending.problem.answer;
        const nums = numbersIn(turn.prompt.say);
        check(line.say, ans, nums, "present");
        // wrong first try: the feedback (wrong or hint) and the retry's present line must hold the answer back
        let r = await (await answerPost(post({ version, given: ans + 1000 }), ctx(kid))).json();
        if (r.feedback.then === "retry") {
          check(r.line.say, ans, nums, "feedback");
          check(r.nextLine.say, ans, nums, "present");
          r = await (await answerPost(post({ version: r.version, given: ans + 1000 }), ctx(kid))).json();
        } else if (!r.feedback.reveal) check(r.line.say, ans, nums, "feedback");
        ({ version, line } = { version: r.version, line: r.nextLine });
        turn = r.next;
      }
      expect(checked.present).toBeGreaterThanOrEqual(30);
      expect(checked.feedback).toBeGreaterThan(0);
      tutor.voice = null;
    }
  }, 120_000);

  it("after two wrong tries the answer line says the answer even when the voice leaves it out", async () => {
    const kid = await newKid("8-11", "2");
    // Placed, so practice problems give a retry and then the reveal (placement probes move on instead).
    expect((await admin().from("kids").update({ placed: true }).eq("id", kid)).error).toBeNull();
    // A Claude-like voice whose explain never states the answer: guards must reject it and fall back to canned.
    tutor.voice = { line: async () => ({ say: "Let's walk through it together!", tone: "calm", cacheRead: 0 }) };
    let { version } = await (await turnPost(post({}), ctx(kid))).json();
    let revealed = 0;
    for (let n = 0; n < 6 && revealed < 2; n++) {
      const { state } = await openState(kid);
      const ans: number = state.pending.problem.answer;
      let r = await (await answerPost(post({ version, given: ans + 1000 }), ctx(kid))).json();
      if (r.feedback.then === "retry") r = await (await answerPost(post({ version: r.version, given: ans + 1000 }), ctx(kid))).json();
      if (r.feedback.reveal) {
        revealed++;
        expect(r.revealed).toBe(ans);
        expect(numbersIn(r.line.say), r.line.say).toContain(ans);
      }
      version = r.version;
    }
    expect(revealed).toBeGreaterThan(0);
  });

  it("a failing nickname lookup falls back to 'friend' instead of failing the request", async () => {
    const kid = await newKid("5-7", "K");
    tutor.voice = { line: async () => ({ say: "Ready, {name}? Take a look.", tone: "curious", cacheRead: 0 }) };
    const spy = vi.spyOn(SupabaseRepo.prototype, "nickname").mockRejectedValue(new Error("db blip"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const t = await turnPost(post({}), ctx(kid));
      expect(t.status).toBe(200);
      const { version, line } = await t.json();
      expect(line.say).toBe("Ready, friend? Take a look.");
      const { state } = await openState(kid);
      const a = await answerPost(post({ version, given: state.pending.problem.answer }), ctx(kid));
      expect(a.status).toBe(200);
      expect((await a.json()).line.say).not.toContain("{name}");
      const s = await sayPost(post({ text: "tell me a joke" }), ctx(kid));
      expect(s.status).toBe(200);
    } finally {
      spy.mockRestore();
      warn.mockRestore();
    }
  });

  it("say: off-topic text gets a steer-back line and nothing is stored or logged", async () => {
    const kid = await newKid("5-7", "K");
    await turnPost(post({}), ctx(kid));
    const before = await openState(kid);
    const log = vi.spyOn(console, "log");
    const err = vi.spyOn(console, "error");
    try {
      const res = await sayPost(post({ text: "tell me a joke" }), ctx(kid));
      expect(res.status).toBe(200);
      const { reply } = await res.json();
      expect(typeof reply).toBe("string");
      expect(reply.length).toBeGreaterThan(0);
      expect(reply).not.toContain("{name}");
      expect(reply).not.toBe(DISTRESS);
      expect(JSON.stringify([log.mock.calls, err.mock.calls])).not.toContain("joke");
    } finally {
      log.mockRestore();
      err.mockRestore();
    }
    expect(await openState(kid)).toEqual(before);
    expect((await admin().from("distress_flags").select("*").eq("kid_id", kid)).data).toHaveLength(0);
  });

  it("say: a distress text still returns the fixed reply", async () => {
    const kid = await newKid("5-7", "K");
    await turnPost(post({}), ctx(kid));
    const res = await sayPost(post({ text: "I want to die" }), ctx(kid));
    expect(await res.json()).toEqual({ reply: DISTRESS });
  });
});
