import { renderToStaticMarkup } from "react-dom/server";
import type { Visual as V } from "@/domain/types";
import { Visual, describeVisual } from "./Visual";
import { ICONS } from "./icons";

const render = (v: V) => renderToStaticMarkup(<Visual v={v} />);
const count = (html: string, attr: string) => (html.match(new RegExp(`\\s${attr}(=|\\s|>|/)`, "g")) ?? []).length;
const attrCount = (html: string, attr: string, val: string) => html.split(`${attr}="${val}"`).length - 1;
const labels = (html: string) => [...html.matchAll(/data-label="([^"]*)"[^>]*>([^<]*)</g)].map((m) => m[2]!);

const num = (tag: string, a: string) => {
  const m = tag.match(new RegExp(`\\s${a}="(-?[\\d.]+)"`));
  return m ? Number(m[1]) : undefined;
};
// Asserts every positioned element is inside the viewBox; returns how many things were checked.
function assertInside(html: string): number {
  const vb = html.match(/viewBox="([\d.\s-]+)"/)![1]!.split(/\s+/).map(Number);
  const W = vb[2]!;
  const H = vb[3]!;
  let checked = 0;
  const inX = (x: number) => { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(W); checked++; };
  const inY = (y: number) => { expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(H); checked++; };
  for (const m of html.matchAll(/<(rect|circle|ellipse|text|line|path)\b[^>]*>/g)) {
    const t = m[0];
    const k = m[1];
    if (k === "rect") {
      const [x, y, w, h] = [num(t, "x"), num(t, "y"), num(t, "width"), num(t, "height")];
      if (x !== undefined) { inX(x); inX(x + w!); }
      if (y !== undefined) { inY(y); inY(y + h!); }
    } else if (k === "circle") {
      const [cx, cy, r] = [num(t, "cx")!, num(t, "cy")!, num(t, "r")!];
      inX(cx - r); inX(cx + r); inY(cy - r); inY(cy + r);
    } else if (k === "ellipse") {
      const [cx, cy, rx, ry] = [num(t, "cx")!, num(t, "cy")!, num(t, "rx")!, num(t, "ry")!];
      inX(cx - rx); inX(cx + rx); inY(cy - ry); inY(cy + ry);
    } else if (k === "text") {
      inX(num(t, "x")!); inY(num(t, "y")!);
    } else if (k === "line") {
      inX(num(t, "x1")!); inX(num(t, "x2")!); inY(num(t, "y1")!); inY(num(t, "y2")!);
    } else {
      const d = t.match(/\sd="([^"]*)"/)![1]!;
      const ns = d.match(/-?[\d.]+/g)!.map(Number);
      for (let i = 0; i + 1 < ns.length; i += 2) { inX(ns[i]!); inY(ns[i + 1]!); }
    }
  }
  return checked;
}

describe("every visual", () => {
  const all: V[] = [
    { kind: "objects", icon: "apple", groups: [3, 4] },
    { kind: "ten-frames", first: 3, second: 4 },
    { kind: "number-line", from: 0, to: 10, marks: [3] },
    { kind: "blocks", groups: [{ tens: 1, ones: 2 }] },
    { kind: "equation", text: "3 + 4 = ?" },
    { kind: "story", text: "Mia has apples.", icon: "apple", groups: [3] },
  ];
  it("is a scalable svg image with a non-empty aria-label", () => {
    for (const v of all) {
      const html = render(v);
      expect(html.startsWith("<svg")).toBe(true);
      expect(html).toContain('role="img"');
      expect(html).toContain('width="100%"');
      expect(html).toContain('height="100%"');
      expect(html).toContain('preserveAspectRatio="xMidYMid meet"');
      expect(describeVisual(v).length).toBeGreaterThan(0);
      expect(html).toContain(`aria-label="${describeVisual(v)}"`);
    }
  });
  it("draws each of the 8 icons", () => {
    expect(Object.keys(ICONS).sort()).toEqual(["apple", "ball", "block", "cookie", "duck", "fish", "shell", "star"]);
    for (const name of Object.keys(ICONS) as (keyof typeof ICONS)[]) {
      const html = renderToStaticMarkup(<svg>{ICONS[name]({ cx: 50, cy: 50, s: 40 })}</svg>);
      expect(html).toContain(`data-icon="${name}"`);
    }
  });
});

describe("ten-frames", () => {
  it("3+4 is one frame: 3 red, 4 yellow, 3 empty", () => {
    const html = render({ kind: "ten-frames", first: 3, second: 4 });
    expect(count(html, "data-frame")).toBe(1);
    expect(attrCount(html, "data-counter", "red")).toBe(3);
    expect(attrCount(html, "data-counter", "yellow")).toBe(4);
    expect(count(html, "data-empty")).toBe(3);
  });
  it("8+5 needs two frames", () => {
    const html = render({ kind: "ten-frames", first: 8, second: 5 });
    expect(count(html, "data-frame")).toBe(2);
    expect(attrCount(html, "data-counter", "red")).toBe(8);
    expect(attrCount(html, "data-counter", "yellow")).toBe(5);
    expect(count(html, "data-empty")).toBe(7);
  });
  it("crosses out the last N dots", () => {
    const html = render({ kind: "ten-frames", first: 7, second: 0, crossedOut: 2 });
    expect(count(html, "data-cross")).toBe(2);
  });
  it("12+3 fills frame 1 with 10 red, frame 2 with 2 red, 3 yellow, 5 empty", () => {
    const html = render({ kind: "ten-frames", first: 12, second: 3 });
    const frames = [...html.matchAll(/data-frame="true" x="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(frames).toHaveLength(2);
    const boundary = frames[1]! - 1;
    const inFrame = (re: RegExp) => {
      const xs = [...html.matchAll(re)].map((m) => Number(m[1]));
      return [xs.filter((x) => x < boundary).length, xs.filter((x) => x >= boundary).length];
    };
    expect(inFrame(/data-counter="red" cx="([\d.]+)"/g)).toEqual([10, 2]);
    expect(inFrame(/data-counter="yellow" cx="([\d.]+)"/g)).toEqual([0, 3]);
    expect(inFrame(/data-empty="true" x="([\d.]+)"/g)).toEqual([0, 5]);
  });
  it("puts the crosses on the last N filled cells", () => {
    const html = render({ kind: "ten-frames", first: 8, second: 5, crossedOut: 3 });
    const counters = [...html.matchAll(/data-counter="\w+" cx="([\d.]+)" cy="([\d.]+)"/g)].map((m) => `${m[1]},${m[2]}`);
    const crosses = [...html.matchAll(/data-cross="true" data-cx="([\d.]+)" data-cy="([\d.]+)"/g)].map((m) => `${m[1]},${m[2]}`);
    expect(counters).toHaveLength(13);
    expect(crosses).toEqual(counters.slice(-3));
  });
  it("describes counters without the total", () => {
    const d = describeVisual({ kind: "ten-frames", first: 3, second: 4 });
    expect(d).toContain("3 red counters and 4 yellow counters");
    expect(d).not.toMatch(/\b7\b/);
  });
});

describe("objects", () => {
  it("3 and 4 apples: 7 icons in 2 groups", () => {
    const html = render({ kind: "objects", icon: "apple", groups: [3, 4] });
    expect(attrCount(html, "data-icon", "apple")).toBe(7);
    expect(count(html, "data-group")).toBe(2);
    expect(count(html, "data-cross")).toBe(0);
  });
  it("crosses out 2", () => {
    const html = render({ kind: "objects", icon: "apple", groups: [7], crossedOut: 2 });
    expect(count(html, "data-cross")).toBe(2);
  });
  it("describes what is drawn and never the difference", () => {
    const d = describeVisual({ kind: "objects", icon: "apple", groups: [7], crossedOut: 2 });
    expect(d).toContain("7 apples");
    expect(d).toContain("2 crossed out");
    expect(d).not.toMatch(/\b5\b/);
  });
  it("puts the crosses on the last N of the first group", () => {
    const html = render({ kind: "objects", icon: "apple", groups: [6, 2], crossedOut: 2 });
    const g0 = html.split('data-group="1"')[0]!;
    const slots = [...g0.matchAll(/data-x="([\d.]+)" data-y="([\d.]+)"/g)].map((m) => `${m[1]},${m[2]}`);
    const crosses = [...html.matchAll(/data-cross="true" data-cx="([\d.]+)" data-cy="([\d.]+)"/g)].map((m) => `${m[1]},${m[2]}`);
    expect(slots).toHaveLength(6);
    expect(crosses).toEqual(slots.slice(-2));
  });
  it("wraps rows at 5", () => {
    const html = render({ kind: "objects", icon: "star", groups: [10] });
    const ys = new Set([...html.matchAll(/data-y="([\d.]+)"/g)].map((m) => m[1]!));
    expect(ys.size).toBe(2);
  });
});

describe("number-line", () => {
  it("0..10 with a mark and a jump", () => {
    const v: V = { kind: "number-line", from: 0, to: 10, marks: [3], jump: { from: 3, by: 4 } };
    const html = render(v);
    expect(count(html, "data-tick")).toBe(11);
    expect(labels(html).filter((l) => /^\d+$/.test(l))).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
    expect(count(html, "data-mark")).toBe(1);
    expect(count(html, "data-jump")).toBe(1);
    expect(labels(html)).toContain("+4");
    assertInside(html);
  });
  it("0..100 labels only multiples of 10 and keeps 47 off the line", () => {
    const v: V = { kind: "number-line", from: 0, to: 100, marks: [], jump: { from: 40, by: 7 } };
    const html = render(v);
    const nums = labels(html).filter((l) => /^\d+$/.test(l));
    expect(nums).toEqual(["0", "10", "20", "30", "40", "50", "60", "70", "80", "90", "100"]);
    expect(html).not.toMatch(/>47</);
    expect(labels(html)).not.toContain("47");
    expect(describeVisual(v)).not.toContain("47");
    expect(describeVisual(v)).toContain("7");
    expect(count(html, "data-tick")).toBe(21);
    expect(html).toContain('viewBox="0 0 800 380"');
    assertInside(html);
  });
  it("uses a minus sign for backward jumps", () => {
    const html = render({ kind: "number-line", from: 0, to: 20, marks: [], jump: { from: 12, by: -5 } });
    expect(labels(html)).toContain("−5");
  });
  it("never names the landing point, even on the label grid or in a small range", () => {
    const a = describeVisual({ kind: "number-line", from: 0, to: 100, marks: [], jump: { from: 30, by: 10 } });
    expect(a).not.toContain("40");
    expect(a).toContain("30");
    const b = describeVisual({ kind: "number-line", from: 0, to: 10, marks: [3], jump: { from: 3, by: 4 } });
    expect(b).not.toMatch(/\b7\b/);
    expect(b).toContain("forward 4 from 3");
    const c = describeVisual({ kind: "number-line", from: 0, to: 100, marks: [], jump: { from: 40, by: 7 } });
    expect(c).not.toContain("47");
  });
  it("puts marks and arc endpoints at the x of the matching tick", () => {
    const html = render({ kind: "number-line", from: 0, to: 100, marks: [30, 60], jump: { from: 30, by: 30 } });
    const tickX = (n: number) => Number(html.match(new RegExp(`data-tick="${n}" x1="([\\d.]+)"`))![1]);
    const markX = (n: number) => Number(html.match(new RegExp(`data-mark="${n}" cx="([\\d.]+)"`))![1]);
    expect(markX(30)).toBe(tickX(30));
    expect(markX(60)).toBe(tickX(60));
    const d = html.match(/data-jump="true"><path d="([^"]*)"/)![1]!.match(/-?[\d.]+/g)!.map(Number);
    expect(d[0]).toBe(tickX(30));
    expect(d[d.length - 2]).toBe(tickX(60));
  });
});

describe("blocks", () => {
  it("3 tens and 4 ones", () => {
    const html = render({ kind: "blocks", groups: [{ tens: 3, ones: 4 }] });
    expect(count(html, "data-rod")).toBe(3);
    expect(count(html, "data-cube")).toBe(4);
    expect(count(html, "data-cross")).toBe(0);
  });
  it("43 - 7 breaks a rod into 10 loose cubes and crosses 7", () => {
    const html = render({ kind: "blocks", groups: [{ tens: 4, ones: 3 }], crossedOut: { tens: 0, ones: 7 } });
    expect(count(html, "data-rod")).toBe(3);
    expect(count(html, "data-cube")).toBe(13);
    expect(count(html, "data-cross")).toBe(7);
    expect(count(html, "data-broken")).toBe(10);
    expect(count(html, "data-broken-outline")).toBe(1);
  });
  it("keeps the broken cluster apart from the group's own ones", () => {
    const html = render({ kind: "blocks", groups: [{ tens: 4, ones: 3 }], crossedOut: { tens: 0, ones: 7 } });
    const xs = (re: RegExp) => [...html.matchAll(re)].map((m) => Number(m[1]));
    const own = xs(/data-cube="true" x="([\d.]+)"/g);
    const broken = xs(/data-cube="true" data-broken="true" x="([\d.]+)"/g);
    expect(own).toHaveLength(3);
    expect(Math.min(...broken) - Math.max(...own)).toBeGreaterThan(30);
  });
  it("draws no broken cluster when ones suffice", () => {
    expect(count(render({ kind: "blocks", groups: [{ tens: 2, ones: 8 }], crossedOut: { tens: 0, ones: 3 } }), "data-broken")).toBe(0);
  });
  it("crosses out whole rods", () => {
    const html = render({ kind: "blocks", groups: [{ tens: 5, ones: 0 }], crossedOut: { tens: 2, ones: 0 } });
    expect(count(html, "data-rod")).toBe(5);
    expect(count(html, "data-cross")).toBe(2);
  });
  it("does not break a rod when ones suffice", () => {
    const html = render({ kind: "blocks", groups: [{ tens: 2, ones: 8 }], crossedOut: { tens: 0, ones: 3 } });
    expect(count(html, "data-rod")).toBe(2);
    expect(count(html, "data-cube")).toBe(8);
    expect(count(html, "data-cross")).toBe(3);
  });
  it("describes without the difference", () => {
    const d = describeVisual({ kind: "blocks", groups: [{ tens: 4, ones: 3 }], crossedOut: { tens: 0, ones: 7 } });
    expect(d).toContain("4 ten rods and 3 single cubes");
    expect(d).toContain("one ten rod broken into 10 single cubes");
    expect(d).toContain("7 single cubes crossed out");
    expect(d).not.toMatch(/\b36\b/);
  });
});

describe("equation and story", () => {
  it("equation shows its text at 64px", () => {
    const html = render({ kind: "equation", text: "3 + 4 = ?" });
    expect(html).toContain("3 + 4 = ?");
    expect(html).toContain('font-size="64"');
  });
  it("story shows text at 28px and its icons", () => {
    const html = render({ kind: "story", text: "Mia has 5 apples and eats 2.", icon: "apple", groups: [5], crossedOut: 2 });
    expect(html).toContain("Mia has 5 apples and eats 2.");
    expect(html).toContain('font-size="28"');
    expect(attrCount(html, "data-icon", "apple")).toBe(5);
    expect(count(html, "data-cross")).toBe(2);
  });
  it("story crossedOut runs across groups", () => {
    const html = render({ kind: "story", text: "x", icon: "fish", groups: [2, 3], crossedOut: 4 });
    expect(count(html, "data-cross")).toBe(4);
  });
  it("story without groups is text only", () => {
    const html = render({ kind: "story", text: "Hello there", icon: "fish" });
    expect(attrCount(html, "data-icon", "fish")).toBe(0);
  });
});

describe("size", () => {
  it("20 objects fit in the viewBox", () => {
    expect(assertInside(render({ kind: "objects", icon: "duck", groups: [20] }))).toBeGreaterThan(20);
    expect(assertInside(render({ kind: "objects", icon: "fish", groups: [5, 5, 5, 5], crossedOut: 3 }))).toBeGreaterThan(20);
  });
  it("blocks 9 tens 9 ones fit", () => {
    assertInside(render({ kind: "blocks", groups: [{ tens: 9, ones: 9 }] }));
    assertInside(render({ kind: "blocks", groups: [{ tens: 9, ones: 9 }, { tens: 9, ones: 9 }] }));
    assertInside(render({ kind: "blocks", groups: [{ tens: 4, ones: 3 }], crossedOut: { tens: 0, ones: 7 } }));
  });
  it("ten-frames, number-line, story, equation fit", () => {
    assertInside(render({ kind: "ten-frames", first: 10, second: 10, crossedOut: 4 }));
    assertInside(render({ kind: "number-line", from: 0, to: 20, marks: [0, 20], jump: { from: 0, by: 20 } }));
    assertInside(render({ kind: "number-line", from: 0, to: 100, marks: [100], jump: { from: 90, by: -90 } }));
    assertInside(render({ kind: "story", text: "Sam has a very long story about lots of cookies that he wants to share with all of his friends at school today.", icon: "cookie", groups: [10], crossedOut: 2 }));
    assertInside(render({ kind: "equation", text: "123 + 456 + 789 - 12 = ?" }));
  });
});

describe("describeVisual never leaks answers", () => {
  it("is non-empty for each kind", () => {
    expect(describeVisual({ kind: "equation", text: "3 + 4 = ?" })).toContain("3 + 4 = ?");
    expect(describeVisual({ kind: "story", text: "Mia has 3.", icon: "apple", groups: [3] })).toContain("3 apples");
    expect(describeVisual({ kind: "blocks", groups: [{ tens: 3, ones: 4 }] })).toMatch(/3 tens? rods?.*4 single cubes/);
  });
});
