export type Rng = {
  int(min: number, max: number): number;
  pick<T>(xs: readonly T[]): T;
  shuffle<T>(xs: readonly T[]): T[];
  chance(p: number): boolean;
};

/** Seeded PRNG (mulberry32). Seeds are truncated and wrapped to uint32. */
export function createRng(seed: number): Rng {
  let state = Math.trunc(seed) >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number): number => {
    if (min > max) throw new RangeError(`int: min ${min} > max ${max}`);
    return min + Math.floor(next() * (max - min + 1));
  };
  return {
    int,
    pick<T>(xs: readonly T[]): T {
      if (xs.length === 0) throw new RangeError("pick: empty list");
      return xs[int(0, xs.length - 1)]!;
    },
    shuffle<T>(xs: readonly T[]): T[] {
      const out = [...xs];
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(0, i);
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
    chance: (p) => next() < p,
  };
}
