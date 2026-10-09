import type { Cluster } from "../types";
import { between, plusMinus, template, type ByLevel, type Span } from "./kit";
import { ITEMS } from "./words";

const countObjects = (id: string, n: ByLevel<Span>) =>
  template(id, (rng, lv) => {
    const count = between(rng, n[lv]);
    const item = rng.pick(ITEMS);
    return {
      say: `How many ${item.word}?`,
      show: { kind: "objects", icon: item.icon, groups: [count] },
      answer: count,
      mistakes: plusMinus(count, 1, "off-by-one-counting"),
    };
  });

const countTenFrame = (id: string, n: ByLevel<Span>) =>
  template(id, (rng, lv) => {
    const count = between(rng, n[lv]);
    return {
      say: "How many dots?",
      show: { kind: "ten-frames", first: count, second: 0 },
      answer: count,
      mistakes: plusMinus(count, 1, "off-by-one-counting"),
    };
  });

const TO_10: ByLevel<Span> = { 1: [1, 5], 2: [3, 8], 3: [5, 10] };
const TO_20: ByLevel<Span> = { 1: [10, 13], 2: [11, 16], 3: [11, 20] };

const numberAfter = template("number-after", (rng, lv) => {
  const n = between(rng, ({ 1: [1, 5], 2: [1, 9], 3: [1, 19] } as ByLevel<Span>)[lv]);
  return {
    say: `What number comes after ${n}?`,
    show: { kind: "number-line", from: Math.max(0, n - 3), to: n + 3, marks: [n] },
    answer: n + 1,
    mistakes: [{ answer: n, tag: "repeated-number" }, { answer: n - 1, tag: "counted-back" }],
  };
});

const countSequence = template("count-sequence", (rng, lv) => {
  const a = between(rng, ({ 1: [1, 4], 2: [1, 9], 3: [1, 17] } as ByLevel<Span>)[lv]);
  return {
    say: `${a}, ${a + 1}, ${a + 2}. What comes next?`,
    show: { kind: "number-line", from: a, to: a + 5, marks: [a, a + 1, a + 2] },
    answer: a + 3,
    mistakes: [{ answer: a + 2, tag: "repeated-number" }, { answer: a + 4, tag: "skipped-number" }],
  };
});

export const countTo20: Cluster = {
  id: "count-to-20",
  name: "Count to 20",
  skills: [
    {
      id: "count-to-20.objects-to-10", name: "Count to 10", grade: "K", commonCore: ["K.CC.B.5"],
      needs: [], styles: ["drawing", "ten-frame", "blocks"],
      templates: ["count-objects-10", "count-ten-frame-10"],
    },
    {
      id: "count-to-20.objects-to-20", name: "Count to 20", grade: "K", commonCore: ["K.CC.B.5"],
      needs: ["count-to-20.objects-to-10"], styles: ["ten-frame", "blocks", "drawing"],
      templates: ["count-objects-20", "count-ten-frame-20"],
    },
    {
      id: "count-to-20.number-after", name: "What comes next", grade: "K", commonCore: ["K.CC.A.2"],
      needs: ["count-to-20.objects-to-10"], styles: ["number-line", "drawing"],
      templates: ["number-after", "count-sequence"],
    },
  ],
  templates: [
    countObjects("count-objects-10", TO_10),
    countObjects("count-objects-20", TO_20),
    countTenFrame("count-ten-frame-10", TO_10),
    countTenFrame("count-ten-frame-20", TO_20),
    numberAfter,
    countSequence,
  ],
};
