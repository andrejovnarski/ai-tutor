import { vi } from "vitest";
import { AnthropicError, APIConnectionError, InternalServerError } from "@anthropic-ai/sdk";
import type Anthropic from "@anthropic-ai/sdk";
import { SKILLS } from "../../domain/curriculum";
import type { Turn } from "../../domain/session/types";
import { checkLine } from "./guards";
import { kidSaidPlan, presentPlan } from "./plan";
import type { TurnPlan } from "./types";

vi.mock("server-only", () => ({}));

const { EXAMPLES, SYSTEM_PROMPT, userMessage } = await import("./prompt");
const { cannedVoice, claudeVoice, getTutorVoice, speak } = await import("./voice");

type ProblemTurn = Extract<Turn, { kind: "problem" }>;
const turn: ProblemTurn = {
  kind: "problem",
  problem: {
    prompt: { say: "How many dots are there in all?", show: { kind: "ten-frames", first: 3, second: 4 } },
    answer: 7, input: "tap-choice", choices: [6, 7, 8], mistakes: [],
  },
  skillId: SKILLS[0]!.id, templateId: "t", seed: 1, level: 1, mode: "practice", try: 1, logs: [],
};
const plan: TurnPlan = presentPlan(turn, "5-7", []);
const GOOD = JSON.stringify({ say: "Look, {name}! How many dots in all?", tone: "curious" });
const EARLY = JSON.stringify({ say: "It's 7!", tone: "cheer" }); // speaks the answer on present

type Script = { text?: string; stop_reason?: string; error?: unknown; hang?: boolean; delayMs?: number; cacheRead?: number };

/** Stands in for `client.beta.messages.parse`: records params, mimics the SDK's eager parse of text blocks. */
function fakeClient(scripts: Script[]) {
  const calls: { params: any; opts: any }[] = [];
  const respond = async (params: any, opts: any) => {
    calls.push({ params, opts });
    const s = scripts.shift() ?? { text: GOOD };
    if (s.hang) return new Promise(() => {});
    if (s.delayMs) await new Promise((r) => setTimeout(r, s.delayMs));
    if (s.error) throw s.error;
    const content = s.text === undefined ? [] : [{ type: "text", text: s.text }];
    let parsed_output = null;
    for (const b of content) {
      try { parsed_output = params.output_config.format.parse(b.text); }
      catch (e) { throw new AnthropicError(`Failed to parse structured output: ${e}`); }
    }
    return {
      stop_reason: s.stop_reason ?? "end_turn", content, parsed_output,
      usage: { cache_read_input_tokens: s.cacheRead ?? 0, input_tokens: 1, output_tokens: 1 },
    };
  };
  return { calls, client: { beta: { messages: { parse: respond, create: respond } } } as unknown as Anthropic };
}

function run(scripts: Script[], p: TurnPlan = plan, extra: { budgetMs?: number } = {}) {
  const fake = fakeClient(scripts);
  return { fake, result: speak(p, { voice: claudeVoice(fake.client), seed: 0, ...extra }) };
}

let log: ReturnType<typeof vi.spyOn>;
beforeEach(() => { log = vi.spyOn(console, "log").mockImplementation(() => {}); });
afterEach(() => { log.mockRestore(); vi.useRealTimers(); });

describe("speak", () => {
  it("uses a good line from Claude", async () => {
    const { result } = run([{ text: GOOD, cacheRead: 900 }]);
    const r = await result;
    expect(r.outcome).toBe("ai");
    expect(r.line.say).toBe("Look, {name}! How many dots in all?");
    expect(JSON.parse(log.mock.calls[0]![0] as string)).toMatchObject({ evt: "tutor", event: "present", outcome: "ai", cacheRead: 900 });
  });

  it("retries after a guard failure", async () => {
    const { fake, result } = run([{ text: EARLY }, { text: GOOD }]);
    expect((await result).outcome).toBe("ai-retry");
    expect(fake.calls).toHaveLength(2);
  });

  it("falls back to canned after two guard failures", async () => {
    const r = await run([{ text: EARLY }, { text: EARLY }]).result;
    expect(r.outcome).toBe("canned:guard");
    expect(checkLine(r.line, plan)).toEqual({ ok: true });
  });

  it("retries a refusal, then uses canned", async () => {
    const { fake, result } = run([{ stop_reason: "refusal" }, { stop_reason: "refusal" }]);
    expect((await result).outcome).toBe("canned:refusal");
    expect(fake.calls).toHaveLength(2);
  });

  it("uses canned when Claude returns broken JSON", async () => {
    const r = await run([{ text: "{not json" }, { text: '{"say": 5}' }]).result;
    expect(r.outcome).toBe("canned:parse");
  });

  it("uses canned on API errors", async () => {
    const err = new InternalServerError(500, undefined, "boom", new Headers());
    const r = await run([{ error: err }, { error: new APIConnectionError({ message: "down" }) }]).result;
    expect(r.outcome).toBe("canned:error");
  });

  it("gives up a hung attempt at the budget and answers within budget + 100 ms", async () => {
    vi.useFakeTimers();
    const t0 = Date.now();
    const { fake, result } = run([{ hang: true }, { hang: true }]);
    let done = false;
    void result.then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(2500);
    expect(done).toBe(true);
    const r = await result;
    expect(r.outcome).toBe("canned:timeout");
    expect(Date.now() - t0).toBeLessThanOrEqual(2600);
    expect(fake.calls).toHaveLength(1); // nothing left to retry with
    expect(fake.calls[0]!.opts.signal.aborted).toBe(true);
  });

  it("does not retry when less than 800 ms remain", async () => {
    vi.useFakeTimers();
    const { fake, result } = run([{ delayMs: 1800, text: EARLY }, { text: GOOD }]);
    await vi.advanceTimersByTimeAsync(2500);
    expect((await result).outcome).toBe("canned:guard");
    expect(fake.calls).toHaveLength(1);
  });

  it("retries with the remaining budget as the request timeout", async () => {
    vi.useFakeTimers();
    const { fake, result } = run([{ delayMs: 1000, error: new APIConnectionError({ message: "x" }) }, { text: GOOD }]);
    await vi.advanceTimersByTimeAsync(2500);
    expect((await result).outcome).toBe("ai-retry");
    expect(fake.calls[0]!.opts.timeout).toBe(2500);
    expect(fake.calls[1]!.opts.timeout).toBe(1500);
  });

  it("fills {answer} in canned lines and never throws on a broken voice", async () => {
    const explain: TurnPlan = { ...plan, event: "explain", revealed: true, kidAnswer: 6 };
    const broken = { line: () => { throw new Error("sync boom"); } };
    const r = await speak(explain, { voice: broken, seed: 0 });
    expect(r.outcome).toBe("canned:error");
    expect(r.line.say).toContain("7");
    expect(r.line.say).not.toContain("{answer}");
  });

  it("speaks canned lines directly for the canned voice", async () => {
    const r = await speak(plan, { voice: cannedVoice, seed: 1 });
    expect(r.outcome).toBe("canned:config");
    expect(checkLine(r.line, plan)).toEqual({ ok: true });
  });

  it("logs one line with no kid text or problem text", async () => {
    const said = kidSaidPlan(turn, "my secret words", "8-11", []);
    await run([{ text: GOOD }], said).result;
    expect(log).toHaveBeenCalledTimes(1);
    const line = log.mock.calls[0]![0] as string;
    expect(Object.keys(JSON.parse(line)).sort()).toEqual(["cacheRead", "event", "evt", "ms", "outcome"]);
    expect(line).not.toContain("secret");
    expect(line).not.toContain("dots");
  });
});

describe("claudeVoice request (review focus 3)", () => {
  it("sends the decided request shape and only the turn plan", async () => {
    const nickname = "Mia", kidId = "3f6c1a2e-9b7d-4c1e-8a55-0d2b7e9f4c11", email = "parent@example.com";
    const said = kidSaidPlan(turn, "can we do another?", "5-7", ["Hi {name}!"]);
    const { fake, result } = run([{ text: GOOD }], said);
    await result;
    const { params, opts } = fake.calls[0]!;
    expect(params).toMatchObject({
      model: "claude-opus-5-5",
      max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMessage(said) }],
    });
    expect(params.thinking).toBeUndefined();
    expect(params.output_config.format.type).toBe("json_schema");
    expect(opts.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.stringify(params);
    for (const secret of [nickname, kidId, email]) expect(body).not.toContain(secret);
  });

  it("throws on a refusal before reading content", async () => {
    const fake = fakeClient([{ stop_reason: "refusal", text: GOOD }]);
    await expect(claudeVoice(fake.client).line(plan, new AbortController().signal)).rejects.toMatchObject({ reason: "refusal" });
  });
});

describe("prompt", () => {
  it("is long, frozen and year-free", () => {
    expect(SYSTEM_PROMPT.length).toBeGreaterThanOrEqual(2500);
    expect(SYSTEM_PROMPT).not.toMatch(/(?<!\d)(19|20)\d\d(?!\d)/);
    for (const s of ["number-line", "blocks", "ten-frame", "story", "drawing", "{name}", "kid-said"])
      expect(SYSTEM_PROMPT).toContain(s);
  });

  it("has at least 8 worked examples that pass the guards, across events and age bands", () => {
    expect(EXAMPLES.length).toBeGreaterThanOrEqual(8);
    for (const ex of EXAMPLES) {
      expect(checkLine(ex.line, ex.plan), ex.line.say).toEqual({ ok: true });
      expect(SYSTEM_PROMPT).toContain(JSON.stringify(ex.line));
      expect(SYSTEM_PROMPT).toContain(userMessage(ex.plan));
    }
    expect(new Set(EXAMPLES.map((e) => e.plan.event))).toEqual(
      new Set(["present", "correct", "wrong", "hint", "explain", "celebrate", "kid-said"]));
    expect(new Set(EXAMPLES.map((e) => e.plan.ageBand))).toEqual(new Set(["5-7", "8-11"]));
  });

  it("serialises the plan with sorted keys", () => {
    const a = userMessage({ ...plan, recentLines: ["x"] });
    const b = userMessage(Object.fromEntries(Object.entries({ ...plan, recentLines: ["x"] }).reverse()) as TurnPlan);
    expect(a).toBe(b);
    expect(Object.keys(JSON.parse(a))).toEqual(Object.keys(JSON.parse(a)).sort());
  });
});

describe("getTutorVoice", () => {
  afterEach(() => { delete process.env.TUTOR_VOICE; });
  it("defaults to canned and picks claude when asked", () => {
    delete process.env.TUTOR_VOICE;
    expect(getTutorVoice()).toBe(cannedVoice);
    process.env.TUTOR_VOICE = "canned";
    expect(getTutorVoice()).toBe(cannedVoice);
    process.env.TUTOR_VOICE = "claude";
    expect(getTutorVoice()).not.toBe(cannedVoice);
    process.env.TUTOR_VOICE = "loud";
    expect(() => getTutorVoice()).toThrow(/TUTOR_VOICE/);
  });
});
