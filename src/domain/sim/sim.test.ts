import { nextTurn } from "../session/engine";
import { fresh, placedKid, type ProblemTurn } from "../session/testkit";
import { SKILLS } from "../curriculum/index";
import { isMastered } from "../kid/bkt";
import { newKidState } from "../kid/state";
import type { KidState } from "../kid/types";
import { createRng } from "../rng";
import { makeBot, simulate, type BotProfile } from "./bot";

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
      // Match grade to knowledge so the capped search starts near realistic prior skills.
      const grade = k <= 12 ? "K" : k <= 23 ? "1" : "2";
      const r = simulate(bot({ knows: prefix(k), slip: 0.1, guess: 0.25 }), { grade, ageBand: "5-7", seed, problems: 10 });
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

it("a bot stuck on 30% of first tries masters no more skills by asking for help than by answering wrong", () => {
  const totals = { help: 0, wrong: 0 };
  for (let seed = 0; seed < 10; seed++) {
    for (const action of ["help", "wrong"] as const) {
      const r = simulate(bot({ knows: prefix(5), learn: 0.3, slip: 0.05, guess: 0.25,
        stuck: { share: 0.3, action } }), { grade: "K", ageBand: "5-7", seed, problems: 200 });
      totals[action] += Object.values(r.kid.skills).filter(isMastered).length;
    }
  }
  expect(totals.help).toBeLessThanOrEqual(totals.wrong);
});

it("the stuck profile requests help only on first tries", () => {
  const turn = nextTurn(fresh(placedKid([])), 0).turn as ProblemTurn;
  const b = makeBot(bot({ knows: prefix(30), stuck: { share: 1, action: "help" } }), 1);
  expect(b.respond(turn)).toBe("help");
  expect(b.respond({ ...turn, try: 2 })).toBe(turn.problem.answer);
});

it("Remembering bot with dayGap 1 reaches checkStep 3", () => {
  const r = simulate(bot({ knows: prefix(SKILLS.length) }), { grade: "K", ageBand: "5-7", seed: 8, problems: 4000, kid: placedThrough(SKILLS.length), dayGap: 1 });
  expect(Object.values(r.kid.skills).some((s) => s.checkStep === 3)).toBe(true);
});

it("Forget on day N: recalled forgotten skills lose mastery and are practiced again", () => {
  // Isolate each forgotten skill so a struggling prerequisite cannot see it before its recall.
  for (const id of [...prefix(3)]) {
    const r = simulate(bot({ knows: prefix(SKILLS.length), forget: { day: 2, skills: [id] } }),
      { grade: "K", ageBand: "5-7", seed: 8, problems: 600, kid: placedThrough(SKILLS.length), dayGap: 21 });
    const index = r.learningTrace.findIndex((e) => e.kind === "recall" && e.skillId === id && e.results.every((ok) => !ok));
    expect(index).toBeGreaterThanOrEqual(0);
    expect(r.learningTrace[index]).toMatchObject({ kind: "recall", mastered: false });
    expect(r.learningTrace.slice(index + 1)).toContainEqual({ kind: "practice", skillId: id });
    expect(isMastered(r.kid.skills[id]!)).toBe(false);
  }
});

it("Slip bot never loses mastery from a recall with one miss", () => {
  const r = simulate(bot({ knows: prefix(SKILLS.length), slip: 0.1 }), { grade: "K", ageBand: "5-7", seed: 8, problems: 1500, kid: placedThrough(SKILLS.length) });
  const partials = r.learningTrace.filter((e) => e.kind === "recall" && e.results[0] !== e.results[1]);
  expect(partials.length).toBeGreaterThan(0);
  for (const e of partials) {
    expect(e).toMatchObject({ mastered: true });
    if (e.kind === "recall") expect(e.pKnownAfter).toBe(e.pKnownBefore);
  }
});
