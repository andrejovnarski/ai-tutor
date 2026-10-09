import { publicTurn } from "./publicTurn";
import { fresh, firstSkills, placedKid } from "../domain/session/testkit";
import { nextTurn } from "../domain/session/engine";

it("keeps prompt, input, choices, mode and try, and drops the rest", () => {
  const { turn } = nextTurn(fresh(placedKid(firstSkills(3))), 1000);
  if (turn.kind !== "problem") throw new Error("expected a problem");
  const pub = publicTurn(turn);
  expect(pub).toEqual({
    kind: "problem", mode: turn.mode, try: 1, prompt: turn.problem.prompt, input: turn.problem.input,
    ...(turn.problem.choices ? { choices: turn.problem.choices } : {}),
  });
  expect(JSON.stringify(pub)).not.toMatch(/"(answer|mistakes|templateId|seed|skillId|logs)"\s*:/);
});

it("passes an end summary through", () => {
  const summary = { problems: 3, firstTryCorrect: 2, minutes: 11, mastered: [] };
  expect(publicTurn({ kind: "end", summary })).toEqual({ kind: "end", summary });
});
