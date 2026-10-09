import { LEVELS, type Level, type Problem } from "../types";
import { answerRange, samples, sayNumbers, tpl } from "./testkit";

const each = (id: string, fn: (p: Problem, lv: Level, n: number[]) => void) => {
  for (const lv of LEVELS) for (const p of samples(tpl(id), lv)) fn(p, lv, sayNumbers(p.prompt.say));
};

it.each([
  ["teen-blocks", 1, 11, 14], ["teen-blocks", 2, 11, 17], ["teen-blocks", 3, 11, 19],
  ["teen-split", 1, 1, 4], ["teen-split", 2, 1, 7], ["teen-split", 3, 1, 9],
  ["blocks-to-number", 1, 20, 49], ["blocks-to-number", 2, 20, 79], ["blocks-to-number", 3, 20, 99],
  ["tens-in-number", 1, 2, 4], ["tens-in-number", 2, 2, 7], ["tens-in-number", 3, 2, 9],
] as const)("%s L%i answers %i–%i", (id, lv, min, max) => expect(answerRange(tpl(id), lv)).toEqual([min, max]));

it("teen-blocks: one ten and o ones, blocks at every level", () =>
  each("teen-blocks", (p, _lv, [o]) => {
    expect(p.answer).toBe(10 + o!);
    expect(p.prompt.say).toBe(`One ten and ${o} ones. What number is it?`);
    expect(p.prompt.show).toEqual({ kind: "blocks", groups: [{ tens: 1, ones: o }] });
    expect(p.mistakes).toContainEqual({ answer: o, tag: "counted-ones-only" });
  }));

it("teen-split: blocks, then ten-frames, then equation", () =>
  each("teen-split", (p, lv, [n]) => {
    const o = n! - 10;
    expect(p.answer).toBe(o);
    expect(p.mistakes[0]).toEqual({ answer: n, tag: "gave-total" });
    const want = [
      { kind: "blocks", groups: [{ tens: 1, ones: o }] },
      { kind: "ten-frames", first: 10, second: o },
      { kind: "equation", text: `10 + ? = ${n}` },
    ][lv - 1];
    expect(p.prompt.show).toEqual(want);
  }));

it("blocks-to-number: tens and ones, swapped-digits", () =>
  each("blocks-to-number", (p, _lv, [t, o]) => {
    expect(p.answer).toBe(10 * t! + o!);
    expect(p.prompt.show).toEqual({ kind: "blocks", groups: [{ tens: t, ones: o }] });
    if (o! >= 1 && o !== t) expect(p.mistakes[0]).toEqual({ answer: 10 * o! + t!, tag: "swapped-digits" });
  }));

it("tens-in-number: answer is the tens digit", () =>
  each("tens-in-number", (p, lv, [n]) => {
    const t = Math.floor(n! / 10), o = n! % 10;
    expect(p.answer).toBe(t);
    if (o !== t) expect(p.mistakes).toContainEqual({ answer: o, tag: "picked-ones-digit" });
    expect(p.prompt.show).toEqual(lv < 3 ? { kind: "blocks", groups: [{ tens: t, ones: o }] } : { kind: "equation", text: `${n}` });
  }));

it.each([["compare-bigger-100", "max"], ["compare-smaller-100", "min"]] as const)("%s: level rules", (id, pick) =>
  each(id, (p, lv, [x, y]) => {
    expect(x! >= 10 && x! <= 99 && y! >= 10 && y! <= 99 && x !== y).toBe(true);
    expect(p.answer).toBe(Math[pick](x!, y!));
    expect(p.choices).toHaveLength(2);
    const tx = Math.floor(x! / 10), ty = Math.floor(y! / 10);
    if (lv === 1) {
      expect(tx).not.toBe(ty);
      expect(Math.abs(x! - y!)).toBeGreaterThanOrEqual(10);
    }
    if (lv === 2) expect(Math.abs(x! - y!)).toBeGreaterThanOrEqual(3);
    if (lv === 3) {
      const swapped = y === (x! % 10) * 10 + tx;
      expect(tx === ty || swapped).toBe(true);
      expect(p.prompt.show).toEqual({ kind: "equation", text: `${x} or ${y}?` });
    } else expect(p.prompt.show).toEqual({ kind: "number-line", from: 0, to: 100, marks: [x, y] });
  }));

it("compare-100 level 3 makes both same-tens and swapped-digit pairs", () => {
  const ps = samples(tpl("compare-bigger-100"), 3).map((p) => sayNumbers(p.prompt.say) as [number, number]);
  expect(ps.some(([x, y]) => Math.floor(x / 10) === Math.floor(y / 10))).toBe(true);
  expect(ps.some(([x, y]) => y === (x % 10) * 10 + Math.floor(x / 10))).toBe(true);
});

it.each([
  ["ten-more", 10, { 1: [10, 80], 2: [10, 59], 3: [10, 89] }],
  ["ten-less", -10, { 1: [20, 90], 2: [20, 69], 3: [20, 99] }],
] as const)("%s: n span per level, multiples of 10 at L1", (id, step, spans) => {
  for (const lv of LEVELS) {
    const ns: number[] = [];
    for (const p of samples(tpl(id), lv)) {
      const n = sayNumbers(p.prompt.say).at(-1)!; // "What is 10 more than {n}?"
      ns.push(n);
      expect(p.answer).toBe(n + step);
      if (lv === 1) expect(n % 10).toBe(0);
      expect(p.prompt.show).toEqual(lv < 3
        ? { kind: "blocks", groups: [{ tens: Math.floor(n / 10), ones: n % 10 }] }
        : { kind: "equation", text: `${n} ${step > 0 ? "+" : "−"} 10 = ?` });
      expect(p.mistakes[0]).toEqual(step > 0 ? { answer: n + 1, tag: "added-one" } : { answer: n - 1, tag: "subtracted-one" });
    }
    expect([Math.min(...ns), Math.max(...ns)]).toEqual(spans[lv]);
    if (lv > 1) expect(ns.some((n) => n % 10 !== 0)).toBe(true);
  }
});
