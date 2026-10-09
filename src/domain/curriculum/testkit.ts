// Test helpers for curriculum tests. Not used by production code.
import type { Level, Problem, Template } from "../types";
import { getTemplate } from "./index";

export const tpl = getTemplate;

export function samples(t: Template, level: Level, n = 1000): Problem[] {
  return Array.from({ length: n }, (_, seed) => t.make(seed, level));
}

export function answerRange(t: Template, level: Level): [number, number] {
  const answers = samples(t, level).map((p) => p.answer);
  return [Math.min(...answers), Math.max(...answers)];
}

export function sayNumbers(say: string): number[] {
  return (say.match(/\d+/g) ?? []).map(Number);
}

/** Solves `a + b = ?`, `a − b = ?`, `a + ? = c`, `? + b = c`, `a − ? = c`, `? − b = c`. */
export function solveEquation(text: string): number {
  const m = text.replace(/\s+/g, "").replace(/−/g, "-").match(/^(\d+|\?)([+-])(\d+|\?)=(\d+|\?)$/);
  if (!m) throw new Error(`unsupported equation: ${text}`);
  const [, a, op, b, c] = m as unknown as [string, string, "+" | "-", string, string];
  const n = (s: string) => Number(s);
  if (c === "?") return op === "+" ? n(a) + n(b) : n(a) - n(b);
  if (b === "?") return op === "+" ? n(c) - n(a) : n(a) - n(c);
  if (a === "?") return op === "+" ? n(c) - n(b) : n(c) + n(b);
  throw new Error(`no unknown in: ${text}`);
}
