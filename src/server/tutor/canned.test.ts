import { describe, expect, it } from "vitest";
import { cannedLine } from "./canned";
import { checkLine, numbersIn } from "./guards";
import type { TurnPlan, TutorEvent } from "./types";

const EVENTS: TutorEvent[] = ["present", "correct", "wrong", "hint", "explain", "celebrate", "kid-said", "help"];
const plan = (event: TutorEvent, ageBand: "5-7" | "8-11", o: Partial<TurnPlan> = {}): TurnPlan => ({
  event, ageBand, skill: "add-within-10", problem: "What is 3 + 4?", problemNumbers: [3, 4],
  answer: 7, kidAnswer: 6, recentLines: [], ...o,
});

describe("cannedLine", () => {
  for (const event of EVENTS) for (const ageBand of ["5-7", "8-11"] as const) {
    it(`${event} ${ageBand}: varies and passes guards`, () => {
      const p = plan(event, ageBand, { revealed: true });
      const said = new Set([0, 1, 2].map((s) => cannedLine(p, s).say));
      expect(said.size).toBeGreaterThanOrEqual(2);
      for (let s = 0; s < 12; s++)
        for (const pp of [p, plan(event, ageBand), plan(event, ageBand, { answer: 12, problemNumbers: [5, 7], kidAnswer: 11 })]) {
          const l = cannedLine(pp, s);
          expect(checkLine(l, pp), l.say).toEqual({ ok: true });
          expect(l.say).not.toContain("{answer}");
          if (event !== "correct" && event !== "explain") expect(l.say).not.toContain(String(pp.answer));
        }
    });
  }
  it("hint is a calm move-on after a finished placement problem: no clue, no cue, no number", () => {
    for (const ageBand of ["5-7", "8-11"] as const)
      for (let s = 0; s < 8; s++) {
        const p = plan("hint", ageBand);
        const l = cannedLine(p, s);
        expect(l.say, l.say).not.toMatch(/\b(count|clue|hint|step|draw|finger|break|tens|ones|picture|numbers?)/i);
        expect(l.show, l.say).toBeUndefined();
        expect(l.tone).toBe("calm");
        expect(numbersIn(l.say), l.say).toEqual([]);
        expect(checkLine(l, p)).toEqual({ ok: true });
      }
  });
  it("fills the answer for correct and explain(revealed)", () => {
    const hasAnswer = (e: TutorEvent, o: Partial<TurnPlan>) =>
      [0, 1, 2, 3, 4, 5].some((s) => cannedLine(plan(e, "5-7", o), s).say.includes("7"));
    expect(hasAnswer("correct", {})).toBe(true);
    expect(hasAnswer("explain", { revealed: true })).toBe(true);
  });
  it("non-finite seeds fall back to seed 0 instead of throwing", () => {
    for (const s of [NaN, Infinity, -Infinity])
      expect(cannedLine(plan("present", "5-7"), s)).toEqual(cannedLine(plan("present", "5-7"), 0));
  });
  it("negative seeds work", () => {
    expect(cannedLine(plan("present", "5-7"), -5).say.length).toBeGreaterThan(0);
  });
});

it("has six short, warm strategy help lines for each age band", () => {
  for (const band of ["5-7", "8-11"] as const) {
    const lines = Array.from({ length: 6 }, (_, s) => cannedLine(plan("help", band), s).say);
    expect(new Set(lines).size).toBe(6);
    for (const say of lines) {
      expect(say.split(/\s+/).length).toBeLessThanOrEqual(20);
      expect(say).not.toMatch(/\b(wrong|oops|mistake)\b/i);
    }
  }
});
