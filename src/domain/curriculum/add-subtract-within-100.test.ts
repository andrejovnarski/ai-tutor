import { LEVELS, type Level, type Mistake, type Problem, type Visual } from "../types";
import { samples, sayNumbers, tpl } from "./testkit";

type V<K extends Visual["kind"]> = Extract<Visual, { kind: K }>;
const ones = (n: number) => n % 10;
const tens = (n: number) => Math.floor(n / 10);
const val = (g: { tens: number; ones: number }) => 10 * g.tens + g.ones;

type Spec = {
  id: string;
  op: "+" | "-";
  /** The bounded number: the sum for addition, `a` for subtraction. */
  bound: Record<Level, number>;
  /** Regrouping makes ones digit 9 impossible for the bounded number, so its max is bound − 1. */
  maxSlack?: 1;
  rule: (a: number, b: number) => boolean;
  first: (a: number, b: number) => Mistake;
};

const SPECS: Spec[] = [
  { id: "add-tens", op: "+", bound: { 1: 50, 2: 80, 3: 100 }, rule: (a, b) => a % 10 === 0 && b % 10 === 0 && a >= 10 && b >= 10,
    first: (a, b) => ({ answer: (a + b) / 10, tag: "dropped-zero" }) },
  { id: "sub-tens", op: "-", bound: { 1: 50, 2: 80, 3: 100 }, rule: (a, b) => a % 10 === 0 && b % 10 === 0 && b >= 10 && a - b >= 10,
    first: (a, b) => ({ answer: (a - b) / 10, tag: "dropped-zero" }) },
  { id: "add-2d-1d", op: "+", bound: { 1: 49, 2: 79, 3: 99 }, rule: (a, b) => a >= 10 && b >= 1 && b <= 9 && ones(a) + b <= 9,
    first: (a, b) => ({ answer: a + 10 * b, tag: "added-to-tens" }) },
  { id: "add-2d-2d", op: "+", bound: { 1: 59, 2: 79, 3: 99 }, rule: (a, b) => a >= 10 && a <= 89 && b >= 10 && b <= 89 && ones(a) + ones(b) <= 9,
    first: (a, b) => ({ answer: a + b + 10, tag: "off-by-ten" }) },
  { id: "add-2d-1d-regroup", op: "+", bound: { 1: 59, 2: 79, 3: 99 }, maxSlack: 1, rule: (a, b) => a >= 10 && b >= 2 && b <= 9 && ones(a) + b >= 10,
    first: (a, b) => ({ answer: a + b - 10, tag: "forgot-to-regroup" }) },
  { id: "add-2d-2d-regroup", op: "+", bound: { 1: 59, 2: 79, 3: 99 }, maxSlack: 1, rule: (a, b) => a >= 11 && a <= 88 && b >= 11 && b <= 88 && ones(a) + ones(b) >= 10,
    first: (a, b) => ({ answer: a + b - 10, tag: "forgot-to-regroup" }) },
  { id: "sub-2d-1d", op: "-", bound: { 1: 49, 2: 79, 3: 99 }, rule: (a, b) => a >= 10 && b >= 1 && b <= 9 && ones(a) >= b,
    first: (a, b) => ({ answer: a + b, tag: "added-instead" }) },
  { id: "sub-2d-2d", op: "-", bound: { 1: 59, 2: 79, 3: 99 }, rule: (a, b) => b >= 10 && ones(a) >= ones(b) && a - b >= 1,
    first: (a, b) => ({ answer: a - b + 10, tag: "off-by-ten" }) },
  { id: "sub-2d-1d-regroup", op: "-", bound: { 1: 49, 2: 79, 3: 99 }, maxSlack: 1, rule: (a, b) => a >= 10 && b >= 2 && b <= 9 && ones(a) < b,
    first: (a, b) => ({ answer: a - b + 10, tag: "forgot-to-regroup" }) },
  { id: "sub-2d-2d-regroup", op: "-", bound: { 1: 59, 2: 79, 3: 99 }, maxSlack: 1, rule: (a, b) => b >= 11 && ones(a) < ones(b) && a - b >= 1,
    first: (a, b) => ({ answer: a - b + 10, tag: "forgot-to-regroup" }) },
];

describe.each(SPECS.map((s) => [s.id, s] as const))("%s", (_id, s) => {
  it.each(LEVELS.map((l) => [l]))("level %i: rule, bound, picture, first mistake", (lv) => {
    const bounded: number[] = [];
    for (const p of samples(tpl(s.id), lv)) {
      const [a, b] = sayNumbers(p.prompt.say) as [number, number];
      expect(p.prompt.say).toBe(`What is ${a} ${s.op === "+" ? "plus" : "minus"} ${b}?`);
      expect(s.rule(a, b)).toBe(true);
      expect(p.answer).toBe(s.op === "+" ? a + b : a - b);
      bounded.push(s.op === "+" ? a + b : a);
      const want = s.first(a, b);
      if (want.answer >= 0 && want.answer <= 100) expect(p.mistakes[0]).toEqual(want);
      checkPicture(p, lv, s.op, a, b);
    }
    const max = Math.max(...bounded);
    expect(max).toBeLessThanOrEqual(s.bound[lv]);
    expect(max).toBeGreaterThanOrEqual(s.bound[lv] - (s.maxSlack ?? 0));
  });
});

function checkPicture(p: Problem, lv: Level, op: "+" | "-", a: number, b: number) {
  const show = p.prompt.show;
  if (lv === 1) {
    const blocks = show as V<"blocks">;
    expect(blocks.kind).toBe("blocks");
    if (op === "+") expect(blocks.groups.map(val).reduce((x, y) => x + y)).toBe(p.answer);
    else expect(val(blocks.groups[0]!) - val(blocks.crossedOut!)).toBe(p.answer);
  } else if (lv === 2) {
    expect(show).toEqual({ kind: "number-line", from: 0, to: 100, marks: [a], jump: { from: a, by: op === "+" ? b : -b } });
  } else {
    expect(show).toEqual({ kind: "equation", text: `${a} ${op === "+" ? "+" : "−"} ${b} = ?` });
  }
}

it("subtracted-smaller-digit is offered for regroup subtraction", () => {
  for (const p of samples(tpl("sub-2d-2d-regroup"), 3)) {
    const [a, b] = sayNumbers(p.prompt.say) as [number, number];
    const wrong = 10 * (tens(a) - tens(b)) + (ones(b) - ones(a));
    if (wrong !== p.answer + 10 && Math.abs(wrong - p.answer) !== 1)
      expect(p.mistakes).toContainEqual({ answer: wrong, tag: "subtracted-smaller-digit" });
  }
});
