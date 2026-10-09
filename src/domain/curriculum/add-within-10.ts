import type { Rng } from "../rng";
import type { Cluster, Level, Mistake } from "../types";
import { between, fade, plusMinus, template, type ByLevel, type Span } from "./kit";
import { ITEMS, plural } from "./words";

/** a + b = sum with sum in `span`, each part ≥ `minPart`. */
export const splitSum = (rng: Rng, span: Span, minPart: number): [number, number] => {
  const s = between(rng, span);
  const a = rng.int(minPart, s - minPart);
  return [a, s - a];
};

export const addMistakes = (a: number, b: number): Mistake[] => [
  ...plusMinus(a + b, 1, "off-by-one-counting"),
  { answer: Math.abs(a - b), tag: "subtracted-instead" },
];

const PICTURE_SUMS: ByLevel<Span> = { 1: [2, 5], 2: [2, 8], 3: [2, 10] };

const addObjects = template("add-objects-10", (rng, lv) => {
  const [a, b] = splitSum(rng, PICTURE_SUMS[lv], 1);
  const item = rng.pick(ITEMS);
  return {
    say: `${plural(a, item.one, item.word)} and ${b} more. How many in all?`,
    show: { kind: "objects", icon: item.icon, groups: [a, b] },
    answer: a + b,
    mistakes: addMistakes(a, b),
  };
});

const addTenFrame = template("add-ten-frame-10", (rng, lv) => {
  const [a, b] = splitSum(rng, PICTURE_SUMS[lv], 1);
  return {
    say: "How many dots in all?",
    show: { kind: "ten-frames", first: a, second: b },
    answer: a + b,
    mistakes: addMistakes(a, b),
  };
});

const within5 = (rng: Rng, lv: Level) => splitSum(rng, lv === 1 ? [2, 5] : [0, 5], lv === 1 ? 1 : 0);

const addFacts5 = template("add-facts-5", (rng, lv) => {
  const [a, b] = within5(rng, lv);
  const item = rng.pick(ITEMS);
  return {
    say: `What is ${a} plus ${b}?`,
    show: fade(lv, { kind: "objects", icon: item.icon, groups: [a, b] }, `${a} + ${b} = ?`),
    answer: a + b,
    mistakes: addMistakes(a, b),
  };
});

const addLine5 = template("add-line-5", (rng, lv) => {
  const [a, b] = within5(rng, lv);
  return {
    say: `Start at ${a}. Jump ${b}. Where do you land?`,
    show: fade(lv, { kind: "number-line", from: 0, to: 5, marks: [], jump: { from: a, by: b } }, `${a} + ${b} = ?`),
    answer: a + b,
    mistakes: addMistakes(a, b),
  };
});

const COUNT_ON_SUMS: ByLevel<Span> = { 1: [4, 7], 2: [4, 9], 3: [4, 10] };

const countOnBiggerFirst = template("count-on-bigger-first", (rng, lv) => {
  const s = between(rng, COUNT_ON_SUMS[lv]);
  const b = rng.int(1, Math.min(3, Math.floor(s / 2)));
  const a = s - b;
  return {
    say: `Start at ${a}. Count on ${b}.`,
    show: fade(lv, { kind: "number-line", from: 0, to: 10, marks: [a], jump: { from: a, by: b } }, `${a} + ${b} = ?`),
    answer: s,
    mistakes: plusMinus(s, 1, "off-by-one-counting"),
  };
});

const countOnSmallerFirst = template("count-on-smaller-first", (rng, lv) => {
  const s = between(rng, COUNT_ON_SUMS[lv]);
  const a = rng.int(1, Math.min(3, Math.ceil(s / 2) - 1));
  const b = s - a;
  return {
    say: `What is ${a} plus ${b}?`,
    show: fade(lv, { kind: "number-line", from: 0, to: 10, marks: [b], jump: { from: b, by: a } }, `${a} + ${b} = ?`),
    answer: s,
    mistakes: plusMinus(s, 1, "off-by-one-counting"),
  };
});

const MAKE_TEN_START: ByLevel<Span> = { 1: [5, 9], 2: [3, 9], 3: [1, 9] };
const makeTenMistakes = (a: number): Mistake[] => [
  ...plusMinus(10 - a, 1, "off-by-one-counting"),
  { answer: a, tag: "gave-part" },
  { answer: 10, tag: "gave-total" },
];

const makeTenFrame = template("make-ten-frame", (rng, lv) => {
  const a = between(rng, MAKE_TEN_START[lv]);
  return {
    say: `${plural(a, "dot", "dots")}. How many more make 10?`,
    show: { kind: "ten-frames", first: a, second: 0 },
    answer: 10 - a,
    mistakes: makeTenMistakes(a),
  };
});

const makeTenBond = template("make-ten-bond", (rng, lv) => {
  const a = between(rng, MAKE_TEN_START[lv]);
  const item = rng.pick(ITEMS);
  return {
    say: `${a} plus what makes 10?`,
    show: fade(lv, { kind: "objects", icon: item.icon, groups: [a] }, `${a} + ? = 10`),
    answer: 10 - a,
    mistakes: makeTenMistakes(a),
  };
});

const MISSING_TOTAL: ByLevel<number> = { 1: 5, 2: 8, 3: 10 };

/** known + ? = c, with known ≥ 1 and answer ≥ 1. */
const missingPart = (rng: Rng, lv: Level): { known: number; c: number } => {
  const c = rng.int(2, MISSING_TOTAL[lv]);
  return { known: rng.int(1, c - 1), c };
};

const missingMistakes = (known: number, c: number): Mistake[] => [
  { answer: known + c, tag: "added-instead" },
  { answer: c, tag: "gave-total" },
  { answer: known, tag: "gave-part" },
  ...plusMinus(c - known, 1, "off-by-one-counting"),
];

const missingAddend = template("missing-addend", (rng, lv) => {
  const { known: a, c } = missingPart(rng, lv);
  return {
    say: `${a} plus what makes ${c}?`,
    show: fade(lv, { kind: "number-line", from: 0, to: c, marks: [a, c] }, `${a} + ? = ${c}`),
    answer: c - a,
    mistakes: missingMistakes(a, c),
  };
});

const missingFirst = template("missing-first", (rng, lv) => {
  const { known: b, c } = missingPart(rng, lv);
  return {
    say: `What plus ${b} makes ${c}?`,
    show: fade(lv, { kind: "number-line", from: 0, to: c, marks: [b, c] }, `? + ${b} = ${c}`),
    answer: c - b,
    mistakes: missingMistakes(b, c),
  };
});

export const addWithin10Cluster: Cluster = {
  id: "add-within-10",
  name: "Add within 10",
  skills: [
    {
      id: "add-within-10.pictures", name: "Add with pictures", grade: "K", commonCore: ["K.OA.A.1"],
      needs: ["count-to-20.objects-to-10"], styles: ["drawing", "blocks", "ten-frame", "story"],
      templates: ["add-objects-10", "add-ten-frame-10"],
    },
    {
      id: "add-within-10.within-5", name: "Add within 5", grade: "K", commonCore: ["K.OA.A.5"],
      needs: ["add-within-10.pictures"], styles: ["number-line", "blocks", "drawing"],
      templates: ["add-facts-5", "add-line-5"],
    },
    {
      id: "add-within-10.count-on", name: "Count on", grade: "1", commonCore: ["1.OA.C.5"],
      needs: ["add-within-10.within-5", "count-to-20.number-after"], styles: ["number-line", "blocks"],
      templates: ["count-on-bigger-first", "count-on-smaller-first"],
    },
    {
      id: "add-within-10.make-ten", name: "Make 10", grade: "K", commonCore: ["K.OA.A.4"],
      needs: ["add-within-10.within-5"], styles: ["ten-frame", "blocks", "number-line"],
      templates: ["make-ten-frame", "make-ten-bond"],
    },
    {
      id: "add-within-10.missing", name: "Missing number", grade: "1", commonCore: ["1.OA.D.8"],
      needs: ["add-within-10.make-ten"], styles: ["blocks", "number-line", "story"],
      templates: ["missing-addend", "missing-first"],
    },
  ],
  templates: [
    addObjects, addTenFrame, addFacts5, addLine5, countOnBiggerFirst, countOnSmallerFirst,
    makeTenFrame, makeTenBond, missingAddend, missingFirst,
  ],
};
