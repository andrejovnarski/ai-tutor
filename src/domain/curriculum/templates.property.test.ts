import { LEVELS, MISTAKE_TAGS, type Visual } from "../types";
import { CLUSTERS } from "./index";
import { sayNumbers, solveEquation } from "./testkit";

const int = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max;

function validVisual(v: Visual): boolean {
  switch (v.kind) {
    case "objects":
      return v.groups.length > 0 && v.groups.every((g) => int(g, 0, 20)) &&
        (v.crossedOut === undefined || int(v.crossedOut, 0, v.groups[0]!));
    case "ten-frames":
      return int(v.first, 0, 20) && int(v.second, 0, 20) && v.first + v.second <= 20 &&
        (v.crossedOut === undefined || int(v.crossedOut, 0, v.first + v.second));
    case "number-line": {
      const inside = (n: number) => int(n, v.from, v.to);
      return int(v.from, 0, 100) && int(v.to, 0, 100) && v.from < v.to && v.marks.every(inside) &&
        (v.jump === undefined || (inside(v.jump.from) && inside(v.jump.from + v.jump.by)));
    }
    case "blocks":
      return v.groups.length > 0 && v.groups.every((g) => int(g.tens, 0, 10) && int(g.ones, 0, 9)) &&
        (v.crossedOut === undefined || (int(v.crossedOut.tens, 0, 10) && int(v.crossedOut.ones, 0, 9)));
    case "equation":
      return v.text.trim().length > 0;
    case "story":
      return v.text.trim().length > 0 && (v.groups === undefined || v.groups.every((g) => int(g, 0, 20)));
  }
}

const all = CLUSTERS.flatMap((c) => c.templates);

it("has templates", () => expect(all.length).toBeGreaterThan(0));

describe.each(all.map((t) => [t.id, t] as const))("%s", (_id, t) => {
  it.each(LEVELS.map((l) => [l]))("level %i invariants", (lv) => {
    const slot = [0, 0, 0, 0];
    for (let s = 0; s < 1000; s++) {
      const p = t.make(s, lv);
      expect(t.make(s, lv)).toEqual(p); // deterministic
      const nums = [p.answer, ...(p.choices ?? []), ...p.mistakes.map((m) => m.answer), ...sayNumbers(p.prompt.say)];
      for (const n of nums) expect(int(n, 0, 100)).toBe(true);
      expect(p.input).toBe("tap-choice");
      expect([2, 4]).toContain(p.choices!.length);
      expect(new Set(p.choices).size).toBe(p.choices!.length);
      expect(p.choices).toContain(p.answer);
      expect(p.mistakes.every((m) => m.answer !== p.answer && MISTAKE_TAGS.includes(m.tag))).toBe(true);
      expect(new Set(p.mistakes.map((m) => m.answer)).size).toBe(p.mistakes.length);
      expect(p.prompt.say.split(/\s+/).length).toBeLessThanOrEqual(30);
      expect(validVisual(p.prompt.show)).toBe(true);
      if (lv === 3 && p.prompt.show.kind === "equation" && p.prompt.show.text.includes("="))
        expect(solveEquation(p.prompt.show.text)).toBe(p.answer);
      if (p.choices!.length === 4) slot[p.choices!.indexOf(p.answer)]!++;
    }
    if (slot.some((n) => n > 0)) for (const n of slot) expect(n).toBeLessThan(350); // Review Focus 3
  });
});
