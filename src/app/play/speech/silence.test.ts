import { describe, expect, it } from "vitest";
import { RECORD_BACKSTOP_MS, gateStep, rms, type GateState } from "./silence";

const LOUD = 0.1;
const QUIET = 0.001;

/** Feeds frames of 50 ms; returns the ms at which a verdict other than go/none came, or null. */
function run(pattern: Array<[number, number]>) {
  let s: GateState = { ms: 0, speechMs: 0, quietMs: 0, started: false };
  for (const [level, frames] of pattern) {
    for (let i = 0; i < frames; i++) {
      const r = gateStep(s, level, 50);
      s = r.s;
      if (r.verdict === "stop" || r.verdict === "nothing") return { verdict: r.verdict, ms: s.ms };
    }
  }
  return { verdict: "none", ms: s.ms };
}

describe("rms", () => {
  it("is 0 for silence and the level for a constant", () => {
    expect(rms(new Float32Array(10))).toBe(0);
    expect(rms(new Float32Array(10).fill(0.5))).toBeCloseTo(0.5, 5);
    expect(rms(new Float32Array(0))).toBe(0);
  });
});

describe("gateStep", () => {
  it("gives nothing after 6 s of quiet", () => {
    expect(run([[QUIET, 200]])).toEqual({ verdict: "nothing", ms: 6000 });
  });
  it("stops 1 s after speech ends", () => {
    expect(run([[LOUD, 2], [QUIET, 200]])).toEqual({ verdict: "stop", ms: 1100 });
  });
  it("ignores a blip under 100 ms", () => {
    expect(run([[LOUD, 1], [QUIET, 200]])).toEqual({ verdict: "nothing", ms: 6000 });
  });
  it("hard-stops at 6 s when loud throughout", () => {
    expect(run([[LOUD, 200]])).toEqual({ verdict: "stop", ms: 6000 });
  });
  it("keeps going while recording, and marks speech started after 100 ms", () => {
    let s: GateState = { ms: 0, speechMs: 0, quietMs: 0, started: false };
    let r = gateStep(s, LOUD, 50);
    expect(r).toMatchObject({ verdict: "go", s: { started: false } });
    r = gateStep(r.s, LOUD, 50);
    expect(r).toMatchObject({ verdict: "go", s: { started: true } });
  });
});

describe("RECORD_BACKSTOP_MS", () => {
  it("is later than the 6 s hard stop", () => expect(RECORD_BACKSTOP_MS).toBeGreaterThan(6000));
});
