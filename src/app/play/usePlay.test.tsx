import { beforeEach, describe, expect, it, vi } from "vitest";

// No DOM in the test environment, so React's hooks are replaced by a minimal runtime: slots persist across
// renders, effects run after each render, and dispatching marks the hook dirty until the next render().
const rt = vi.hoisted(() => ({ slots: [] as unknown[], i: 0, effects: [] as Array<() => void>, dirty: false }));
vi.mock("react", () => ({
  useRef: (init: unknown) => { const k = rt.i++; return (rt.slots[k] ??= { current: init }); },
  useReducer: (reducer: (s: unknown, e: unknown) => unknown, init: unknown) => {
    const k = rt.i++;
    rt.slots[k] ??= { state: init, dispatch: (e: unknown) => { (rt.slots[k] as { state: unknown }).state = reducer((rt.slots[k] as { state: unknown }).state, e); rt.dirty = true; } };
    const s = rt.slots[k] as { state: unknown; dispatch: (e: unknown) => void };
    return [s.state, s.dispatch];
  },
  useCallback: (fn: unknown) => fn,
  useEffect: (fn: () => void) => { rt.effects.push(fn); },
}));

import { usePlay } from "./usePlay";
import type { FetchFn } from "./playMachine";

const problemBody = { version: 1, turn: { kind: "problem", mode: "practice", try: 1, prompt: { say: "Q" }, input: "number-pad" } };
const endBody = { version: 5, turn: { kind: "end", summary: { problems: 2, firstTryCorrect: 1 } } };
const json = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function mount(script: Response[]) {
  const urls: string[] = [];
  const requests: RequestInit[] = [];
  let n = 0;
  const net = { down: false };
  const fetch: FetchFn = async (u, init) => {
    requests.push(init ?? {});
    urls.push(String(u));
    if (net.down) throw new Error("down");
    return script[Math.min(n++, script.length - 1)]!.clone();
  };
  let api!: ReturnType<typeof usePlay>;
  const render = () => { rt.i = 0; rt.effects = []; rt.dirty = false; api = usePlay("kid1", { fetch, sleep: async () => {} }); return api; };
  const settle = async () => { for (let k = 0; k < 20; k++) { await new Promise((r) => setTimeout(r, 0)); if (rt.dirty) render(); } };
  render();
  rt.effects.forEach((e) => e()); // mount
  return { urls, requests, net, settle, get api() { return api; } };
}

describe("usePlay play-again", () => {
  beforeEach(() => { rt.slots = []; rt.i = 0; rt.effects = []; rt.dirty = false; });

  it("playAgain posts to /play-again and shows the new problem", async () => {
    const h = mount([json(200, endBody), json(200, problemBody)]);
    await h.settle();
    expect(h.api.state.phase).toBe("ended");
    h.api.playAgain();
    await h.settle();
    expect(h.urls).toEqual(["/api/kids/kid1/turn", "/api/kids/kid1/play-again"]);
    expect(h.api.state.phase).toBe("problem");
  });

  it("retry after an offline playAgain posts to /play-again, not /turn, and recovers", async () => {
    const h = mount([json(200, endBody), json(200, problemBody)]);
    await h.settle();
    h.net.down = true;
    h.api.playAgain();
    await h.settle();
    expect(h.api.state.phase).toBe("offline");
    const before = h.urls.length;
    h.net.down = false;
    h.api.retry();
    await h.settle();
    expect(h.urls.slice(before)).toEqual(["/api/kids/kid1/play-again"]);
    expect(h.api.state.phase).toBe("problem");
  });

  it("once playAgain succeeded, an answer that goes offline retries /turn", async () => {
    const h = mount([json(200, endBody), json(200, problemBody)]);
    await h.settle();
    h.api.playAgain();
    await h.settle();
    expect(h.api.state.phase).toBe("problem");
    h.net.down = true;
    void h.api.answer(5);
    await h.settle();
    expect(h.api.state.phase).toBe("offline");
    const before = h.urls.length;
    h.net.down = false;
    h.api.retry();
    await h.settle();
    expect(h.urls.slice(before)).toEqual(["/api/kids/kid1/turn"]);
  });
});

describe("usePlay help", () => {
  beforeEach(() => { rt.slots = []; rt.i = 0; rt.effects = []; rt.dirty = false; });
  const helped = { version: 2, feedback: { result: { kind: "helped" }, then: "retry", reveal: false },
    next: { ...problemBody.turn, try: 2, help: 1 }, line: { say: "Count together.", tone: "calm" } };
  it("posts only the version and applies the helped answer body", async () => {
    const h = mount([json(200, problemBody), json(200, helped)]);
    await h.settle();
    await h.api.help();
    await h.settle();
    expect(h.urls.at(-1)).toBe("/api/kids/kid1/help");
    expect(h.requests.at(-1)).toMatchObject({ method: "POST", body: JSON.stringify({ version: 1 }) });
    expect(h.api.state).toMatchObject({ phase: "problem", version: 2, correct: false, turn: helped.next, line: helped.line });
  });
  it("ignores help during loading, ended, and an answer in flight", async () => {
    const h = mount([json(200, problemBody), json(200, helped)]);
    await h.api.help();
    expect(h.urls).toHaveLength(1);
    await h.settle();
    const pending = h.api.answer(5);
    await h.api.help();
    expect(h.urls).toEqual(["/api/kids/kid1/turn", "/api/kids/kid1/answer"]);
    await pending;
    await h.settle();
    rt.slots = [];
    const ended = mount([json(200, endBody)]);
    await ended.settle();
    await ended.api.help();
    expect(ended.urls).toHaveLength(1);
  });
  it("ignores a second same-tick help tap", async () => {
    const h = mount([json(200, problemBody), json(200, helped)]);
    await h.settle();
    await Promise.all([h.api.help(), h.api.help()]);
    expect(h.urls).toHaveLength(2);
  });
  it("uses the current turn on conflict", async () => {
    const current = { ...problemBody, version: 3, turn: helped.next };
    const h = mount([json(200, problemBody), json(409, current)]);
    await h.settle();
    await h.api.help();
    await h.settle();
    expect(h.api.state).toMatchObject({ phase: "problem", version: 3, turn: current.turn });
  });
  it("goes offline and ignores further help until recovery", async () => {
    const h = mount([json(200, problemBody)]);
    await h.settle();
    h.net.down = true;
    await h.api.help();
    await h.settle();
    expect(h.api.state.phase).toBe("offline");
    const before = h.urls.length;
    await h.api.help();
    expect(h.urls).toHaveLength(before);
  });
});
