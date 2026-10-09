import { LEVELS, type Level, type Mistake, type Visual } from "../types";
import { samples, sayNumbers, tpl } from "./testkit";
import { ANIMALS } from "./words";

type Story = Extract<Visual, { kind: "story" }>;

type Spec = {
  id: string;
  /** Answer from the numbers in story order. */
  solve: (n: number[]) => number;
  /** The bounded number (answer, start, or a + b). */
  bounded: (n: number[], answer: number) => number;
  bounds: Record<Level, [min: number, max: number]>;
  first: (n: number[], answer: number) => Mistake;
};

const B20: Record<Level, [number, number]> = { 1: [2, 10], 2: [2, 15], 3: [2, 20] };
const SPECS: Spec[] = [
  { id: "story-add-to", solve: ([a, b]) => a! + b!, bounded: (_n, s) => s, bounds: B20,
    first: ([a, b]) => ({ answer: Math.abs(a! - b!), tag: "wrong-operation" }) },
  { id: "story-put-together", solve: ([a, b]) => a! + b!, bounded: (_n, s) => s, bounds: B20,
    first: ([a, b]) => ({ answer: Math.abs(a! - b!), tag: "wrong-operation" }) },
  { id: "story-take-from", solve: ([a, b]) => a! - b!, bounded: ([a]) => a!, bounds: B20,
    first: ([a, b]) => ({ answer: a! + b!, tag: "wrong-operation" }) },
  { id: "story-take-apart", solve: ([c, a]) => c! - a!, bounded: ([c]) => c!, bounds: B20,
    first: ([c, a]) => ({ answer: c! + a!, tag: "wrong-operation" }) },
  { id: "story-how-many-more", solve: ([x, y]) => x! - y!, bounded: ([x]) => x!, bounds: B20,
    first: ([x, y]) => ({ answer: x! + y!, tag: "wrong-operation" }) },
  { id: "story-how-many-fewer", solve: ([x, y]) => x! - y!, bounded: ([x]) => x!, bounds: B20,
    first: ([x, y]) => ({ answer: x! + y!, tag: "wrong-operation" }) },
  { id: "story-add-100", solve: ([a, b]) => a! + b!, bounded: (_n, s) => s, bounds: { 1: [21, 50], 2: [21, 80], 3: [21, 100] },
    first: ([a, b]) => ({ answer: Math.abs(a! - b!), tag: "wrong-operation" }) },
  { id: "story-sub-100", solve: ([a, b]) => a! - b!, bounded: ([a]) => a!, bounds: { 1: [21, 50], 2: [21, 80], 3: [21, 100] },
    first: ([a, b]) => ({ answer: a! + b!, tag: "wrong-operation" }) },
  { id: "story-two-step-add-sub", solve: ([a, b, c]) => a! + b! - c!, bounded: ([a, b]) => a! + b!,
    bounds: { 1: [2, 20], 2: [2, 50], 3: [2, 100] }, first: ([a, b]) => ({ answer: a! + b!, tag: "stopped-after-one-step" }) },
  { id: "story-two-step-add-add", solve: ([a, b, c]) => a! + b! + c!, bounded: (_n, s) => s,
    bounds: { 1: [3, 20], 2: [3, 50], 3: [3, 100] }, first: ([a, b]) => ({ answer: a! + b!, tag: "stopped-after-one-step" }) },
];

describe.each(SPECS.map((s) => [s.id, s] as const))("%s", (_id, s) => {
  it.each(LEVELS.map((l) => [l]))("level %i: answer, bounds, story picture, first mistake", (lv) => {
    const seen: number[] = [];
    for (const p of samples(tpl(s.id), lv)) {
      const n = sayNumbers(p.prompt.say);
      expect(p.answer).toBe(s.solve(n));
      expect(p.answer).toBeGreaterThanOrEqual(1);
      seen.push(s.bounded(n, p.answer));
      const want = s.first(n, p.answer);
      if (want.answer <= 100 && Math.abs(want.answer - p.answer) > 1) expect(p.mistakes[0]).toEqual(want);
      const show = p.prompt.show as Story;
      expect(show.kind).toBe("story");
      expect(show.text).toBe(p.prompt.say);
      if (lv === 1 && n.every((x) => x <= 20)) expect(show.groups).toBeDefined();
      else expect(show.groups).toBeUndefined();
      const animals = ANIMALS.filter((a) => p.prompt.say.includes(a));
      expect(animals.length).toBeGreaterThanOrEqual(1);
    }
    expect([Math.min(...seen), Math.max(...seen)]).toEqual(s.bounds[lv]);
  });
});

it("two animals in a story are different", () => {
  for (const p of samples(tpl("story-put-together"), 1)) {
    const [, first, second] = p.prompt.say.match(/^(\w+) has .*?\. (\w+) has/)!;
    expect(first).not.toBe(second);
  }
});

it("forgot-to-regroup offered only when the story regroups", () => {
  for (const p of samples(tpl("story-add-100"), 3)) {
    const [a, b] = sayNumbers(p.prompt.say) as [number, number];
    const regroups = (a % 10) + (b % 10) >= 10;
    expect(p.mistakes.some((m) => m.tag === "forgot-to-regroup")).toBe(regroups && Math.abs(a - b) !== p.answer - 10);
  }
});
