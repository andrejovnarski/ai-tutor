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
  let n = 0;
  const net = { down: false };
  const fetch: FetchFn = async (u) => {
    urls.push(String(u));
    if (net.down) throw new Error("down");
    return script[Math.min(n++, script.length - 1)]!.clone();
  };
  let api!: ReturnType<typeof usePlay>;
  const render = () => { rt.i = 0; rt.effects = []; rt.dirty = false; api = usePlay("kid1", { fetch, sleep: async () => {} }); return api; };
  const settle = async () => { for (let k = 0; k < 20; k++) { await new Promise((r) => setTimeout(r, 0)); if (rt.dirty) render(); } };
  render();
  rt.effects.forEach((e) => e()); // mount
  return { urls, net, settle, get api() { return api; } };
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
