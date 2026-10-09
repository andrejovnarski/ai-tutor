import { SKILLS } from "../curriculum/index";
import { isMastered } from "../kid/bkt";
import { newKidState } from "../kid/state";
import type { KidState } from "../kid/types";
import { createRng } from "../rng";
import { simulate, type BotProfile } from "./bot";

const idx = (id: string) => SKILLS.findIndex((s) => s.id === id);
const prefix = (k: number) => new Set(SKILLS.slice(0, k).map((s) => s.id));
const placedThrough = (n: number, also: string[] = []): KidState => {
  const k = newKidState("bot", "5-7", "K");
  const skills = { ...k.skills };
  for (const s of SKILLS.slice(0, n)) skills[s.id] = { ...skills[s.id]!, pKnown: 0.95, placed: true, level: 2 };
  for (const id of also) skills[id] = { ...skills[id]!, pKnown: 0.95, placed: true, level: 2 };
  return { ...k, skills, placed: true };
};
const bot = (p: Partial<BotProfile> & { knows: Set<string> }): BotProfile => ({ slip: 0, guess: 0, learn: 0, ...p });

describe("placement accuracy", () => {
  it.each([0, 6, 12, 20, 28])("noiseless bot knowing %i skills is placed within 3", (k) => {
    const r = simulate(bot({ knows: prefix(k) }), { grade: "K", ageBand: "5-7", seed: 1, problems: 10 });
    expect(Math.abs(r.placementIndex - k)).toBeLessThanOrEqual(3);
  });

  it("noisy bots: median error ≤ 4", () => {
    const errors: number[] = [];
    for (let seed = 0; seed < 20; seed++) {
      const k = createRng(seed).int(0, 30);
      const r = simulate(bot({ knows: prefix(k), slip: 0.1, guess: 0.25 }), { grade: "K", ageBand: "5-7", seed, problems: 10 });
      errors.push(Math.abs(r.placementIndex - k));
    }
    errors.sort((a, b) => a - b);
    expect(errors[10]!).toBeLessThanOrEqual(4);
  });
});

it("steps back to a missing prerequisite", () => {
  const knows = prefix(idx("add-within-10.missing"));
  knows.delete("add-within-10.make-ten");
  const r = simulate(bot({ knows, guess: 0.25 }), { grade: "K", ageBand: "5-7", seed: 3, problems: 200, kid: placedThrough(idx("add-within-10.missing")) });
  expect(r.logs).toContainEqual(expect.objectContaining({ type: "step-back", skillId: "add-within-10.make-ten" }));
});

it("a learner masters at least 3 skills by real attempts in 200 problems", () => {
  const r = simulate(bot({ knows: prefix(5), learn: 0.3, slip: 0.05, guess: 0.25 }), { grade: "K", ageBand: "5-7", seed: 5, problems: 200 });
  const earned = Object.values(r.kid.skills).filter((s) => isMastered(s) && !s.placed);
  expect(earned.length).toBeGreaterThanOrEqual(3);
});

it("about 80% first-try correct across a population", () => {
  let right = 0;
  let total = 0;
  for (let seed = 0; seed < 20; seed++) {
    const k = createRng(100 + seed).int(0, 25);
    const r = simulate(bot({ knows: prefix(k), learn: 0.2, slip: 0.08, guess: 0.25 }), { grade: "K", ageBand: "5-7", seed, problems: 200 });
    right += r.firstTryRate * r.firstTries;
    total += r.firstTries;
  }
  const rate = right / total;
  expect(rate).toBeGreaterThanOrEqual(0.65);
  expect(rate).toBeLessThanOrEqual(0.92);
});

it("the loop guard holds: never more than 3 step-backs in a row", () => {
  const r = simulate(bot({ knows: prefix(6), guess: 0.25 }), { grade: "K", ageBand: "5-7", seed: 9, problems: 200, kid: placedThrough(26) });
  let run = 0;
  for (const e of r.trace) {
    if (e === "step-back") run++;
    else run = 0;
    expect(run).toBeLessThanOrEqual(3);
  }
  expect(r.trace).toContain("loop-guard");
  expect(r.trace.filter((e) => e === "end").length).toBeGreaterThan(0);
});

it("a counting habit pulls explanations toward the number line", () => {
  const skill = "add-within-10.make-ten";
  const kid = placedThrough(idx(skill));
  const share = (habit: "off-by-one-counting" | "gave-total") => {
    const r = simulate(bot({ knows: prefix(idx(skill)), habit }), { grade: "K", ageBand: "5-7", seed: 11, problems: 200, kid });
    const styles = r.explanations.filter((e) => e.skillId === skill).map((e) => e.style);
    return styles.filter((s) => s === "number-line").length / styles.length;
  };
  expect(share("off-by-one-counting")).toBeGreaterThan(share("gave-total") + 0.2);
});
