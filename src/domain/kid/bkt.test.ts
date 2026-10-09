import type { Problem } from "../types";
import { BKT_DEFAULTS, bktParams, bktUpdate, guessFor, isMastered } from "./bkt";
import type { SkillState } from "./types";

const P = BKT_DEFAULTS;

it("correct answer from prior", () => expect(bktUpdate(0.2, true, P, 0.25)).toBeCloseTo(0.552632, 5));
it("wrong answer from prior", () => expect(bktUpdate(0.2, false, P, 0.25)).toBeCloseTo(0.177419, 5));

it("three correct on 4 choices pass 0.95", () => {
  let p = P.prior;
  for (let i = 0; i < 3; i++) p = bktUpdate(p, true, P, 0.25);
  expect(p).toBeGreaterThan(0.95);
});

it("stays in (0, 1)", () => {
  for (const c of [true, false]) for (const p of [0.001, 0.5, 0.999]) {
    const q = bktUpdate(p, c, P, 0.5);
    expect(q).toBeGreaterThan(0);
    expect(q).toBeLessThan(1);
  }
});

it("guessFor by input", () => {
  const base: Problem = { prompt: { say: "", show: { kind: "equation", text: "" } }, answer: 1, mistakes: [], input: "tap-choice" };
  expect(guessFor({ ...base, input: "number-pad", choices: [1, 2, 3, 4] })).toBe(0.05);
  expect(guessFor({ ...base, choices: [1, 2] })).toBe(0.5);
  expect(guessFor({ ...base, choices: [1, 2, 3, 4] })).toBe(0.25);
  expect(guessFor(base)).toBe(0.05);
});

it("mastered needs 0.95 and 5 attempts, or placement", () => {
  const s: SkillState = { skillId: "x", pKnown: 0.96, attempts: 4, level: 1, correctStreak: 0, wrongStreak: 0, lastSeen: null, placed: false, recentTags: [] };
  expect(isMastered(s)).toBe(false);
  expect(isMastered({ ...s, attempts: 5 })).toBe(true);
  expect(isMastered({ ...s, placed: true })).toBe(true);
  expect(isMastered({ ...s, attempts: 9, pKnown: 0.94 })).toBe(false);
});

it("bktParams merges overrides over defaults", () => expect(bktParams("count-to-20.objects-to-10")).toEqual(BKT_DEFAULTS));
