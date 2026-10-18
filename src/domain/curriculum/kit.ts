// Shared helpers for writing templates.
import { finalize } from "../problems/build";
import { createRng, type Rng } from "../rng";
import type { Level, Mistake, MistakeTag, Problem, Template, Visual } from "../types";

export type ByLevel<T> = Record<Level, T>;
export type Span = [min: number, max: number];

export const between = (rng: Rng, [min, max]: Span): number => rng.int(min, max);

/** `answer + 1` and `answer − 1`, both tagged `tag`. */
export const plusMinus = (answer: number, step: number, tag: MistakeTag): Mistake[] => [
  { answer: answer + step, tag },
  { answer: answer - step, tag },
];

/** Picture at levels 1–2, equation at level 3. */
export const fade = (level: Level, picture: Visual, equation: string): Visual =>
  level === 3 ? { kind: "equation", text: equation } : picture;

export type Draft = { say: string; show: Visual; answer: number; mistakes: Mistake[]; choiceCount?: 2 | 4; sum?: [number, number] };

/** Wraps a draft builder into a seeded template. */
export const template = (id: string, draft: (rng: Rng, level: Level) => Draft): Template => ({
  id,
  make: (seed: number, level: Level): Problem => {
    const rng = createRng(seed);
    return finalize(rng, draft(rng, level));
  },
});
