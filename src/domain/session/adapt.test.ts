import { SKILLS } from "../curriculum/index";
import { MIN, SEC, firstSkills, fresh, placedKid, play, rightFor, setSkill, wrongFor, type ProblemTurn, type Step } from "./testkit";

const idx = (id: string) => SKILLS.findIndex((s) => s.id === id);
const problems = (steps: Step[]) => steps.filter((x): x is Step & { turn: ProblemTurn } => x.turn.kind === "problem");
const firstTries = (steps: Step[]) => problems(steps).filter((x) => x.turn.try === 1);
const logs = (steps: Step[]) => problems(steps).flatMap((x) => [...x.turn.logs, ...(x.feedback?.logs ?? [])]);

it("every 5th problem reviews the oldest mastered skill", () => {
  let kid = placedKid(firstSkills(3));
  kid = setSkill(kid, "count-to-20.objects-to-10", { lastSeen: 50 });
  kid = setSkill(kid, "count-to-20.objects-to-20", { lastSeen: 10 });
  kid = setSkill(kid, "count-to-20.number-after", { lastSeen: 30 });
  const { steps } = play(fresh(kid), 1000, rightFor);
  const served = firstTries(steps).filter((x) => x.turn.mode === "practice" || x.turn.mode === "review");
  served.forEach((x, i) => expect(x.turn.mode).toBe((i + 1) % 5 === 0 ? "review" : "practice"));
  expect(served[4]!.turn.skillId).toBe("count-to-20.objects-to-20");
});

it("a wrong review lowers pKnown", () => {
  const { steps } = play(fresh(placedKid(firstSkills(3))), 0, (t) => (t.mode === "review" ? wrongFor(t) : rightFor(t)), { max: 8 });
  const review = firstTries(steps).find((x) => x.turn.mode === "review")!;
  const st = review.writes!.skillStates.find((s) => s.skillId === review.turn.skillId)!;
  expect(st.pKnown).toBeLessThan(0.95);
});

describe("struggling on add-within-10.missing", () => {
  const kid = () => placedKid(firstSkills(idx("add-within-10.missing")));

  it("fails the check on make-ten → steps back to it", () => {
    let checks = 0;
    const { steps } = play(fresh(kid()), 0, (t) => {
      if (t.mode === "check") return checks++ === 0 ? wrongFor(t) : rightFor(t);
      if (t.skillId === "add-within-10.missing") return wrongFor(t);
      return rightFor(t);
    }, { max: 12 });
    const check = problems(steps).filter((x) => x.turn.mode === "check");
    expect(check[0]!.turn).toMatchObject({ skillId: "add-within-10.make-ten", level: 1 });
    expect(check[0]!.feedback).toMatchObject({ then: "next", reveal: true });
    expect(logs(steps)).toContainEqual(expect.objectContaining({ type: "step-back", skillId: "add-within-10.make-ten" }));
    const after = firstTries(steps).slice(firstTries(steps).indexOf(check[0]!) + 1).filter((x) => x.turn.mode === "practice");
    expect(after[0]!.turn.skillId).toBe("add-within-10.make-ten");
  });

  it("passes the check → stays and switches style", () => {
    const { steps } = play(fresh(kid()), 0, (t) => (t.skillId === "add-within-10.missing" ? wrongFor(t) : rightFor(t)), { max: 14 });
    expect(problems(steps).filter((x) => x.turn.mode === "check").length).toBeGreaterThanOrEqual(2); // kid keeps failing: more checks later
    expect(logs(steps)).toContainEqual(expect.objectContaining({ type: "check-passed" }));
    const practice = firstTries(steps).filter((x) => x.turn.mode === "practice");
    expect(practice.every((x) => x.turn.skillId === "add-within-10.missing")).toBe(true);
    const styles = practice.map((x) => x.feedback!.style);
    const checkAt = steps.findIndex((x) => x.turn.kind === "problem" && x.turn.mode === "check");
    const before = practice.filter((x) => steps.indexOf(x) < checkAt).at(-1)!.feedback!.style;
    const afterStyle = practice.find((x) => steps.indexOf(x) > checkAt)!.feedback!.style;
    expect(afterStyle).not.toBe(before);
    expect(styles.length).toBeGreaterThan(2);
  });
});

it("the same mistake tag twice triggers a check, even at level 2", () => {
  let kid = placedKid(firstSkills(idx("compare-numbers.to-10")));
  kid = setSkill(kid, "compare-numbers.to-10", { level: 2 });
  const { steps } = play(fresh(kid), 0, (t) => (t.mode === "practice" ? t.problem.mistakes[0]!.answer : rightFor(t)), { max: 6 });
  expect(problems(steps).some((x) => x.turn.mode === "check" && x.turn.skillId === "compare-numbers.groups")).toBe(true);
});

it.each(Array.from({ length: 20 }, (_, i) => [i]))("struggling on the entry skill: no check, no step-back, new style (Review Focus 5) — seed %i", (seed) => {
  const { steps } = play(fresh(placedKid([]), seed), 0, (t, i) => (i < 4 ? wrongFor(t) : rightFor(t)), { max: 6 });
  expect(problems(steps).some((x) => x.turn.mode === "check")).toBe(false);
  expect(logs(steps).some((l) => l.type === "step-back")).toBe(false);
  const [a, b] = firstTries(steps).map((x) => x.feedback!.style);
  expect(a).not.toBeNull();
  expect(b).not.toBe(a);
});

it("loop guard: at most 3 step-backs in a row, then an easy review ending on a win", () => {
  const start = idx("add-subtract-within-100.add-regroup");
  const { steps } = play(fresh(placedKid(firstSkills(start))), 0, (t) => (idx(t.skillId) > 5 ? wrongFor(t) : rightFor(t)));
  const l = logs(steps);
  expect(l.filter((x) => x.type === "step-back")).toHaveLength(3);
  expect(l.some((x) => x.type === "loop-guard")).toBe(true);
  const wind = problems(steps).filter((x) => x.turn.mode === "wind-down");
  expect(wind.length).toBeGreaterThan(0);
  expect(wind.every((x) => x.turn.skillId === SKILLS[0]!.id && x.turn.level === 1)).toBe(true);
  expect(steps.at(-1)!.turn.kind).toBe("end");
  expect(problems(steps).at(-1)!.feedback!.result.kind).toBe("correct");
});

it("mastering the frontier moves on to the next skill", () => {
  const { steps } = play(fresh(placedKid(firstSkills(3))), 0, rightFor, { max: 12 });
  const practice = firstTries(steps).filter((x) => x.turn.mode === "practice");
  const n = practice.findIndex((x) => x.feedback!.mastered.includes("compare-numbers.groups"));
  expect(n + 1).toBeGreaterThanOrEqual(5);
  expect(n + 1).toBeLessThanOrEqual(8);
  expect(practice[n + 1]!.turn.skillId).toBe("compare-numbers.to-10");
});

it("everything mastered: only reviews, ends normally (Review Focus 4)", () => {
  const { steps, now } = play(fresh(placedKid(firstSkills(SKILLS.length))), 0, rightFor);
  expect(problems(steps).every((x) => x.turn.mode === "review" || x.turn.mode === "wind-down")).toBe(true);
  expect(steps.at(-1)!.turn.kind).toBe("end");
  expect(now).toBeLessThan(16 * MIN);
});

it("low accuracy: after 4 wrong of the last 10, an easy review at level 1", () => {
  const kid = placedKid(firstSkills(3));
  const { steps } = play(fresh(kid), 0, (t) => (t.mode === "practice" ? wrongFor(t) : rightFor(t)), { max: 30 });
  const ft = firstTries(steps).filter((x) => x.turn.mode === "practice" || x.turn.mode === "review");
  let wrong = 0;
  for (let i = 0; i < ft.length; i++) {
    if (wrong >= 4) {
      const window = ft.slice(i, i + 3);
      expect(window.some((x) => x.turn.mode === "review" && x.turn.level === 1 && x.turn.skillId === "count-to-20.objects-to-10")).toBe(true);
      return;
    }
    if (ft[i]!.feedback!.result.kind !== "correct") wrong++;
  }
  throw new Error("never reached 4 wrong");
});

it("past the max time, at most 3 wind-down problems, then the end", () => {
  const { steps } = play(fresh(placedKid(firstSkills(3))), 0, (t, i) => (i < 20 ? rightFor(t) : wrongFor(t)), { per: 40 * SEC });
  const wind = firstTries(steps).filter((x) => x.turn.mode === "wind-down");
  expect(wind.length).toBeLessThanOrEqual(3);
  expect(steps.at(-1)!.turn.kind).toBe("end");
});

it("a check that leaves the prerequisite mastered does not step back to it (number pad)", () => {
  // 8–11 on the number pad: guess 0.05, so one wrong check answer after a right one keeps pKnown ≥ 0.95.
  const kid = placedKid(firstSkills(idx("add-within-10.missing")), "8-11", "2");
  let checks = 0;
  const { steps } = play(fresh(kid), 0, (t) => {
    if (t.mode === "check") return checks++ % 2 === 0 ? rightFor(t) : wrongFor(t);
    if (t.skillId === "add-within-10.missing") return wrongFor(t);
    return rightFor(t);
  }, { max: 14 });
  expect(logs(steps).some((l) => l.type === "step-back")).toBe(false);
  const practice = firstTries(steps).filter((x) => x.turn.mode === "practice");
  expect(practice.every((x) => x.turn.skillId === "add-within-10.missing")).toBe(true);
});

it("practice never stays on a skill that is already mastered", () => {
  const kid = placedKid(firstSkills(4));
  const s = { ...fresh(kid), current: "count-to-20.objects-to-10" }; // stale pointer to a mastered skill
  const { steps } = play(s, 0, rightFor, { max: 3 });
  expect(problems(steps)[0]!.turn.skillId).toBe("compare-numbers.to-10");
});

it("the minimum-time end does not cut off a prerequisite check", () => {
  // Struggle (same tag twice) right around the 10-minute mark; retries and checks are answered right.
  const { steps } = play(fresh(placedKid(firstSkills(4))), 0, (t, i) =>
    (t.mode === "practice" && t.try === 1 && i >= 27 ? t.problem.mistakes[0]!.answer : rightFor(t)));
  const struggledAt = steps.findIndex((x, i) => i >= 27 && x.turn.kind === "problem" && x.turn.mode === "practice" && x.turn.try === 1);
  expect(struggledAt).toBeGreaterThan(0);
  expect(problems(steps).filter((x) => x.turn.mode === "check")).toHaveLength(2);
});
