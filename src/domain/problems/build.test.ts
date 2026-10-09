import { createRng } from "../rng";
import { adaptInput, buildChoices, cleanMistakes, finalize } from "./build";

it("cleanMistakes drops answer, out-of-range, duplicates (first wins)", () => {
  expect(cleanMistakes(5, [
    { answer: 5, tag: "off-by-one-counting" }, { answer: -1, tag: "subtracted-instead" },
    { answer: 101, tag: "added-instead" }, { answer: 6, tag: "used-double" }, { answer: 6, tag: "off-by-one-counting" },
  ])).toEqual([{ answer: 6, tag: "used-double" }]);
});

it("cleanMistakes drops non-integers", () => {
  expect(cleanMistakes(5, [{ answer: 2.5, tag: "dropped-zero" }])).toEqual([]);
});

it("buildChoices: distinct, in range, includes answer, prefers pool", () => {
  const c = buildChoices(createRng(1), 7, [8, 3, 3, 200], 4);
  expect(new Set(c).size).toBe(4);
  expect(c).toContain(7);
  expect(c).toContain(8);
  expect(c).toContain(3);
});

it("buildChoices works for answer 0 and 100", () => {
  for (const a of [0, 100]) {
    const c = buildChoices(createRng(2), a, [], 4);
    expect(new Set(c).size).toBe(4);
    expect(c.every((n) => n >= 0 && n <= 100)).toBe(true);
    expect(c).toContain(a);
  }
});

it("answer slot is spread out (Review Focus 3)", () => {
  const slot = [0, 0, 0, 0];
  for (let s = 0; s < 1000; s++) slot[buildChoices(createRng(s), 10, [9, 11, 12], 4).indexOf(10)]!++;
  for (const n of slot) {
    expect(n).toBeGreaterThan(150);
    expect(n).toBeLessThan(350);
  }
});

it("adaptInput by age band", () => {
  const p = finalize(createRng(1), { say: "x", show: { kind: "equation", text: "2 + 2 = ?" }, answer: 4, mistakes: [] });
  expect(adaptInput(p, "5-7").input).toBe("tap-choice");
  expect(adaptInput(p, "8-11").input).toBe("number-pad");
  const two = finalize(createRng(1), { say: "x", show: p.prompt.show, answer: 4, mistakes: [{ answer: 3, tag: "picked-other" }], choiceCount: 2 });
  expect(two.choices!.sort()).toEqual([3, 4]);
  expect(adaptInput(two, "8-11").input).toBe("tap-choice");
});

it("finalize cleans mistakes and keeps choices", () => {
  const p = finalize(createRng(1), { say: "x", show: { kind: "equation", text: "1 + 1 = ?" }, answer: 2, mistakes: [{ answer: 2, tag: "off-by-one-counting" }, { answer: 3, tag: "off-by-one-counting" }] });
  expect(p.mistakes).toEqual([{ answer: 3, tag: "off-by-one-counting" }]);
  expect(p.input).toBe("tap-choice");
  expect(p.choices).toHaveLength(4);
});
