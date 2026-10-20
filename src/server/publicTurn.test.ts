import { publicTurn, revealNote } from "./publicTurn";
import { fresh, firstSkills, placedKid } from "../domain/session/testkit";
import { nextTurn } from "../domain/session/engine";

it("keeps prompt, input, choices, mode and try, and drops the rest", () => {
  const { turn } = nextTurn(fresh(placedKid(firstSkills(3))), 1000);
  if (turn.kind !== "problem") throw new Error("expected a problem");
  const pub = publicTurn(turn);
  expect(pub).toEqual({
    kind: "problem", mode: turn.mode, try: 1, help: 0, prompt: turn.problem.prompt, input: turn.problem.input,
    ...(turn.problem.choices ? { choices: turn.problem.choices } : {}),
  });
  expect(JSON.stringify(pub)).not.toMatch(/"(answer|mistakes|templateId|seed|skillId|logs)"\s*:/);
});

it("passes an end summary through", () => {
  const summary = { problems: 3, firstTryCorrect: 2, minutes: 11, mastered: [] };
  expect(publicTurn({ kind: "end", summary })).toEqual({ kind: "end", summary });
});

describe("revealNote", () => {
  it("adds the answer only on a reveal whose line does not already say it", () => {
    expect(revealNote("Let's walk through it together!", true, 7)).toBe("The answer is 7.");
    expect(revealNote("The answer is 7.", true, 7)).toBeNull();
    expect(revealNote("We end up with 17.", true, 7)).toBe("The answer is 7.");
    expect(revealNote("Count with me: 3, 4, 5, 6, 7!", true, 7)).toBeNull();
    expect(revealNote("Not quite yet!", false, undefined)).toBeNull();
    expect(revealNote("Hmm.", true, undefined)).toBeNull();
    expect(revealNote("It is -3.", true, -3)).toBeNull();
  });
});

describe("the retry board", () => {
  type ProblemTurn = Extract<Parameters<typeof publicTurn>[0], { kind: "problem" }>;
  const show = { kind: "equation", text: "3 + 4 = ?" } as const;
  const retry = (o: Partial<ProblemTurn>, sum: [number, number] | null = [3, 4]): ProblemTurn => ({
    kind: "problem", skillId: "s", templateId: "t", seed: 1, level: 1, mode: "practice", try: 2, help: 0, logs: [],
    style: "number-line", ...o,
    problem: { prompt: { say: "What is 3 + 4?", show }, answer: 7, input: "tap-choice", choices: [6, 7, 8], mistakes: [], ...(sum && { sum }) },
  });
  const board = (t: ProblemTurn) => (publicTurn(t) as Extract<ReturnType<typeof publicTurn>, { kind: "problem" }>).prompt.show;

  it("draws the chosen style on try 2 of a sum problem", () => {
    expect(board(retry({}))).toEqual({ kind: "number-line", from: 0, to: 10, marks: [3], jump: { from: 3, by: 4 } });
    expect((publicTurn(retry({})) as { prompt: { say: string } }).prompt.say).toBe("What is 3 + 4?");
  });

  it("keeps the original picture on try 1, for story, and without a sum", () => {
    expect(board(retry({ try: 1 }))).toEqual(show);
    expect(board(retry({ style: "story" }))).toEqual(show);
    expect(board(retry({ style: null }))).toEqual(show);
    expect(board(retry({}, null))).toEqual(show);
  });

  it("never sends the sum or the style", () => {
    for (const t of [retry({}), retry({ try: 1 }), retry({ style: "story" })])
      expect(JSON.stringify(publicTurn(t))).not.toMatch(/"(sum|style)"/);
  });
});
