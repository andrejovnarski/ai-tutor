// Teaching-style choice: Thompson sampling over styles that fit the skill (spec §6).
import type { Rng } from "../rng";
import type { MistakeTag, Style } from "../types";
import type { StyleStat } from "./types";

const COUNTING: Style[] = ["number-line"];
const OPERATION: Style[] = ["story", "drawing"];
const PARTS: Style[] = ["ten-frame", "blocks"];
const PLACE: Style[] = ["blocks"];

/** Styles that tend to fix each kind of mistake. */
export const TAG_STYLES: Record<MistakeTag, Style[]> = {
  "off-by-one-counting": COUNTING, "repeated-number": COUNTING, "skipped-number": COUNTING,
  "counted-back": COUNTING, "picked-other": COUNTING,
  "added-instead": OPERATION, "subtracted-instead": OPERATION, "wrong-operation": OPERATION,
  "stopped-after-one-step": OPERATION,
  "gave-total": PARTS, "gave-part": PARTS, "used-double": PARTS, "forgot-the-ten": PARTS,
  "subtracted-smaller-digit": PLACE, "forgot-to-regroup": PLACE, "added-digits": PLACE,
  "counted-ones-only": PLACE, "swapped-digits": PLACE, "picked-ones-digit": PLACE, "added-one": PLACE,
  "subtracted-one": PLACE, "dropped-zero": PLACE, "added-to-tens": PLACE, "off-by-ten": PLACE,
};

const TAG_BIAS = 2;
const RES = 2 ** 30;

/** Uniform in (0, 1). */
const unit = (rng: Rng) => rng.int(1, RES) / (RES + 1);

/** Gamma(n, 1) for integer n ≥ 1, as a sum of exponentials. */
const gamma = (rng: Rng, n: number) => {
  let x = 0;
  for (let i = 0; i < n; i++) x -= Math.log(unit(rng));
  return x;
};

/** Beta(a, b) for integers a, b ≥ 1. */
export function sampleBeta(rng: Rng, a: number, b: number): number {
  const x = gamma(rng, a);
  return x / (x + gamma(rng, b));
}

export function pickStyle(
  rng: Rng,
  allowed: Style[],
  stats: Record<Style, StyleStat>,
  opts: { tag?: MistakeTag | null; exclude?: Style | null },
): Style {
  const pool = allowed.filter((s) => s !== opts.exclude);
  const candidates = pool.length > 0 ? pool : allowed;
  const preferred = opts.tag ? TAG_STYLES[opts.tag] : [];
  let best = candidates[0]!;
  let bestDraw = -1;
  for (const style of candidates) {
    const { tries, wins } = stats[style];
    const bias = preferred.includes(style) ? TAG_BIAS : 0;
    const draw = sampleBeta(rng, wins + 1 + bias, tries - wins + 1);
    if (draw > bestDraw) [best, bestDraw] = [style, draw];
  }
  return best;
}

export function recordStyle(stats: Record<Style, StyleStat>, style: Style, won: boolean): Record<Style, StyleStat> {
  const s = stats[style];
  return { ...stats, [style]: { ...s, tries: s.tries + 1, wins: s.wins + (won ? 1 : 0) } };
}
