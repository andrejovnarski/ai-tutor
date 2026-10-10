import { describe, expect, it } from "vitest";
import { micEffect, micReducer, type MicEvent, type MicState } from "./micMachine";

const idle: MicState = { phase: "idle", failures: 0, hidden: false };
const run = (s: MicState, ...evs: MicEvent[]) => evs.reduce(micReducer, s);
const listening = run(idle, { type: "start", version: 3 });

describe("micReducer", () => {
  it("start gives listening and keeps the version; hidden stays idle", () => {
    expect(listening).toMatchObject({ phase: "listening", version: 3 });
    expect(micReducer({ ...idle, hidden: true }, { type: "start", version: 3 }).phase).toBe("idle");
  });
  it("ignores start while busy", () => {
    expect(micReducer(listening, { type: "start", version: 4 })).toBe(listening);
  });
  it("answer result for the same version gives idle + answer effect", () => {
    const t = run(listening, { type: "sent" });
    expect(t.phase).toBe("thinking");
    const n = micReducer(t, { type: "result", version: 3, heard: "seven", route: { kind: "answer", n: 7 } });
    expect(n.phase).toBe("idle");
    expect(micEffect(t, n)).toEqual({ answer: 7 });
  });
  it("result for a different version gives idle with no effect", () => {
    const t = run(listening, { type: "sent" });
    const n = micReducer(t, { type: "result", version: 2, heard: "seven", route: { kind: "answer", n: 7 } });
    expect(n.phase).toBe("idle");
    expect(micEffect(t, n)).toBeNull();
  });
  it("confirm then yes gives one answer effect, even if yes repeats", () => {
    const c = micReducer(run(listening, { type: "sent" }), { type: "result", version: 3, heard: "sebben", route: { kind: "confirm", n: 7 } });
    expect(c).toMatchObject({ phase: "confirm", n: 7, heard: "sebben" });
    const y = micReducer(c, { type: "yes" });
    expect(y.phase).toBe("idle");
    expect(micEffect(c, y)).toEqual({ answer: 7 });
    const y2 = micReducer(y, { type: "yes" });
    expect(micEffect(y, y2)).toBeNull();
  });
  it("no gives idle with the retry notice", () => {
    const c = micReducer(listening, { type: "result", version: 3, heard: "x", route: { kind: "confirm", n: 7 } });
    const n = micReducer(c, { type: "no" });
    expect(n).toMatchObject({ phase: "idle", notice: "Let's try again." });
    expect(micEffect(c, n)).toBeNull();
  });
  it("say route gives idle + say effect, heard kept", () => {
    const n = micReducer(listening, { type: "result", version: 3, heard: "I am sad", route: { kind: "say", text: "I am sad" } });
    expect(n).toMatchObject({ phase: "idle", heard: "I am sad" });
    expect(micEffect(listening, n)).toEqual({ say: "I am sad" });
  });
  it("nothing (event or route) gives the notice", () => {
    const msg = "I didn't catch that. Try again or tap your answer.";
    expect(micReducer(listening, { type: "nothing" })).toMatchObject({ phase: "idle", notice: msg });
    const n = micReducer(listening, { type: "result", version: 3, heard: "", route: { kind: "nothing" } });
    expect(n).toMatchObject({ phase: "idle", notice: msg });
    expect(micEffect(listening, n)).toBeNull();
  });
  it("failed once notices; twice hides; success resets", () => {
    const f1 = micReducer(listening, { type: "failed" });
    expect(f1).toMatchObject({ phase: "idle", notice: "I couldn't hear. Tap your answer.", failures: 1, hidden: false });
    const f2 = run(f1, { type: "start", version: 3 }, { type: "failed" });
    expect(f2.hidden).toBe(true);
    const ok = run(f1, { type: "start", version: 3 }, { type: "nothing" }, { type: "start", version: 3 }, { type: "failed" });
    expect(ok).toMatchObject({ failures: 1, hidden: false });
  });
  it("denied hides", () => {
    expect(micReducer(listening, { type: "denied" })).toMatchObject({ phase: "idle", hidden: true });
  });
  it("problem with a new version clears heard, n, notice but keeps failures", () => {
    const s: MicState = { phase: "idle", version: 3, heard: "x", n: 4, notice: "hi", failures: 1, hidden: false };
    expect(micReducer(s, { type: "problem", version: 4 })).toEqual({ phase: "idle", version: 4, failures: 1, hidden: false });
  });
  it("cancel gives idle, no effect, notice cleared", () => {
    const s = { ...listening, notice: "old" };
    const n = micReducer(s, { type: "cancel" });
    expect(n).toMatchObject({ phase: "idle" });
    expect(n.notice).toBeUndefined();
    expect(micEffect(s, n)).toBeNull();
  });
});
