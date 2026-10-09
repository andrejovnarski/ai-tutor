import { SKILLS } from "../../domain/curriculum";
import type { Feedback, Turn } from "../../domain/session/types";
import type { Problem } from "../../domain/types";
import { fillName, feedbackPlan, kidSaidPlan, presentPlan, visualNumbers } from "./plan";

type ProblemTurn = Extract<Turn, { kind: "problem" }>;
const skill = SKILLS[0]!;
const problem: Problem = {
  prompt: { say: "How many dots are there in all?", show: { kind: "ten-frames", first: 3, second: 4 } },
  answer: 7, input: "tap-choice", choices: [6, 7, 8], mistakes: [{ answer: 6, tag: "off-by-one-counting" }],
};
const turn = (mode: ProblemTurn["mode"] = "practice"): ProblemTurn => ({
  kind: "problem", problem, skillId: skill.id, templateId: "t", seed: 1, level: 1, mode, try: 1, logs: [],
});
const fb = (o: Partial<Feedback>): Feedback => ({
  result: { kind: "correct" }, then: "next", style: null, reveal: false, mastered: [], logs: [], ...o,
});

it("plans a present event with numbers from text and visual", () => {
  const p = presentPlan(turn(), "5-7", ["a", "b"]);
  expect(p).toMatchObject({ event: "present", ageBand: "5-7", skill: skill.name, answer: 7, recentLines: ["a", "b"] });
  expect(p.problem).toBe(problem.prompt.say);
  expect(p.problemNumbers).toEqual(expect.arrayContaining([3, 4]));
});

it("maps feedback to events", () => {
  expect(feedbackPlan(turn(), fb({}), 7, "5-7", []).event).toBe("correct");
  expect(feedbackPlan(turn(), fb({ mastered: ["x"] }), 7, "5-7", []).event).toBe("celebrate");
  const w = feedbackPlan(turn(), fb({ result: { kind: "known-mistake", tag: "off-by-one-counting" }, then: "retry", style: "blocks" }), 6, "5-7", []);
  expect(w).toMatchObject({ event: "wrong", mistakeTag: "off-by-one-counting", style: "blocks", kidAnswer: 6 });
  const e = feedbackPlan(turn(), fb({ result: { kind: "wrong" }, reveal: true }), 2, "5-7", []);
  expect(e).toMatchObject({ event: "explain", revealed: true });
  const h = feedbackPlan(turn("placement"), fb({ result: { kind: "known-mistake", tag: "off-by-one-counting" }, style: "blocks" }), 2, "5-7", []);
  expect(h.event).toBe("hint");
  expect(h.revealed).toBeFalsy();
  // A finished placement problem: the hint moves on, so there is no mistake or style to aim a clue at.
  expect(h.mistakeTag).toBeUndefined();
  expect(h.style).toBeUndefined();
});

it("trims kidSaid to 200 chars", () => {
  const p = kidSaidPlan(turn(), "x".repeat(300), "8-11", []);
  expect(p.event).toBe("kid-said");
  expect(p.kidSaid).toHaveLength(200);
});

it("never puts a nickname in a plan and fills names in code", () => {
  const all = [presentPlan(turn(), "5-7", []), feedbackPlan(turn(), fb({}), 7, "5-7", []), kidSaidPlan(turn(), "hi", "5-7", [])];
  expect(JSON.stringify(all)).not.toContain("Mia");
  expect(presentPlan.length).toBe(3);
  expect(fillName("Hi {name}!", "Mia")).toBe("Hi Mia!");
  expect(fillName("Hi {name}!", "")).toBe("Hi friend!");
});

it("collects visible components for every visual kind", () => {
  expect(visualNumbers({ kind: "objects", icon: "apple", groups: [3, 2], crossedOut: 1 }).sort()).toEqual([1, 2, 3]);
  expect(visualNumbers({ kind: "number-line", from: 0, to: 20, marks: [5, 10], jump: { from: 5, by: 3 } })).toEqual(expect.arrayContaining([0, 20, 5, 10, 3]));
  expect(visualNumbers({ kind: "blocks", groups: [{ tens: 4, ones: 3 }], crossedOut: { tens: 0, ones: 7 } })).toEqual(expect.arrayContaining([4, 3, 7]));
  expect(visualNumbers({ kind: "equation", text: "7 + _ = 10" })).toEqual(expect.arrayContaining([7, 10]));
  expect(visualNumbers({ kind: "story", text: "Ben has five cookies", icon: "cookie", groups: [5] })).toContain(5);
});

it("keeps the answer out of problemNumbers unless printed", () => {
  const mk = (show: Problem["prompt"]["show"], answer: number, say = "How many in all?"): ProblemTurn =>
    ({ ...turn(), problem: { ...problem, answer, prompt: { say, show } } });
  const cases: [Problem["prompt"]["show"], number][] = [
    [{ kind: "objects", icon: "apple", groups: [3, 4] }, 7],
    [{ kind: "ten-frames", first: 3, second: 4 }, 7],
    [{ kind: "story", text: "Ann has some apples", icon: "apple", groups: [2, 5] }, 7],
    [{ kind: "number-line", from: 0, to: 10, marks: [3], jump: { from: 3, by: 4 } }, 7],
    [{ kind: "blocks", groups: [{ tens: 3, ones: 4 }] }, 34],
  ];
  for (const [show, ans] of cases)
    expect(presentPlan(mk(show, ans), "5-7", []).problemNumbers).not.toContain(ans);
  expect(presentPlan(mk({ kind: "equation", text: "3 + 0 = ?" }, 3, "What is 3 + 0?"), "5-7", []).problemNumbers).toContain(3);
});
