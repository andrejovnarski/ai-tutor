import { describe, expect, it } from "vitest";
import {
  isGone, playReducer, runRequest, type AnswerBody, type FetchFn, type PlayState, type StepBody,
} from "./playMachine";

const problem = (n: number) => ({
  kind: "problem" as const, mode: "practice" as never, try: 1 as const, help: 0 as const,
  prompt: { say: `Q${n}` } as never, input: "number-pad" as never,
});
const line = (say: string) => ({ say, tone: "calm" as const });
const res = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function harness(script: Array<Response | Error>) {
  const sleeps: number[] = [];
  let i = 0;
  const fetchFn: FetchFn = async () => {
    const s = script[Math.min(i++, script.length - 1)]!;
    if (s instanceof Error) throw s;
    return s;
  };
  return { sleeps, fetchFn, sleep: async (ms: number) => { sleeps.push(ms); } };
}

describe("runRequest", () => {
  it("retries two failures then returns the 200", async () => {
    const h = harness([new Error("x"), new Error("x"), res(200)]);
    const r = await runRequest(h.fetchFn, h.sleep, { url: "/u" });
    expect((r as Response).status).toBe(200);
    expect(h.sleeps).toEqual([500, 1000]);
  });
  it("gives up after 4 retries", async () => {
    const h = harness([new Error("x")]);
    expect(await runRequest(h.fetchFn, h.sleep, { url: "/u" })).toBe("offline");
    expect(h.sleeps).toEqual([500, 1000, 2000, 4000]);
  });
  it("returns 409, 400, 404 at once", async () => {
    for (const s of [409, 400, 404]) {
      const h = harness([res(s)]);
      expect(((await runRequest(h.fetchFn, h.sleep, { url: "/u" })) as Response).status).toBe(s);
      expect(h.sleeps).toEqual([]);
    }
  });
  it("retries a 503", async () => {
    const h = harness([res(503), res(200)]);
    const attempts: number[] = [];
    const r = await runRequest(h.fetchFn, h.sleep, { url: "/u", onRetry: (a) => attempts.push(a) });
    expect((r as Response).status).toBe(200);
    expect(h.sleeps).toEqual([500]);
    expect(attempts).toEqual([1]);
  });
  it("an abort during the backoff stops the loop: no more fetches, no more retries", async () => {
    const ctl = new AbortController();
    let fetches = 0;
    const retries: number[] = [];
    const fetchFn: FetchFn = async () => { fetches++; throw new Error("down"); };
    const sleep = async () => { ctl.abort(); };
    const r = await runRequest(fetchFn, sleep, { url: "/u", signal: ctl.signal, onRetry: (a) => retries.push(a) });
    expect(r).toBe("aborted");
    expect(fetches).toBe(1);
    expect(retries).toEqual([1]);
  });
  it("an already aborted signal never fetches", async () => {
    const ctl = new AbortController();
    ctl.abort();
    let fetches = 0;
    const r = await runRequest(async () => { fetches++; return res(200); }, async () => {}, { url: "/u", signal: ctl.signal });
    expect(r).toBe("aborted");
    expect(fetches).toBe(0);
  });
  it("hands the signal to fetch and to sleep; a fetch killed by the abort is not retried", async () => {
    const ctl = new AbortController();
    const seen: Array<AbortSignal | null | undefined> = [];
    const sleeps: Array<AbortSignal | undefined> = [];
    const fetchFn: FetchFn = async (_u, init) => {
      seen.push(init?.signal);
      if (seen.length === 1) throw new Error("x");
      ctl.abort();
      throw new DOMException("aborted", "AbortError");
    };
    const r = await runRequest(fetchFn, async (_ms, signal) => { sleeps.push(signal); }, {
      url: "/u", init: { method: "POST", body: "{}" }, signal: ctl.signal,
    });
    expect(r).toBe("aborted");
    expect(seen).toEqual([ctl.signal, ctl.signal]);
    expect(sleeps).toEqual([ctl.signal]);
  });
  it("lost response: network error, then 409 with the next turn, shows the next problem", async () => {
    const next: StepBody = { version: 5, turn: problem(2), line: line("hi") };
    const h = harness([new Error("lost"), res(409, next)]);
    const r = (await runRequest(h.fetchFn, h.sleep, { url: "/u" })) as Response;
    expect(r.status).toBe(409);
    const s = playReducer({ phase: "retrying", attempt: 1, version: 4, turn: problem(1) },
      { type: "conflict", body: (await r.json()) as StepBody });
    expect(s).toMatchObject({ phase: "problem", version: 5, line: line("hi"), message: undefined, correct: false });
    expect(s.attempt).toBeUndefined();
  });
});

const base: PlayState = { phase: "sending", version: 1, turn: problem(1), message: "old", note: "n", correct: true };
const answered = (over: Partial<AnswerBody> = {}): AnswerBody => ({
  version: 2, feedback: { result: { kind: "correct" }, then: "next", reveal: false },
  next: problem(2), line: line("Yes!"), nextLine: line("Next one"), ...over,
});

describe("playReducer", () => {
  it("409 adopts server turn and clears message", () => {
    const s = playReducer(base, { type: "conflict", body: { version: 3, turn: problem(3) } });
    expect(s).toMatchObject({ phase: "problem", version: 3, message: undefined, correct: false });
    expect(s.turn).toEqual(problem(3));
  });
  it("200 with nextLine sets line and message", () => {
    const s = playReducer(base, { type: "answered", body: answered() });
    expect(s).toMatchObject({ phase: "problem", version: 2, line: line("Next one"), message: "Yes!", correct: true });
  });
  it("200 with nextLine keeps the feedback line's tone for the hold", () => {
    const s = playReducer(base, { type: "answered", body: answered({ line: { say: "Yes!", tone: "cheer" } }) });
    expect(s).toMatchObject({ message: "Yes!", messageTone: "cheer", line: line("Next one") });
    const retry = playReducer(base, { type: "answered", body: answered({ nextLine: undefined, next: problem(1) }) });
    expect(retry.messageTone).toBeUndefined();
  });
  it("gone (401/404 after load) leaves the problem behind", () => {
    expect(playReducer(base, { type: "gone" })).toEqual({ phase: "gone" });
    expect(playReducer({ phase: "loading" }, { type: "gone" })).toEqual({ phase: "gone" });
  });
  it("200 retry keeps feedback line, clears message, wrong is not correct", () => {
    const b = answered({ nextLine: undefined, feedback: { result: { kind: "wrong" }, then: "retry", reveal: false }, next: problem(1) });
    const s = playReducer(base, { type: "answered", body: b });
    expect(s).toMatchObject({ phase: "problem", line: line("Yes!"), message: undefined, correct: false });
  });
  it("sets reveal note", () => {
    const b = answered({ feedback: { result: { kind: "wrong" }, then: "next", reveal: true }, revealed: 7 });
    expect(playReducer(base, { type: "answered", body: b }).note).toBe("The answer is 7.");
  });
  it("end turn goes to ended, keeping the feedback line", () => {
    const summary = { problems: 5, firstTryCorrect: 3 } as never;
    const s = playReducer(base, { type: "answered", body: answered({ next: { kind: "end", summary } as never, nextLine: undefined }) });
    expect(s).toMatchObject({ phase: "ended", summary, line: line("Yes!") });
  });
  it("loaded end turn goes to ended", () => {
    const summary = { problems: 1, firstTryCorrect: 1 } as never;
    expect(playReducer({ phase: "loading" }, { type: "loaded", body: { version: 1, turn: { kind: "end", summary } as never } }))
      .toMatchObject({ phase: "ended", summary });
  });
  it("an end turn with rewards puts them on state; without, rewards is undefined", () => {
    const summary = { problems: 2, firstTryCorrect: 1 } as never;
    const rewards = { xp: 40, levelBefore: 1, levelAfter: 1, cubesBefore: 0, cubesAfter: 0, newStickers: [],
      week: { days: [true, false, false, false, false, false, false], played: 1, goalMet: false } };
    const loaded = playReducer({ phase: "loading" }, { type: "loaded", body: { version: 1, turn: { kind: "end", summary, rewards } as never } });
    expect(loaded.rewards).toEqual(rewards);
    const answeredEnd = playReducer(base, { type: "answered", body: answered({ next: { kind: "end", summary, rewards } as never, nextLine: undefined }) });
    expect(answeredEnd.rewards).toEqual(rewards);
    expect(playReducer({ phase: "loading" }, { type: "loaded", body: { version: 1, turn: { kind: "end", summary } as never } }).rewards).toBeUndefined();
    expect(playReducer(base, { type: "answered", body: answered({ next: { kind: "end", summary } as never, nextLine: undefined }) }).rewards).toBeUndefined();
  });
  it("send only from problem; retrying and offline keep the turn", () => {
    expect(playReducer({ phase: "problem", version: 1 }, { type: "send" }).phase).toBe("sending");
    for (const phase of ["sending", "retrying", "offline", "loading", "ended"] as const) {
      const s: PlayState = { phase };
      expect(playReducer(s, { type: "send" })).toBe(s);
    }
    const r = playReducer(base, { type: "retrying", attempt: 2 });
    expect(r).toMatchObject({ phase: "retrying", attempt: 2, turn: base.turn });
    expect(playReducer(r, { type: "offline" })).toMatchObject({ phase: "offline", turn: base.turn });
  });
});

describe("isGone", () => {
  it("401 and 404 mean the session or the kid is gone; 400 and 5xx do not", () => {
    expect(isGone(401)).toBe(true);
    expect(isGone(404)).toBe(true);
    for (const s of [200, 400, 409, 500, 503]) expect(isGone(s)).toBe(false);
  });
});
