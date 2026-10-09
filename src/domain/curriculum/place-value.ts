import type { Rng } from "../rng";
import type { Cluster, Level } from "../types";
import { compareNumbers, distinctPair } from "./compare-numbers";
import { between, fade, plusMinus, template, type ByLevel, type Span } from "./kit";

const TEENS: ByLevel<Span> = { 1: [11, 14], 2: [11, 17], 3: [11, 19] };
const TWO_DIGIT: ByLevel<Span> = { 1: [20, 49], 2: [20, 79], 3: [20, 99] };

const digits = (n: number) => ({ tens: Math.floor(n / 10), ones: n % 10 });

const teenBlocks = template("teen-blocks", (rng, lv) => {
  const o = between(rng, TEENS[lv]) - 10;
  return {
    say: `One ten and ${o} ones. What number is it?`,
    show: { kind: "blocks", groups: [{ tens: 1, ones: o }] },
    answer: 10 + o,
    mistakes: [
      { answer: 1 + o, tag: "added-digits" },
      { answer: o, tag: "counted-ones-only" },
      ...plusMinus(10 + o, 1, "off-by-one-counting"),
    ],
  };
});

const teenSplit = template("teen-split", (rng, lv) => {
  const n = between(rng, TEENS[lv]);
  const o = n - 10;
  return {
    say: `${n} is 10 and how many ones?`,
    show: lv === 1
      ? { kind: "blocks", groups: [{ tens: 1, ones: o }] }
      : fade(lv, { kind: "ten-frames", first: 10, second: o }, `10 + ? = ${n}`),
    answer: o,
    mistakes: [{ answer: n, tag: "gave-total" }, { answer: 10, tag: "gave-part" }, ...plusMinus(o, 1, "off-by-one-counting")],
  };
});

const blocksToNumber = template("blocks-to-number", (rng, lv) => {
  const n = between(rng, TWO_DIGIT[lv]);
  const { tens: t, ones: o } = digits(n);
  return {
    say: `${t} tens and ${o} ones. What number is it?`,
    show: { kind: "blocks", groups: [{ tens: t, ones: o }] },
    answer: n,
    mistakes: [
      ...(o >= 1 && o !== t ? [{ answer: 10 * o + t, tag: "swapped-digits" as const }] : []),
      { answer: t + o, tag: "added-digits" },
      ...plusMinus(n, 10, "off-by-ten"),
      ...plusMinus(n, 1, "off-by-one-counting"),
    ],
  };
});

const tensInNumber = template("tens-in-number", (rng, lv) => {
  const n = between(rng, TWO_DIGIT[lv]);
  const { tens: t, ones: o } = digits(n);
  return {
    say: `How many tens are in ${n}?`,
    show: fade(lv, { kind: "blocks", groups: [{ tens: t, ones: o }] }, `${n}`),
    answer: t,
    mistakes: [{ answer: o, tag: "picked-ones-digit" }],
  };
});

/** L1: different tens, ≥ 10 apart. L2: ≥ 3 apart. L3: same tens digit, or swapped digits (47 vs 74). */
const twoDigitPair = (rng: Rng, lv: Level): [number, number] => {
  if (lv === 1) return distinctPair(rng, [10, 99], 10);
  if (lv === 2) return distinctPair(rng, [10, 99], 3);
  const t = rng.int(1, 9);
  if (rng.chance(0.5)) {
    const [a, b] = distinctPair(rng, [0, 9], 1);
    return [10 * t + a, 10 * t + b];
  }
  let o = rng.int(1, 8);
  if (o >= t) o += 1; // o in 1–9, never equal to t
  return [10 * t + o, 10 * o + t];
};

const tenStep = (id: string, step: 10 | -10, start: ByLevel<(rng: Rng) => number>) =>
  template(id, (rng, lv) => {
    const n = start[lv](rng);
    const more = step > 0;
    return {
      say: `What is 10 ${more ? "more" : "less"} than ${n}?`,
      show: fade(lv, { kind: "blocks", groups: [digits(n)] }, `${n} ${more ? "+" : "−"} 10 = ?`),
      answer: n + step,
      mistakes: more
        ? [{ answer: n + 1, tag: "added-one" }, { answer: n - 10, tag: "subtracted-instead" }]
        : [{ answer: n - 1, tag: "subtracted-one" }, { answer: n + 10, tag: "added-instead" }],
    };
  });

export const placeValueCluster: Cluster = {
  id: "place-value",
  name: "Place value - tens and ones",
  skills: [
    {
      id: "place-value.teens", name: "Teen numbers", grade: "K", commonCore: ["K.NBT.A.1"],
      needs: ["count-to-20.objects-to-20"], styles: ["blocks", "ten-frame"],
      templates: ["teen-blocks", "teen-split"],
    },
    {
      id: "place-value.tens-ones", name: "Tens and ones", grade: "1", commonCore: ["1.NBT.B.2"],
      needs: ["place-value.teens", "compare-numbers.to-20"], styles: ["blocks", "drawing"],
      templates: ["blocks-to-number", "tens-in-number"],
    },
    {
      id: "place-value.compare", name: "Compare two-digit numbers", grade: "1", commonCore: ["1.NBT.B.3"],
      needs: ["place-value.tens-ones"], styles: ["blocks", "number-line"],
      templates: ["compare-bigger-100", "compare-smaller-100"],
    },
    {
      id: "place-value.ten-more-less", name: "10 more, 10 less", grade: "1", commonCore: ["1.NBT.C.5"],
      needs: ["place-value.tens-ones"], styles: ["blocks", "number-line"],
      templates: ["ten-more", "ten-less"],
    },
  ],
  templates: [
    teenBlocks,
    teenSplit,
    blocksToNumber,
    tensInNumber,
    compareNumbers("compare-bigger-100", "bigger", 100, twoDigitPair),
    compareNumbers("compare-smaller-100", "smaller", 100, twoDigitPair),
    tenStep("ten-more", 10, { 1: (r) => 10 * r.int(1, 8), 2: (r) => r.int(10, 59), 3: (r) => r.int(10, 89) }),
    tenStep("ten-less", -10, { 1: (r) => 10 * r.int(2, 9), 2: (r) => r.int(20, 69), 3: (r) => r.int(20, 99) }),
  ],
};
