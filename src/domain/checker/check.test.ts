import type { Problem } from "../types";
import { check } from "./check";

const p: Problem = {
  prompt: { say: "8 plus 5", show: { kind: "equation", text: "8 + 5 = ?" } },
  answer: 13,
  input: "tap-choice",
  choices: [12, 13, 14, 3],
  mistakes: [{ answer: 12, tag: "off-by-one-counting" }, { answer: 3, tag: "subtracted-instead" }],
};

it("correct", () => expect(check(p, 13)).toEqual({ kind: "correct" }));
it("known mistake", () => expect(check(p, 3)).toEqual({ kind: "known-mistake", tag: "subtracted-instead" }));
it("wrong", () => expect(check(p, 40)).toEqual({ kind: "wrong" }));
