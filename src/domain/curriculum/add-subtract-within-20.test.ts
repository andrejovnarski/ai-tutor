import { LEVELS, type Level, type Problem } from "../types";
import { answerRange, samples, sayNumbers, tpl } from "./testkit";

const each = (id: string, fn: (p: Problem, lv: Level, n: number[]) => void) => {
  for (const lv of LEVELS) for (const p of samples(tpl(id), lv)) fn(p, lv, sayNumbers(p.prompt.say));
};

it.each([
  ["doubles", 1, 2, 10], ["doubles", 2, 2, 14], ["doubles", 3, 2, 20],
  ["near-doubles", 1, 3, 9], ["near-doubles", 2, 3, 13], ["near-doubles", 3, 3, 19],
  ["add-over-ten-frame", 1, 11, 13], ["add-over-ten-frame", 2, 11, 16], ["add-over-ten-frame", 3, 11, 18],
  ["add-over-ten", 1, 11, 13], ["add-over-ten", 2, 11, 16], ["add-over-ten", 3, 11, 18],
  ["sub-teen-no-cross", 1, 10, 18], ["sub-teen-no-cross", 2, 10, 18], ["sub-teen-no-cross", 3, 10, 18],
  ["sub-across-ten", 1, 2, 9], ["sub-across-ten", 2, 2, 9], ["sub-across-ten", 3, 2, 9],
] as const)("%s L%i answers %i–%i", (id, lv, min, max) => expect(answerRange(tpl(id), lv)).toEqual([min, max]));

it("doubles: ten-frames a, a", () =>
  each("doubles", (p, lv, [a, b]) => {
    expect(a).toBe(b);
    expect(p.answer).toBe(2 * a!);
    if (lv < 3) expect(p.prompt.show).toEqual({ kind: "ten-frames", first: a, second: a });
  }));

it("near-doubles: a + (a+1), used-double mistake", () =>
  each("near-doubles", (p, lv, [a, b]) => {
    expect(b).toBe(a! + 1);
    expect(p.answer).toBe(2 * a! + 1);
    expect(p.mistakes[0]).toEqual({ answer: 2 * a!, tag: "used-double" });
    if (lv < 3) expect(p.prompt.show).toEqual({ kind: "ten-frames", first: a, second: b });
  }));

it.each(["add-over-ten-frame", "add-over-ten"])("%s: a in 6–9, b ≤ 9, forgot-the-ten", (id) =>
  each(id, (p, lv, [a, b]) => {
    expect(a! >= 6 && a! <= 9 && b! >= 1 && b! <= 9).toBe(true);
    expect(p.answer).toBe(a! + b!);
    expect(p.mistakes[0]).toEqual({ answer: a! + b! - 10, tag: "forgot-the-ten" });
    if (lv === 3) return;
    if (id === "add-over-ten-frame") expect(p.prompt.show).toEqual({ kind: "ten-frames", first: a, second: b });
    else expect(p.prompt.show).toEqual({ kind: "number-line", from: 0, to: 20, marks: [a], jump: { from: a, by: b } });
  }));

const teenShow = (p: Problem, lv: Level, a: number, b: number) => {
  if (lv === 1) expect(p.prompt.show).toEqual({ kind: "ten-frames", first: 10, second: a - 10, crossedOut: b });
  if (lv === 2) expect(p.prompt.show).toEqual({ kind: "number-line", from: 0, to: 20, marks: [a], jump: { from: a, by: -b } });
};

it("sub-teen-no-cross: stays in the teens", () =>
  each("sub-teen-no-cross", (p, lv, [a, b]) => {
    expect(b! >= 1 && b! <= a! - 10).toBe(true);
    expect(p.answer).toBe(a! - b!);
    teenShow(p, lv, a!, b!);
  }));

it("sub-across-ten: crosses ten, subtracted-smaller-digit", () =>
  each("sub-across-ten", (p, lv, [a, b]) => {
    expect(a! >= 11 && a! <= 18 && b! <= 9).toBe(true);
    expect(a! % 10).toBeLessThan(b!);
    expect(p.answer).toBe(a! - b!);
    expect(p.mistakes[0]).toEqual({ answer: 10 + Math.abs((a! % 10) - b!), tag: "subtracted-smaller-digit" });
    teenShow(p, lv, a!, b!);
  }));

it.each([
  ["think-addition", (n: number[]) => ({ c: n[0]!, known: n[1]! })],
  ["fact-family", (n: number[]) => ({ c: n[2]!, known: n[0]! })],
] as const)("%s: c bounded per level, answer 1–9, known 3–9", (id, read) => {
  const bound = { 1: 12, 2: 15, 3: 18 } as const;
  for (const lv of LEVELS) {
    const cs: number[] = [];
    for (const p of samples(tpl(id), lv)) {
      const { c, known } = read(sayNumbers(p.prompt.say));
      cs.push(c);
      expect(known >= 3 && known <= 9).toBe(true);
      expect(p.answer).toBe(c - known);
      expect(p.answer >= 1 && p.answer <= 9).toBe(true);
      expect(p.mistakes[0]).toEqual({ answer: c, tag: "gave-total" });
      if (lv < 3) expect(p.prompt.show).toEqual({ kind: "number-line", from: 0, to: c, marks: [known, c] });
      else expect(p.prompt.show).toEqual({ kind: "equation", text: `${c} − ${known} = ?` });
    }
    expect(Math.max(...cs)).toBe(bound[lv]);
  }
});

it("fact-family says the full fact first", () =>
  each("fact-family", (p, _lv, [a, b, c]) => {
    expect(a! + b!).toBe(c);
    expect(p.answer).toBe(b);
  }));
