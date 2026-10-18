import type { Style } from "../types";
import { styleView } from "./styleView";

const PAIRS = Array.from({ length: 11 }, (_, a) => Array.from({ length: 11 - a }, (_, b) => [a, b] as [number, number])).flat();
const total = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

it("draws the exact views for 3 + 4", () => {
  expect(styleView("drawing", [3, 4])).toEqual({ kind: "objects", icon: "apple", groups: [3, 4] });
  expect(styleView("ten-frame", [3, 4])).toEqual({ kind: "ten-frames", first: 3, second: 4 });
  expect(styleView("number-line", [3, 4])).toEqual({ kind: "number-line", from: 0, to: 10, marks: [3], jump: { from: 3, by: 4 } });
  expect(styleView("blocks", [3, 4])).toEqual({ kind: "blocks", groups: [{ tens: 0, ones: 3 }, { tens: 0, ones: 4 }] });
});

it("story has no picture", () => expect(styleView("story", [3, 4])).toBeNull());

it.each(PAIRS)("every view of %i + %i adds up", (a, b) => {
  const view = (s: Style) => styleView(s, [a, b]);
  const d = view("drawing") as { groups: number[] };
  expect(total(d.groups)).toBe(a + b);
  const t = view("ten-frame") as { first: number; second: number };
  expect(t.first + t.second).toBe(a + b);
  const n = view("number-line") as { from: number; to: number; marks: number[]; jump: { from: number; by: number } };
  expect(n.jump.from + n.jump.by).toBe(a + b);
  expect([n.from, n.to, n.marks]).toEqual([0, 10, [a]]);
  const k = view("blocks") as { groups: { tens: number; ones: number }[] };
  expect(total(k.groups.map((g) => g.ones))).toBe(a + b);
  expect(total(k.groups.map((g) => g.tens))).toBe(0);
});
