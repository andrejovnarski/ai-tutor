import { LEVELS, type Level, type Problem, type Visual } from "../types";
import { answerRange, samples, sayNumbers, tpl } from "./testkit";

type V<K extends Visual["kind"]> = Extract<Visual, { kind: K }>;
const each = (id: string, fn: (p: Problem, lv: Level) => void) => {
  for (const lv of LEVELS) for (const p of samples(tpl(id), lv)) fn(p, lv);
};
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

it.each([
  ["add-objects-10", 1, 2, 5], ["add-objects-10", 2, 2, 8], ["add-objects-10", 3, 2, 10],
  ["add-ten-frame-10", 1, 2, 5], ["add-ten-frame-10", 2, 2, 8], ["add-ten-frame-10", 3, 2, 10],
  ["add-facts-5", 1, 2, 5], ["add-facts-5", 2, 0, 5], ["add-facts-5", 3, 0, 5],
  ["add-line-5", 1, 2, 5], ["add-line-5", 2, 0, 5], ["add-line-5", 3, 0, 5],
  ["count-on-bigger-first", 1, 4, 7], ["count-on-bigger-first", 2, 4, 9], ["count-on-bigger-first", 3, 4, 10],
  ["count-on-smaller-first", 1, 4, 7], ["count-on-smaller-first", 2, 4, 9], ["count-on-smaller-first", 3, 4, 10],
  ["make-ten-frame", 1, 1, 5], ["make-ten-frame", 2, 1, 7], ["make-ten-frame", 3, 1, 9],
  ["make-ten-bond", 1, 1, 5], ["make-ten-bond", 2, 1, 7], ["make-ten-bond", 3, 1, 9],
] as const)("%s L%i answers %i–%i", (id, lv, min, max) => expect(answerRange(tpl(id), lv)).toEqual([min, max]));

it("add-objects-10: sum of two non-empty groups, objects at every level", () =>
  each("add-objects-10", (p) => {
    const s = p.prompt.show as V<"objects">;
    expect(s.kind).toBe("objects");
    expect(s.groups.every((g) => g >= 1)).toBe(true);
    expect(p.answer).toBe(sum(s.groups));
    expect(p.mistakes[0]?.tag).toBe("off-by-one-counting");
  }));

it("add-ten-frame-10: first + second, ten-frames at every level", () =>
  each("add-ten-frame-10", (p) => {
    const s = p.prompt.show as V<"ten-frames">;
    expect(s.kind).toBe("ten-frames");
    expect(p.answer).toBe(s.first + s.second);
    expect(p.prompt.say).toBe("How many dots in all?");
  }));

it("add-facts-5: objects at L1–2, sum of said numbers", () =>
  each("add-facts-5", (p, lv) => {
    const [a, b] = sayNumbers(p.prompt.say) as [number, number];
    expect(p.answer).toBe(a + b);
    if (lv < 3) expect((p.prompt.show as V<"objects">).groups).toEqual([a, b]);
    if (lv === 1) expect(a >= 1 && b >= 1).toBe(true);
    // ±1 is listed first, so it wins when |a − b| lands on answer ± 1.
    if (Math.abs(Math.abs(a - b) - (a + b)) > 1) expect(p.mistakes).toContainEqual({ answer: Math.abs(a - b), tag: "subtracted-instead" });
  }));

it("add-line-5: jump from a by b on 0–5", () =>
  each("add-line-5", (p, lv) => {
    const [a, b] = sayNumbers(p.prompt.say) as [number, number];
    expect(p.answer).toBe(a + b);
    if (lv < 3) expect(p.prompt.show).toEqual({ kind: "number-line", from: 0, to: 5, marks: [], jump: { from: a, by: b } });
  }));

it("count-on-bigger-first: a ≥ b, b in 1–3, jump from a", () =>
  each("count-on-bigger-first", (p, lv) => {
    const [a, b] = sayNumbers(p.prompt.say) as [number, number];
    expect(a).toBeGreaterThanOrEqual(b);
    expect(b >= 1 && b <= 3).toBe(true);
    expect(p.answer).toBe(a + b);
    if (lv < 3) expect((p.prompt.show as V<"number-line">).jump).toEqual({ from: a, by: b });
  }));

it("count-on-smaller-first: a < b, a in 1–3, jump starts from the bigger number", () =>
  each("count-on-smaller-first", (p, lv) => {
    const [a, b] = sayNumbers(p.prompt.say) as [number, number];
    expect(a).toBeLessThan(b);
    expect(a >= 1 && a <= 3).toBe(true);
    expect(p.answer).toBe(a + b);
    if (lv < 3) expect((p.prompt.show as V<"number-line">).jump).toEqual({ from: b, by: a });
  }));

it.each(["make-ten-frame", "make-ten-bond"])("%s: answer + a = 10, tagged mistakes", (id) =>
  each(id, (p, lv) => {
    const a = sayNumbers(p.prompt.say)[0]!;
    expect(p.answer + a).toBe(10);
    if (a > 1) expect(p.mistakes).toContainEqual({ answer: 10, tag: "gave-total" }); // a = 1: 10 is answer + 1
    if (id === "make-ten-frame") expect(p.prompt.show).toEqual({ kind: "ten-frames", first: a, second: 0, fill: true });
    else if (lv < 3) expect(p.prompt.show).toEqual({ kind: "objects", icon: expect.any(String), groups: [a] });
    else expect(p.prompt.show).toEqual({ kind: "equation", text: `${a} + ? = 10` });
  }));

it.each([
  ["missing-addend", (n: number[]) => ({ known: n[0]!, c: n[1]! })],
  ["missing-first", (n: number[]) => ({ known: n[0]!, c: n[1]! })],
] as const)("%s: c bounded per level, known ≥ 1, answer ≥ 1", (id, read) => {
  const bound = { 1: 5, 2: 8, 3: 10 } as const;
  for (const lv of LEVELS) {
    const cs: number[] = [];
    for (const p of samples(tpl(id), lv)) {
      const { known, c } = read(sayNumbers(p.prompt.say));
      cs.push(c);
      expect(known).toBeGreaterThanOrEqual(1);
      expect(p.answer).toBe(c - known);
      expect(p.answer).toBeGreaterThanOrEqual(1);
      expect(p.mistakes).toContainEqual({ answer: c, tag: "gave-total" });
      if (lv < 3) expect(p.prompt.show).toEqual({ kind: "number-line", from: 0, to: c, marks: [known, c] });
      else expect((p.prompt.show as V<"equation">).text).toBe(id === "missing-addend" ? `${known} + ? = ${c}` : `? + ${known} = ${c}`);
    }
    expect(Math.max(...cs)).toBe(bound[lv]);
  }
});

describe("sum (addends for style views)", () => {
  const WITH_SUM = ["add-objects-10", "add-ten-frame-10", "add-facts-5", "add-line-5", "count-on-bigger-first", "count-on-smaller-first"];
  const WITHOUT_SUM = ["make-ten-frame", "make-ten-bond", "missing-addend", "missing-first"];
  const made = (id: string) => LEVELS.flatMap((lv) => Array.from({ length: 50 }, (_, i) => tpl(id).make(i + 1, lv)));

  it.each(WITH_SUM)("%s sets sum adding up to the answer", (id) => {
    for (const p of made(id)) {
      expect(p.sum).toBeDefined();
      expect(p.sum![0] + p.sum![1]).toBe(p.answer);
    }
  });

  it.each(WITHOUT_SUM)("%s has no sum", (id) => {
    for (const p of made(id)) expect(p.sum).toBeUndefined();
  });

  it.each(["count-on-bigger-first", "count-on-smaller-first"])("%s puts the bigger addend first, like its number line", (id) => {
    for (const p of made(id)) {
      expect(p.sum![0]).toBeGreaterThanOrEqual(p.sum![1]);
      const show = p.prompt.show;
      if (show.kind === "number-line") expect(p.sum![0]).toBe(show.jump!.from);
    }
  });

  it.each(["add-objects-10", "add-ten-frame-10", "add-facts-5", "add-line-5"])("%s sum follows the spoken order", (id) => {
    for (const p of made(id)) {
      const say = p.prompt.say;
      const nums = id === "add-objects-10" ? [say.match(/^(\d+)/)![1], say.match(/and (\d+) more/)![1]]
        : id === "add-ten-frame-10" ? null
        : id === "add-facts-5" ? say.match(/(\d+) plus (\d+)/)!.slice(1)
        : say.match(/Start at (\d+)\. Jump (\d+)/)!.slice(1);
      if (nums) expect(p.sum).toEqual(nums.map(Number));
      else expect(p.sum).toEqual([(p.prompt.show as V<"ten-frames">).first, (p.prompt.show as V<"ten-frames">).second]);
    }
  });
});

it("only make-ten-frame enables filling across all levels and seeds", () => {
  for (const id of ["make-ten-frame", "make-ten-bond", "add-ten-frame-10", "add-objects-10", "add-facts-5", "add-line-5", "count-on-bigger-first", "count-on-smaller-first", "missing-addend", "missing-first"]) {
    each(id, (p) => expect("fill" in p.prompt.show ? p.prompt.show.fill : undefined).toBe(id === "make-ten-frame" ? true : undefined));
  }
});
