import { LEVELS, type Visual } from "../types";
import { answerRange, samples, sayNumbers, tpl } from "./testkit";

it.each([
  ["count-objects-10", 1, 1, 5], ["count-objects-10", 2, 3, 8], ["count-objects-10", 3, 5, 10],
  ["count-objects-20", 1, 10, 13], ["count-objects-20", 2, 11, 16], ["count-objects-20", 3, 11, 20],
  ["count-ten-frame-10", 1, 1, 5], ["count-ten-frame-10", 2, 3, 8], ["count-ten-frame-10", 3, 5, 10],
  ["count-ten-frame-20", 1, 10, 13], ["count-ten-frame-20", 2, 11, 16], ["count-ten-frame-20", 3, 11, 20],
  ["number-after", 1, 2, 6], ["number-after", 2, 2, 10], ["number-after", 3, 2, 20],
  ["count-sequence", 1, 4, 7], ["count-sequence", 2, 4, 12], ["count-sequence", 3, 4, 20],
] as const)("%s L%i answers %i–%i", (id, lv, min, max) => expect(answerRange(tpl(id), lv)).toEqual([min, max]));

const each = (id: string, fn: (p: ReturnType<typeof samples>[number]) => void) => {
  for (const lv of LEVELS) samples(tpl(id), lv).forEach(fn);
};

it.each(["count-objects-10", "count-objects-20"])("%s: answer is the group size, objects at all levels", (id) =>
  each(id, (p) => {
    const show = p.prompt.show as Extract<Visual, { kind: "objects" }>;
    expect(show.kind).toBe("objects");
    expect(p.answer).toBe(show.groups[0]);
    expect(p.prompt.say).toMatch(new RegExp(`^How many ${"\\w+"}\\?$`));
  }));

it.each(["count-ten-frame-10", "count-ten-frame-20"])("%s: answer is the dot count", (id) =>
  each(id, (p) => {
    expect(p.prompt.show).toEqual({ kind: "ten-frames", first: p.answer, second: 0 });
    expect(p.prompt.say).toBe("How many dots?");
  }));

it("number-after: answer is n + 1, number line at all levels", () =>
  each("number-after", (p) => {
    const n = sayNumbers(p.prompt.say)[0]!;
    expect(p.answer).toBe(n + 1);
    expect(p.prompt.show).toMatchObject({ kind: "number-line", marks: [n] });
    expect(p.mistakes).toContainEqual({ answer: n, tag: "repeated-number" });
  }));

it("count-sequence: answer follows the third number", () =>
  each("count-sequence", (p) => {
    const [a, b, c] = sayNumbers(p.prompt.say);
    expect([b, c]).toEqual([a! + 1, a! + 2]);
    expect(p.answer).toBe(c! + 1);
    expect(p.prompt.show.kind).toBe("number-line");
    expect(p.mistakes).toContainEqual({ answer: a! + 4, tag: "skipped-number" });
  }));

it("count-objects icon matches the word said", () =>
  each("count-objects-10", (p) => {
    const show = p.prompt.show as Extract<Visual, { kind: "objects" }>;
    expect(p.prompt.say.toLowerCase()).toContain(show.icon);
  }));
