import type { Rng } from "../rng";
import type { Cluster, Level, Mistake } from "../types";
import { between, plusMinus, template, type ByLevel, type Span } from "./kit";
import { ANIMALS, ITEMS, plural } from "./words";

type Cast = { A: string; B: string; C: string; items: string; icon: (typeof ITEMS)[number]["icon"]; has: (n: number) => string };

const cast = (rng: Rng): Cast => {
  const [A, B, C] = rng.shuffle(ANIMALS) as [string, string, string];
  const item = rng.pick(ITEMS);
  return { A, B, C, items: item.word, icon: item.icon, has: (n) => plural(n, item.one, item.word) };
};

/** `groups` (and `crossedOut`, the last N objects) are drawn at level 1 when every group is ≤ 20. */
type StoryDraft = { say: string; answer: number; groups: number[]; crossedOut?: number; mistakes: Mistake[] };

/** A story template: the story is both said and shown; pictures only at level 1 and only up to 20. */
const story = (id: string, write: (rng: Rng, lv: Level, c: Cast) => StoryDraft) =>
  template(id, (rng, lv) => {
    const c = cast(rng);
    const d = write(rng, lv, c);
    const picture = lv === 1 && d.groups.every((n) => n <= 20);
    const drawn = picture ? { groups: d.groups, ...(d.crossedOut === undefined ? {} : { crossedOut: d.crossedOut }) } : {};
    return {
      say: d.say,
      show: { kind: "story", text: d.say, icon: c.icon, ...drawn },
      answer: d.answer,
      mistakes: d.mistakes,
    };
  });

const ones = (n: number) => n % 10;
const MAX_20: ByLevel<number> = { 1: 10, 2: 15, 3: 20 };
const SPAN_100: ByLevel<Span> = { 1: [21, 50], 2: [21, 80], 3: [21, 100] };

/** a + b = s with a, b ≥ 1. */
const split = (rng: Rng, s: number): [number, number] => {
  const a = rng.int(1, s - 1);
  return [a, s - a];
};
/** a in span, b in 1…a−1 (so the answer is at least 1). */
const takeFrom = (rng: Rng, span: Span): [number, number] => {
  const a = between(rng, span);
  return [a, rng.int(1, a - 1)];
};

const addTo = (id: string, sums: (lv: Level) => Span, regroup: boolean) =>
  story(id, (rng, lv, c) => {
    const s = between(rng, sums(lv));
    const [a, b] = split(rng, s);
    return {
      say: `${c.A} has ${c.has(a)}. ${c.A} gets ${b} more. How many ${c.items} now?`,
      answer: s,
      groups: [a, b],
      mistakes: [
        { answer: Math.abs(a - b), tag: "wrong-operation" },
        ...(regroup && ones(a) + ones(b) >= 10 ? [{ answer: s - 10, tag: "forgot-to-regroup" as const }] : []),
        ...plusMinus(s, regroup ? 10 : 1, regroup ? "off-by-ten" : "off-by-one-counting"),
      ],
    };
  });

const putTogether = story("story-put-together", (rng, lv, c) => {
  const s = rng.int(2, MAX_20[lv]);
  const [a, b] = split(rng, s);
  return {
    say: `${c.A} has ${c.has(a)}. ${c.B} has ${b}. How many ${c.items} in all?`,
    answer: s,
    groups: [a, b],
    mistakes: [{ answer: Math.abs(a - b), tag: "wrong-operation" }, ...plusMinus(s, 1, "off-by-one-counting")],
  };
});

const takeAway = (id: string, starts: (lv: Level) => Span, regroup: boolean) =>
  story(id, (rng, lv, c) => {
    const [a, b] = takeFrom(rng, starts(lv));
    const d = a - b;
    return {
      say: `${c.A} has ${c.has(a)}. ${c.A} gives ${b} away. How many are left?`,
      answer: d,
      groups: [a],
      crossedOut: b,
      mistakes: [
        { answer: a + b, tag: "wrong-operation" },
        ...(regroup
          ? [
            ...(ones(a) < ones(b) ? [{ answer: d + 10, tag: "forgot-to-regroup" as const }] : []),
            ...plusMinus(d, 10, "off-by-ten"),
          ]
          : [{ answer: a, tag: "gave-part" as const }, ...plusMinus(d, 1, "off-by-one-counting")]),
      ],
    };
  });

const takeApart = story("story-take-apart", (rng, lv, c) => {
  const [total, red] = takeFrom(rng, [2, MAX_20[lv]]);
  return {
    say: `${c.A} has ${c.has(total)}. ${red} ${red === 1 ? "is" : "are"} red. The rest are blue. How many are blue?`,
    answer: total - red,
    groups: [total],
    mistakes: [
      { answer: total + red, tag: "wrong-operation" },
      { answer: total, tag: "gave-total" },
      ...plusMinus(total - red, 1, "off-by-one-counting"),
    ],
  };
});

const howMany = (id: string, ask: "more" | "fewer") =>
  story(id, (rng, lv, c) => {
    const [x, y] = takeFrom(rng, [2, MAX_20[lv]]);
    const question = ask === "more" ? `How many more does ${c.A} have?` : `How many fewer does ${c.B} have?`;
    return {
      say: `${c.A} has ${c.has(x)}. ${c.B} has ${y}. ${question}`,
      answer: x - y,
      groups: [x, y],
      mistakes: [
        { answer: x + y, tag: "wrong-operation" },
        { answer: x, tag: "gave-part" },
        ...plusMinus(x - y, 1, "off-by-one-counting"),
      ],
    };
  });

const TWO_STEP_MAX: ByLevel<number> = { 1: 20, 2: 50, 3: 100 };

const twoStepAddSub = story("story-two-step-add-sub", (rng, lv, c) => {
  const [a, b] = split(rng, rng.int(2, TWO_STEP_MAX[lv]));
  const g = rng.int(1, a + b - 1);
  const answer = a + b - g;
  return {
    say: `${c.A} has ${c.has(a)}. ${c.A} gets ${b} more, then gives ${g} away. How many now?`,
    answer,
    groups: [a, b],
    crossedOut: g,
    mistakes: [
      { answer: a + b, tag: "stopped-after-one-step" },
      { answer: a + b + g, tag: "wrong-operation" },
      ...plusMinus(answer, 1, "off-by-one-counting"),
    ],
  };
});

const twoStepAddAdd = story("story-two-step-add-add", (rng, lv, c) => {
  const total = rng.int(3, TWO_STEP_MAX[lv]);
  const a = rng.int(1, total - 2);
  const [b, g] = split(rng, total - a);
  return {
    say: `${c.A} has ${c.has(a)}. ${c.B} gives ${c.A} ${b}. ${c.C} gives ${c.A} ${g}. How many now?`,
    answer: total,
    groups: [a, b, g],
    mistakes: [{ answer: a + b, tag: "stopped-after-one-step" }, ...plusMinus(total, 1, "off-by-one-counting")],
  };
});

export const wordProblemsCluster: Cluster = {
  id: "word-problems",
  name: "Word problems",
  skills: [
    {
      id: "word-problems.add", name: "Adding stories", grade: "1", commonCore: ["1.OA.A.1"],
      needs: ["add-subtract-within-20.make-ten"], styles: ["story", "drawing", "blocks"],
      templates: ["story-add-to", "story-put-together"],
    },
    {
      id: "word-problems.subtract", name: "Taking-away stories", grade: "1", commonCore: ["1.OA.A.1"],
      needs: ["add-subtract-within-20.subtract"], styles: ["story", "drawing", "number-line"],
      templates: ["story-take-from", "story-take-apart"],
    },
    {
      id: "word-problems.compare", name: "How many more", grade: "1", commonCore: ["1.OA.A.1"],
      needs: ["word-problems.add", "word-problems.subtract"], styles: ["story", "number-line", "blocks"],
      templates: ["story-how-many-more", "story-how-many-fewer"],
    },
    {
      id: "word-problems.to-100", name: "Stories to 100", grade: "2", commonCore: ["2.OA.A.1"],
      needs: [
        "word-problems.add", "word-problems.subtract",
        "add-subtract-within-100.add-regroup", "add-subtract-within-100.subtract-regroup",
      ],
      styles: ["story", "blocks", "number-line"],
      templates: ["story-add-100", "story-sub-100"],
    },
    {
      id: "word-problems.two-step", name: "Two-step stories", grade: "2", commonCore: ["2.OA.A.1"],
      needs: ["word-problems.compare", "word-problems.to-100"], styles: ["story", "number-line", "blocks"],
      templates: ["story-two-step-add-sub", "story-two-step-add-add"],
    },
  ],
  templates: [
    addTo("story-add-to", (lv) => [2, MAX_20[lv]], false),
    putTogether,
    takeAway("story-take-from", (lv) => [2, MAX_20[lv]], false),
    takeApart,
    howMany("story-how-many-more", "more"),
    howMany("story-how-many-fewer", "fewer"),
    addTo("story-add-100", (lv) => SPAN_100[lv], true),
    takeAway("story-sub-100", (lv) => SPAN_100[lv], true),
    twoStepAddSub,
    twoStepAddAdd,
  ],
};
