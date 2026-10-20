import type { Rng } from "../rng";
import type { Cluster, Level, Mistake, Visual } from "../types";
import { between, fade, plusMinus, template, type ByLevel, type Span } from "./kit";

const ones = (n: number) => n % 10;
const tens = (n: number) => Math.floor(n / 10);
const digits = (n: number) => ({ tens: tens(n), ones: ones(n) });

type Op = "+" | "-";

/** L1 blocks, L2 number line 0–100 with a jump, L3 equation. */
const picture = (lv: Level, op: Op, a: number, b: number): Visual =>
  lv === 1
    ? op === "+"
      ? { kind: "blocks", groups: [digits(a), digits(b)] }
      : { kind: "blocks", groups: [digits(a)], crossedOut: digits(b) }
    : fade(lv, { kind: "number-line", from: 0, to: 100, marks: [a], jump: { from: a, by: op === "+" ? b : -b } },
      `${a} ${op === "+" ? "+" : "−"} ${b} = ?`);

/** Draws (a, b) from the spans until `ok` holds. */
const pairWhere = (rng: Rng, aSpan: Span, bSpan: Span, ok: (a: number, b: number) => boolean): [number, number] => {
  for (;;) {
    const a = between(rng, aSpan);
    const b = between(rng, bSpan);
    if (ok(a, b)) return [a, b];
  }
};

const arith = (
  id: string,
  op: Op,
  pair: (rng: Rng, bound: number) => [number, number],
  bound: ByLevel<number>,
  mistakes: (a: number, b: number, answer: number) => Mistake[],
) =>
  template(id, (rng, lv) => {
    const [a, b] = pair(rng, bound[lv]);
    const answer = op === "+" ? a + b : a - b;
    return {
      say: `What is ${a} ${op === "+" ? "plus" : "minus"} ${b}?`,
      show: picture(lv, op, a, b),
      answer,
      mistakes: mistakes(a, b, answer),
    };
  });

const B50: ByLevel<number> = { 1: 50, 2: 80, 3: 100 };
const B49: ByLevel<number> = { 1: 49, 2: 79, 3: 99 };
const B59: ByLevel<number> = { 1: 59, 2: 79, 3: 99 };

const smallerDigit = (a: number, b: number) => 10 * (tens(a) - tens(b)) + Math.abs(ones(b) - ones(a));

const templates = [
  arith("add-tens", "+", (rng, B) => {
    const s = 10 * rng.int(2, B / 10);
    const a = 10 * rng.int(1, s / 10 - 1);
    return [a, s - a];
  }, B50, (_a, _b, s) => [{ answer: s / 10, tag: "dropped-zero" }, ...plusMinus(s, 10, "off-by-ten")]),

  arith("sub-tens", "-", (rng, B) => {
    const a = 10 * rng.int(2, B / 10);
    return [a, 10 * rng.int(1, a / 10 - 1)];
  }, B50, (a, b, d) => [
    { answer: d / 10, tag: "dropped-zero" }, { answer: a + b, tag: "added-instead" }, ...plusMinus(d, 10, "off-by-ten"),
  ]),

  arith("add-2d-1d", "+", (rng, B) => pairWhere(rng, [10, B - 1], [1, 9], (a, b) => ones(a) + b <= 9 && a + b <= B),
    B49, (a, b, s) => [
      { answer: a + 10 * b, tag: "added-to-tens" }, ...plusMinus(s, 1, "off-by-one-counting"), ...plusMinus(s, 10, "off-by-ten"),
    ]),

  arith("add-2d-2d", "+", (rng, B) => pairWhere(rng, [10, 89], [10, 89], (a, b) => ones(a) + ones(b) <= 9 && a + b <= B),
    B59, (_a, _b, s) => [...plusMinus(s, 10, "off-by-ten"), ...plusMinus(s, 1, "off-by-one-counting")]),

  arith("add-2d-1d-regroup", "+", (rng, B) => pairWhere(rng, [11, B], [2, 9], (a, b) => ones(a) + b >= 10 && a + b <= B),
    B59, (_a, _b, s) => [{ answer: s - 10, tag: "forgot-to-regroup" }, ...plusMinus(s, 1, "off-by-one-counting")]),

  arith("add-2d-2d-regroup", "+", (rng, B) => pairWhere(rng, [11, 88], [11, 88], (a, b) => ones(a) + ones(b) >= 10 && a + b <= B),
    B59, (_a, _b, s) => [
      { answer: s - 10, tag: "forgot-to-regroup" }, ...plusMinus(s, 1, "off-by-one-counting"), { answer: s + 10, tag: "off-by-ten" },
    ]),

  arith("sub-2d-1d", "-", (rng, B) => pairWhere(rng, [11, B], [1, 9], (a, b) => ones(a) >= b),
    B49, (a, b, d) => [
      { answer: a + b, tag: "added-instead" }, ...plusMinus(d, 1, "off-by-one-counting"), { answer: d - 10, tag: "off-by-ten" },
    ]),

  arith("sub-2d-2d", "-", (rng, B) => pairWhere(rng, [11, B], [10, 89], (a, b) => ones(a) >= ones(b) && a - b >= 1),
    B59, (_a, _b, d) => [...plusMinus(d, 10, "off-by-ten"), ...plusMinus(d, 1, "off-by-one-counting")]),

  arith("sub-2d-1d-regroup", "-", (rng, B) => pairWhere(rng, [10, B], [2, 9], (a, b) => ones(a) < b),
    B49, (a, b, d) => [
      { answer: d + 10, tag: "forgot-to-regroup" },
      { answer: smallerDigit(a, b), tag: "subtracted-smaller-digit" },
      ...plusMinus(d, 1, "off-by-one-counting"),
    ]),

  arith("sub-2d-2d-regroup", "-", (rng, B) => pairWhere(rng, [20, B], [11, 89], (a, b) => ones(a) < ones(b) && a - b >= 1),
    B59, (a, b, d) => [
      { answer: d + 10, tag: "forgot-to-regroup" },
      { answer: smallerDigit(a, b), tag: "subtracted-smaller-digit" },
      ...plusMinus(d, 1, "off-by-one-counting"),
    ]),
];

export const addSubtractWithin100Cluster: Cluster = {
  id: "add-subtract-within-100",
  name: "Add and subtract within 100",
  skills: [
    {
      id: "add-subtract-within-100.tens", name: "Add and subtract tens", grade: "1", commonCore: ["1.NBT.C.4", "1.NBT.C.6"],
      needs: ["place-value.ten-more-less"], styles: ["blocks", "number-line"],
      templates: ["add-tens", "sub-tens"],
    },
    {
      id: "add-subtract-within-100.add", name: "Add without regrouping", kidName: "Adding big numbers", grade: "2", commonCore: ["2.NBT.B.5"],
      needs: ["add-subtract-within-100.tens", "add-subtract-within-20.make-ten"], styles: ["blocks", "number-line"],
      templates: ["add-2d-1d", "add-2d-2d"],
    },
    {
      id: "add-subtract-within-100.add-regroup", name: "Add with regrouping", kidName: "Big adding with carrying", grade: "2", commonCore: ["2.NBT.B.5"],
      needs: ["add-subtract-within-100.add"], styles: ["blocks", "number-line"],
      templates: ["add-2d-1d-regroup", "add-2d-2d-regroup"],
    },
    {
      id: "add-subtract-within-100.subtract", name: "Subtract without regrouping", kidName: "Taking away big numbers", grade: "2", commonCore: ["2.NBT.B.5"],
      needs: ["add-subtract-within-100.tens", "add-subtract-within-20.subtract"], styles: ["blocks", "number-line"],
      templates: ["sub-2d-1d", "sub-2d-2d"],
    },
    {
      id: "add-subtract-within-100.subtract-regroup", name: "Subtract with regrouping", kidName: "Big taking away with borrowing", grade: "2", commonCore: ["2.NBT.B.5"],
      needs: ["add-subtract-within-100.subtract"], styles: ["blocks", "number-line"],
      templates: ["sub-2d-1d-regroup", "sub-2d-2d-regroup"],
    },
  ],
  templates,
};
