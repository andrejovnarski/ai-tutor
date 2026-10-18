import type { Rng } from "../rng";
import type { AgeBand, Mistake, Problem, Visual } from "../types";

const MIN = 0;
const MAX = 100;

const valid = (n: number): boolean => Number.isInteger(n) && n >= MIN && n <= MAX;

/** Keeps in-range integer mistakes that differ from the answer; first tag wins per answer. */
export function cleanMistakes(answer: number, mistakes: Mistake[]): Mistake[] {
  const seen = new Set<number>();
  return mistakes.filter((m) => {
    if (!valid(m.answer) || m.answer === answer || seen.has(m.answer)) return false;
    seen.add(m.answer);
    return true;
  });
}

/** `count` distinct choices including the answer: pool first, then nearest neighbors, then shuffled. */
export function buildChoices(rng: Rng, answer: number, wrongPool: number[], count: 2 | 4): number[] {
  const picked = [answer];
  const add = (n: number) => {
    if (picked.length < count && valid(n) && !picked.includes(n)) picked.push(n);
  };
  wrongPool.forEach(add);
  for (let d = 1; picked.length < count; d++) {
    add(answer + d);
    add(answer - d);
  }
  return rng.shuffle(picked);
}

export function finalize(
  rng: Rng,
  p: { say: string; show: Visual; answer: number; mistakes: Mistake[]; choiceCount?: 2 | 4; sum?: [number, number] },
): Problem {
  const mistakes = cleanMistakes(p.answer, p.mistakes);
  return {
    prompt: { say: p.say, show: p.show },
    answer: p.answer,
    input: "tap-choice",
    choices: buildChoices(rng, p.answer, mistakes.map((m) => m.answer), p.choiceCount ?? 4),
    mistakes,
    ...(p.sum && { sum: p.sum }),
  };
}

/** 5–7: tap choices. 8–11: number pad, unless it is a two-way pick. Choices stay as fallback. */
export function adaptInput(p: Problem, band: AgeBand): Problem {
  const twoWay = (p.choices?.length ?? 0) === 2;
  return { ...p, input: band === "8-11" && !twoWay ? "number-pad" : "tap-choice" };
}
