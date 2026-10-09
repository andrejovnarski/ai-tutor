import { sayNumbers, solveEquation } from "./testkit";

it.each([
  ["3 + 4 = ?", 7], ["9 − 2 = ?", 7], ["9 - 2 = ?", 7], ["3 + ? = 7", 4],
  ["? + 4 = 7", 3], ["9 − ? = 2", 7], ["? − 2 = 7", 9],
] as const)("solveEquation(%s) = %i", (text, n) => expect(solveEquation(text)).toBe(n));

it("solveEquation rejects other text", () => expect(() => solveEquation("7 or 4?")).toThrow());
it("sayNumbers reads numbers in order", () => expect(sayNumbers("5, 6, 7. What comes next?")).toEqual([5, 6, 7]));
