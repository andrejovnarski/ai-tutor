import type { Rng } from "../rng";
import type { Cluster, Level, Mistake } from "../types";
import { between, fade, plusMinus, template, type ByLevel, type Span } from "./kit";
import { ITEMS } from "./words";

/** a − b with a in `span`, b ≥ 1; the answer is ≥ 1 at level 1 and may be 0 above. */
const takeAway = (rng: Rng, lv: Level, span: Span): [number, number] => {
  const a = between(rng, span);
  return [a, rng.int(1, lv === 1 ? a - 1 : a)];
};

export const subMistakes = (a: number, b: number): Mistake[] => [
  ...plusMinus(a - b, 1, "off-by-one-counting"),
  { answer: a + b, tag: "added-instead" },
  { answer: a, tag: "gave-part" },
];

const PICTURE_START: ByLevel<Span> = { 1: [2, 5], 2: [2, 8], 3: [2, 10] };
const FACTS_5_START: ByLevel<Span> = { 1: [2, 5], 2: [1, 5], 3: [1, 5] };

const subObjects = template("sub-objects-10", (rng, lv) => {
  const [a, b] = takeAway(rng, lv, PICTURE_START[lv]);
  const item = rng.pick(ITEMS);
  return {
    say: `${a} ${item.word}. ${b} go away. How many are left?`,
    show: { kind: "objects", icon: item.icon, groups: [a], crossedOut: b },
    answer: a - b,
    mistakes: subMistakes(a, b),
  };
});

const subTenFrame = template("sub-ten-frame-10", (rng, lv) => {
  const [a, b] = takeAway(rng, lv, PICTURE_START[lv]);
  return {
    say: `${a} dots. Take away ${b}. How many are left?`,
    show: { kind: "ten-frames", first: a, second: 0, crossedOut: b },
    answer: a - b,
    mistakes: subMistakes(a, b),
  };
});

const subFacts5 = template("sub-facts-5", (rng, lv) => {
  const [a, b] = takeAway(rng, lv, FACTS_5_START[lv]);
  const item = rng.pick(ITEMS);
  return {
    say: `What is ${a} minus ${b}?`,
    show: fade(lv, { kind: "objects", icon: item.icon, groups: [a], crossedOut: b }, `${a} − ${b} = ?`),
    answer: a - b,
    mistakes: subMistakes(a, b),
  };
});

const subLine5 = template("sub-line-5", (rng, lv) => {
  const [a, b] = takeAway(rng, lv, FACTS_5_START[lv]);
  return {
    say: `Start at ${a}. Jump back ${b}.`,
    show: fade(lv, { kind: "number-line", from: 0, to: 5, marks: [], jump: { from: a, by: -b } }, `${a} − ${b} = ?`),
    answer: a - b,
    mistakes: subMistakes(a, b),
  };
});

const subFacts10 = template("sub-facts-10", (rng, lv) => {
  const [a, b] = takeAway(rng, lv, ({ 1: [3, 7], 2: [2, 10], 3: [2, 10] } as ByLevel<Span>)[lv]);
  return {
    say: `What is ${a} minus ${b}?`,
    show: fade(lv, { kind: "ten-frames", first: a, second: 0, crossedOut: b }, `${a} − ${b} = ?`),
    answer: a - b,
    mistakes: subMistakes(a, b),
  };
});

const subCountBack = template("sub-count-back", (rng, lv) => {
  const a = between(rng, ({ 1: [4, 7], 2: [4, 10], 3: [4, 10] } as ByLevel<Span>)[lv]);
  const b = rng.int(1, 3);
  return {
    say: `Start at ${a}. Count back ${b}.`,
    show: fade(lv, { kind: "number-line", from: 0, to: 10, marks: [a], jump: { from: a, by: -b } }, `${a} − ${b} = ?`),
    answer: a - b,
    mistakes: plusMinus(a - b, 1, "off-by-one-counting"),
  };
});

const breakApart = (id: string, picture: "objects" | "ten-frames") =>
  template(id, (rng, lv) => {
    const c = between(rng, PICTURE_START[lv]);
    const a = rng.int(1, c - 1);
    const item = rng.pick(ITEMS);
    return {
      say: `${c} is ${a} and how many more?`,
      show: fade(
        lv,
        picture === "objects"
          ? { kind: "objects", icon: item.icon, groups: [c] }
          : { kind: "ten-frames", first: a, second: 0 },
        `${a} + ? = ${c}`,
      ),
      answer: c - a,
      mistakes: [
        { answer: c, tag: "gave-total" },
        { answer: a, tag: "gave-part" },
        { answer: c + a, tag: "added-instead" },
        ...plusMinus(c - a, 1, "off-by-one-counting"),
      ],
    };
  });

export const subtractWithin10Cluster: Cluster = {
  id: "subtract-within-10",
  name: "Subtract within 10",
  skills: [
    {
      id: "subtract-within-10.pictures", name: "Take away with pictures", grade: "K", commonCore: ["K.OA.A.1"],
      needs: ["count-to-20.objects-to-10"], styles: ["drawing", "blocks", "story"],
      templates: ["sub-objects-10", "sub-ten-frame-10"],
    },
    {
      id: "subtract-within-10.within-5", name: "Subtract within 5", grade: "K", commonCore: ["K.OA.A.5"],
      needs: ["subtract-within-10.pictures"], styles: ["number-line", "blocks", "drawing"],
      templates: ["sub-facts-5", "sub-line-5"],
    },
    {
      id: "subtract-within-10.within-10", name: "Subtract within 10", grade: "K", commonCore: ["K.OA.A.5"],
      needs: ["subtract-within-10.within-5"], styles: ["number-line", "blocks", "ten-frame"],
      templates: ["sub-facts-10", "sub-count-back"],
    },
    {
      id: "subtract-within-10.break-apart", name: "Break apart", grade: "K", commonCore: ["K.OA.A.3"],
      needs: ["subtract-within-10.within-10", "add-within-10.within-5"], styles: ["blocks", "ten-frame", "drawing"],
      templates: ["break-apart", "break-apart-frame"],
    },
  ],
  templates: [
    subObjects, subTenFrame, subFacts5, subLine5, subFacts10, subCountBack,
    breakApart("break-apart", "objects"), breakApart("break-apart-frame", "ten-frames"),
  ],
};
