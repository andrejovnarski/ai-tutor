import type { Rng } from "../rng";
import type { Cluster, Level } from "../types";
import { between, fade, template, type ByLevel, type Span } from "./kit";
import { ITEMS } from "./words";

/** Two numbers from `span`, at least `minDiff` apart. */
export const distinctPair = (rng: Rng, span: Span, minDiff: number): [number, number] => {
  for (;;) {
    const x = between(rng, span);
    const y = between(rng, span);
    if (Math.abs(x - y) >= minDiff) return [x, y];
  }
};

type Ask = "bigger" | "smaller";
const pickBy = (ask: Ask, x: number, y: number) => (ask === "bigger" ? Math.max(x, y) : Math.min(x, y));
const other = (ask: Ask, x: number, y: number) => (ask === "bigger" ? Math.min(x, y) : Math.max(x, y));

const compareGroups = (id: string, ask: Ask) =>
  template(id, (rng, lv) => {
    const rule: ByLevel<[Span, number]> = { 1: [[1, 5], 2], 2: [[1, 8], 1], 3: [[1, 10], 1] };
    const [x, y] = distinctPair(rng, ...rule[lv]);
    const item = rng.pick(ITEMS);
    return {
      say: `Which group has ${ask === "bigger" ? "more" : "fewer"}?`,
      show: { kind: "objects", icon: item.icon, groups: [x, y] },
      answer: pickBy(ask, x, y),
      mistakes: [{ answer: other(ask, x, y), tag: "picked-other" }],
      choiceCount: 2,
    };
  });

/** "Which is bigger/smaller, x or y?" on a 0…max number line; `pair` sets the numbers per level. */
export const compareNumbers = (id: string, ask: Ask, max: number, pair: (rng: Rng, lv: Level) => [number, number]) =>
  template(id, (rng, lv) => {
    const [x, y] = pair(rng, lv);
    return {
      say: `Which is ${ask}, ${x} or ${y}?`,
      show: fade(lv, { kind: "number-line", from: 0, to: max, marks: [x, y] }, `${x} or ${y}?`),
      answer: pickBy(ask, x, y),
      mistakes: [{ answer: other(ask, x, y), tag: "picked-other" }],
      choiceCount: 2,
    };
  });

const upTo = (max: number) => (rng: Rng, lv: Level) =>
  distinctPair(rng, [0, max], ({ 1: 5, 2: 2, 3: 1 } as ByLevel<number>)[lv]);

export const compareNumbersCluster: Cluster = {
  id: "compare-numbers",
  name: "Compare numbers",
  skills: [
    {
      id: "compare-numbers.groups", name: "More or fewer", grade: "K", commonCore: ["K.CC.C.6"],
      needs: ["count-to-20.objects-to-10"], styles: ["drawing", "blocks", "ten-frame"],
      templates: ["compare-groups-more", "compare-groups-fewer"],
    },
    {
      id: "compare-numbers.to-10", name: "Bigger or smaller to 10", grade: "K", commonCore: ["K.CC.C.7"],
      needs: ["compare-numbers.groups"], styles: ["number-line", "blocks"],
      templates: ["compare-bigger-10", "compare-smaller-10"],
    },
    {
      id: "compare-numbers.to-20", name: "Bigger or smaller to 20", grade: "K", commonCore: ["K.CC.C.7"],
      needs: ["compare-numbers.to-10", "count-to-20.objects-to-20"], styles: ["number-line", "blocks"],
      templates: ["compare-bigger-20", "compare-smaller-20"],
    },
  ],
  templates: [
    compareGroups("compare-groups-more", "bigger"),
    compareGroups("compare-groups-fewer", "smaller"),
    compareNumbers("compare-bigger-10", "bigger", 10, upTo(10)),
    compareNumbers("compare-smaller-10", "smaller", 10, upTo(10)),
    compareNumbers("compare-bigger-20", "bigger", 20, upTo(20)),
    compareNumbers("compare-smaller-20", "smaller", 20, upTo(20)),
  ],
};
