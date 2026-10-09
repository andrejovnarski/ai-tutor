import { LEVELS, type Level, type Problem, type Visual } from "../types";
import { samples, sayNumbers, tpl } from "./testkit";

type V<K extends Visual["kind"]> = Extract<Visual, { kind: K }>;

/** Checks the start number's observed span per level and runs `fn` on every sample. */
function eachWithStart(id: string, spans: Record<Level, [number, number]>, start: (n: number[]) => number,
  fn: (p: Problem, lv: Level, n: number[]) => void) {
  for (const lv of LEVELS) {
    const starts: number[] = [];
    for (const p of samples(tpl(id), lv)) {
      const n = sayNumbers(p.prompt.say);
      starts.push(start(n));
      fn(p, lv, n);
    }
    expect([Math.min(...starts), Math.max(...starts)]).toEqual(spans[lv]);
  }
}

const first = (n: number[]) => n[0]!;
const minAnswer = (lv: Level) => (lv === 1 ? 1 : 0);

it("sub-objects-10: crossed-out objects, a − b, fixed picture", () =>
  eachWithStart("sub-objects-10", { 1: [2, 5], 2: [2, 8], 3: [2, 10] }, first, (p, lv, [a, b]) => {
    expect(p.prompt.show).toMatchObject({ kind: "objects", groups: [a], crossedOut: b });
    expect(p.answer).toBe(a! - b!);
    expect(b).toBeGreaterThanOrEqual(1);
    expect(p.answer).toBeGreaterThanOrEqual(minAnswer(lv));
    expect(p.mistakes).toContainEqual({ answer: a! + b!, tag: "added-instead" });
  }));

it("sub-ten-frame-10: crossed-out dots, fixed picture", () =>
  eachWithStart("sub-ten-frame-10", { 1: [2, 5], 2: [2, 8], 3: [2, 10] }, first, (p, lv, [a, b]) => {
    expect(p.prompt.show).toEqual({ kind: "ten-frames", first: a, second: 0, crossedOut: b });
    expect(p.answer).toBe(a! - b!);
    expect(p.answer).toBeGreaterThanOrEqual(minAnswer(lv));
  }));

it("sub-facts-5: objects at L1–2", () =>
  eachWithStart("sub-facts-5", { 1: [2, 5], 2: [1, 5], 3: [1, 5] }, first, (p, lv, [a, b]) => {
    expect(p.answer).toBe(a! - b!);
    expect(p.answer).toBeGreaterThanOrEqual(minAnswer(lv));
    if (lv < 3) expect(p.prompt.show).toMatchObject({ kind: "objects", groups: [a], crossedOut: b });
  }));

it("sub-line-5: jump back on 0–5", () =>
  eachWithStart("sub-line-5", { 1: [2, 5], 2: [1, 5], 3: [1, 5] }, first, (p, lv, [a, b]) => {
    expect(p.answer).toBe(a! - b!);
    if (lv < 3) expect(p.prompt.show).toEqual({ kind: "number-line", from: 0, to: 5, marks: [], jump: { from: a, by: -b! } });
  }));

it("sub-facts-10: ten-frames at L1–2", () =>
  eachWithStart("sub-facts-10", { 1: [3, 7], 2: [2, 10], 3: [2, 10] }, first, (p, lv, [a, b]) => {
    expect(p.answer).toBe(a! - b!);
    expect(p.answer).toBeGreaterThanOrEqual(minAnswer(lv));
    if (lv < 3) expect(p.prompt.show).toEqual({ kind: "ten-frames", first: a, second: 0, crossedOut: b });
  }));

it("sub-count-back: b in 1–3, jump back", () =>
  eachWithStart("sub-count-back", { 1: [4, 7], 2: [4, 10], 3: [4, 10] }, first, (p, lv, [a, b]) => {
    expect(b! >= 1 && b! <= 3).toBe(true);
    expect(p.answer).toBe(a! - b!);
    if (lv < 3) expect((p.prompt.show as V<"number-line">).jump).toEqual({ from: a, by: -b! });
  }));

it.each(["break-apart", "break-apart-frame"])("%s: c is a and ?", (id) =>
  eachWithStart(id, { 1: [2, 5], 2: [2, 8], 3: [2, 10] }, first, (p, lv, [c, a]) => {
    expect(a! >= 1 && a! <= c! - 1).toBe(true);
    expect(p.answer).toBe(c! - a!);
    expect(p.prompt.say).toBe(`${c} is ${a} and how many more?`);
    if (lv === 3) expect(p.prompt.show).toEqual({ kind: "equation", text: `${a} + ? = ${c}` });
    else if (id === "break-apart") expect(p.prompt.show).toMatchObject({ kind: "objects", groups: [c] });
    else expect(p.prompt.show).toEqual({ kind: "ten-frames", first: a, second: 0 });
    if (a! > 1) expect(p.mistakes).toContainEqual({ answer: c, tag: "gave-total" }); // a = 1: c is answer + 1
  }));

it("zero answers appear at level 2 and stay valid (Review Focus 4)", () => {
  const zeros = samples(tpl("sub-facts-10"), 2).filter((p) => p.answer === 0);
  expect(zeros.length).toBeGreaterThan(0);
  for (const p of zeros) {
    expect(new Set(p.choices).size).toBe(4);
    expect(p.choices!.every((n) => n >= 0)).toBe(true);
    expect((p.prompt.show as V<"ten-frames">).crossedOut).toBe((p.prompt.show as V<"ten-frames">).first);
  }
});
