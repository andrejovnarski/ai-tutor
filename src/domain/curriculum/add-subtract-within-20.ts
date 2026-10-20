import type { Rng } from "../rng";
import type { Cluster, Level, Visual } from "../types";
import { between, fade, plusMinus, template, type ByLevel, type Span } from "./kit";

const doubles = template("doubles", (rng, lv) => {
  const a = between(rng, ({ 1: [1, 5], 2: [1, 7], 3: [1, 10] } as ByLevel<Span>)[lv]);
  return {
    say: `What is ${a} plus ${a}?`,
    show: fade(lv, { kind: "ten-frames", first: a, second: a }, `${a} + ${a} = ?`),
    answer: 2 * a,
    mistakes: plusMinus(2 * a, 1, "off-by-one-counting"),
  };
});

const nearDoubles = template("near-doubles", (rng, lv) => {
  const a = between(rng, ({ 1: [1, 4], 2: [1, 6], 3: [1, 9] } as ByLevel<Span>)[lv]);
  const b = a + 1;
  return {
    say: `What is ${a} plus ${b}?`,
    show: fade(lv, { kind: "ten-frames", first: a, second: b }, `${a} + ${b} = ?`),
    answer: a + b,
    mistakes: [{ answer: 2 * a, tag: "used-double" }, { answer: 2 * a + 2, tag: "off-by-one-counting" }],
  };
});

const OVER_TEN_SUMS: ByLevel<Span> = { 1: [11, 13], 2: [11, 16], 3: [11, 18] };

/** a in 6–9, b ≤ 9, a + b in the level's span (always 11 or more). */
const overTen = (rng: Rng, lv: Level): [number, number] => {
  const s = between(rng, OVER_TEN_SUMS[lv]);
  const a = rng.int(Math.max(6, s - 9), 9);
  return [a, s - a];
};

const addOverTen = (id: string, say: (a: number, b: number) => string, picture: (a: number, b: number) => Visual) =>
  template(id, (rng, lv) => {
    const [a, b] = overTen(rng, lv);
    return {
      say: say(a, b),
      show: fade(lv, picture(a, b), `${a} + ${b} = ?`),
      answer: a + b,
      mistakes: [{ answer: a + b - 10, tag: "forgot-the-ten" }, ...plusMinus(a + b, 1, "off-by-one-counting")],
    };
  });

/** L1 ten-frames (a full ten plus ones, b crossed out), L2 number line, L3 equation. */
const teenPicture = (lv: Level, a: number, b: number): Visual =>
  lv === 1
    ? { kind: "ten-frames", first: 10, second: a - 10, crossedOut: b }
    : fade(lv, { kind: "number-line", from: 0, to: 20, marks: [a], jump: { from: a, by: -b } }, `${a} − ${b} = ?`);

const subTeenNoCross = template("sub-teen-no-cross", (rng, lv) => {
  const a = rng.int(11, 19);
  const b = rng.int(1, a - 10);
  return {
    say: `What is ${a} minus ${b}?`,
    show: teenPicture(lv, a, b),
    answer: a - b,
    mistakes: [...plusMinus(a - b, 1, "off-by-one-counting"), { answer: a + b, tag: "added-instead" }],
  };
});

const subAcrossTen = template("sub-across-ten", (rng, lv) => {
  const a = rng.int(11, 18);
  const b = rng.int((a % 10) + 1, 9);
  return {
    say: `What is ${a} minus ${b}?`,
    show: teenPicture(lv, a, b),
    answer: a - b,
    mistakes: [
      { answer: 10 + Math.abs((a % 10) - b), tag: "subtracted-smaller-digit" },
      ...plusMinus(a - b, 1, "off-by-one-counting"),
      { answer: a + b, tag: "added-instead" },
    ],
  };
});

const RELATED_TOTAL: ByLevel<number> = { 1: 12, 2: 15, 3: 18 };

/** known in 3–9, answer in 1–9, c = known + answer ≤ the level's bound. */
const relatedFact = (rng: Rng, lv: Level): { known: number; c: number } => {
  const known = rng.int(3, 9);
  return { known, c: rng.int(known + 1, Math.min(RELATED_TOTAL[lv], known + 9)) };
};

const relatedShow = (lv: Level, known: number, c: number) =>
  fade(lv, { kind: "number-line", from: 0, to: c, marks: [known, c] }, `${c} − ${known} = ?`);

const thinkAddition = template("think-addition", (rng, lv) => {
  const { known: b, c } = relatedFact(rng, lv);
  return {
    say: `${c} minus ${b}. Think: ${b} plus what makes ${c}?`,
    show: relatedShow(lv, b, c),
    answer: c - b,
    mistakes: [
      { answer: c, tag: "gave-total" },
      { answer: b, tag: "gave-part" },
      { answer: c + b, tag: "added-instead" },
      ...plusMinus(c - b, 1, "off-by-one-counting"),
    ],
  };
});

const factFamily = template("fact-family", (rng, lv) => {
  const { known: a, c } = relatedFact(rng, lv);
  const b = c - a;
  return {
    say: `${a} plus ${b} is ${c}. So ${c} minus ${a} is?`,
    show: relatedShow(lv, a, c),
    answer: b,
    mistakes: [
      { answer: c, tag: "gave-total" },
      { answer: a, tag: "gave-part" },
      ...plusMinus(b, 1, "off-by-one-counting"),
    ],
  };
});

export const addSubtractWithin20Cluster: Cluster = {
  id: "add-subtract-within-20",
  name: "Add and subtract within 20",
  skills: [
    {
      id: "add-subtract-within-20.doubles", name: "Doubles and near doubles", kidName: "Doubles", grade: "1", commonCore: ["1.OA.C.6"],
      needs: ["add-within-10.count-on"], styles: ["blocks", "ten-frame", "drawing"],
      templates: ["doubles", "near-doubles"],
    },
    {
      id: "add-subtract-within-20.make-ten", name: "Add by making 10", grade: "1", commonCore: ["1.OA.C.6"],
      needs: ["add-within-10.make-ten"], styles: ["ten-frame", "blocks", "number-line"],
      templates: ["add-over-ten-frame", "add-over-ten"],
    },
    {
      id: "add-subtract-within-20.subtract", name: "Subtract within 20", grade: "1", commonCore: ["1.OA.C.6"],
      needs: ["subtract-within-10.within-10"], styles: ["number-line", "ten-frame", "blocks"],
      templates: ["sub-teen-no-cross", "sub-across-ten"],
    },
    {
      id: "add-subtract-within-20.related-facts", name: "Related facts", kidName: "Number families", grade: "1", commonCore: ["1.OA.B.4"],
      needs: ["add-subtract-within-20.make-ten", "add-subtract-within-20.subtract"],
      styles: ["blocks", "number-line", "story"],
      templates: ["think-addition", "fact-family"],
    },
  ],
  templates: [
    doubles,
    nearDoubles,
    addOverTen("add-over-ten-frame", (a, b) => `What is ${a} plus ${b}?`, (a, b) => ({ kind: "ten-frames", first: a, second: b })),
    addOverTen("add-over-ten", (a, b) => `Start at ${a}. Jump ${b}.`,
      (a, b) => ({ kind: "number-line", from: 0, to: 20, marks: [a], jump: { from: a, by: b } })),
    subTeenNoCross,
    subAcrossTen,
    thinkAddition,
    factFamily,
  ],
};
