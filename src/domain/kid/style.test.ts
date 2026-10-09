import { createRng } from "../rng";
import { MISTAKE_TAGS, type Style } from "../types";
import { newKidState } from "./state";
import { TAG_STYLES, pickStyle, recordStyle, sampleBeta } from "./style";
import type { StyleStat } from "./types";

const zero = () => newKidState("k", "5-7", "K").styles;
const share = (allowed: Style[], stats: Record<Style, StyleStat>, want: Style, opts = {}) => {
  let n = 0;
  for (let s = 0; s < 1000; s++) if (pickStyle(createRng(s), allowed, stats, opts) === want) n++;
  return n / 1000;
};

it("every mistake tag has preferred styles", () => {
  for (const t of MISTAKE_TAGS) expect(TAG_STYLES[t].length).toBeGreaterThan(0);
});

it("sampleBeta(3, 1) averages 0.75 and stays in (0, 1)", () => {
  const r = createRng(1);
  let sum = 0;
  for (let i = 0; i < 2000; i++) {
    const x = sampleBeta(r, 3, 1);
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(1);
    sum += x;
  }
  expect(Math.abs(sum / 2000 - 0.75)).toBeLessThan(0.03);
});

it("returns only allowed styles, deterministically", () => {
  const allowed: Style[] = ["blocks", "story"];
  for (let s = 0; s < 200; s++) {
    const a = pickStyle(createRng(s), allowed, zero(), {});
    expect(allowed).toContain(a);
    expect(pickStyle(createRng(s), allowed, zero(), {})).toBe(a);
  }
});

it("mistake tag biases toward its styles", () => {
  const allowed: Style[] = ["number-line", "blocks"];
  expect(share(allowed, zero(), "number-line", { tag: "off-by-one-counting" })).toBeGreaterThan(0.6);
  const plain = share(allowed, zero(), "number-line");
  expect(plain).toBeGreaterThan(0.4);
  expect(plain).toBeLessThan(0.6);
});

it("learns from wins", () => {
  const stats = { ...zero(), blocks: { style: "blocks", tries: 20, wins: 18 }, "number-line": { style: "number-line", tries: 20, wins: 2 } } as Record<Style, StyleStat>;
  expect(share(["number-line", "blocks"], stats, "blocks")).toBeGreaterThan(0.9);
});

it("exclude is skipped unless it is the only option", () => {
  for (let s = 0; s < 200; s++) expect(pickStyle(createRng(s), ["blocks", "story"], zero(), { exclude: "blocks" })).toBe("story");
  expect(pickStyle(createRng(1), ["blocks"], zero(), { exclude: "blocks" })).toBe("blocks");
});

it("recordStyle counts tries and wins without mutating", () => {
  const before = zero();
  const after = recordStyle(recordStyle(before, "story", true), "story", false);
  expect(after.story).toEqual({ style: "story", tries: 2, wins: 1 });
  expect(before.story).toEqual({ style: "story", tries: 0, wins: 0 });
});
