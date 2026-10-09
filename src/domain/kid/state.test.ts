import { SKILLS } from "../curriculum/index";
import type { MistakeTag } from "../types";
import { applyFirstTry, newKidState, resetStruggle } from "./state";
import type { SkillState } from "./types";

const fresh = (): SkillState => newKidState("k1", "5-7", "K").skills["count-to-20.objects-to-10"]!;
const right = { correct: true, tag: null, guess: 0.25, now: 1000 } as const;
const wrong = (tag: MistakeTag | null = null) => ({ correct: false, tag, guess: 0.25, now: 1000 });
const run = (s: SkillState, outcomes: Parameters<typeof applyFirstTry>[1][]) => outcomes.reduce(applyFirstTry, s);

it("new kid has every skill at the prior and every style at zero", () => {
  const k = newKidState("k1", "8-11", "2");
  expect(Object.keys(k.skills)).toHaveLength(SKILLS.length);
  expect(Object.values(k.skills).every((s) => s.pKnown === 0.2 && s.level === 1 && !s.placed && s.lastSeen === null)).toBe(true);
  expect(Object.values(k.styles)).toHaveLength(5);
  expect(Object.values(k.styles).every((s) => s.tries === 0 && s.wins === 0)).toBe(true);
  expect(k.placed).toBe(false);
});

it("3 correct in a row raise the level, capped at 3", () => {
  let s = run(fresh(), [right, right, right]);
  expect([s.level, s.correctStreak, s.wrongStreak]).toEqual([2, 0, 0]);
  s = run(s, [right, right, right]);
  expect(s.level).toBe(3);
  s = run(s, [right, right, right]);
  expect(s.level).toBe(3);
});

it("2 wrong in a row lower the level; at level 1 the wrong streak stays", () => {
  let s: SkillState = { ...fresh(), level: 3 };
  s = run(s, [wrong(), wrong()]);
  expect([s.level, s.wrongStreak]).toEqual([2, 0]);
  s = run(s, [wrong(), wrong()]);
  expect(s.level).toBe(1);
  s = run(s, [wrong(), wrong()]);
  expect([s.level, s.wrongStreak]).toEqual([1, 2]);
});

it("a correct answer resets the wrong streak and vice versa", () => {
  expect(run(fresh(), [wrong(), right]).wrongStreak).toBe(0);
  expect(run(fresh(), [right, right, wrong()]).correctStreak).toBe(0);
});

it("recentTags keeps the last 4 first tries", () => {
  const s = run(fresh(), [wrong("gave-total"), wrong("gave-part"), right, wrong("off-by-ten"), wrong("dropped-zero")]);
  expect(s.recentTags).toEqual(["gave-part", null, "off-by-ten", "dropped-zero"]);
});

it("updates attempts, lastSeen and pKnown", () => {
  const s = applyFirstTry(fresh(), { ...right, now: 4242 });
  expect(s.attempts).toBe(1);
  expect(s.lastSeen).toBe(4242);
  expect(s.pKnown).toBeCloseTo(0.552632, 5);
});

it("does not mutate its input", () => {
  const s = fresh();
  const copy = structuredClone(s);
  applyFirstTry(s, wrong("gave-total"));
  expect(s).toEqual(copy);
});

it("resetStruggle clears the wrong streak and tags", () => {
  const s = resetStruggle(run(fresh(), [wrong("gave-total"), wrong("gave-total")]));
  expect([s.wrongStreak, s.recentTags]).toEqual([0, []]);
});
