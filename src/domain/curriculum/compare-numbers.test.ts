import type { Level, Problem, Visual } from "../types";
import { samples, sayNumbers, tpl } from "./testkit";

type Rule = [level: Level, min: number, max: number, minDiff: number];

function checkPairs(id: string, rules: Rule[], pair: (p: Problem) => number[], pick: "max" | "min") {
  for (const [lv, min, max, minDiff] of rules) {
    const seen: number[] = [];
    for (const p of samples(tpl(id), lv)) {
      const [x, y] = pair(p) as [number, number];
      seen.push(x, y);
      expect(Math.abs(x - y)).toBeGreaterThanOrEqual(minDiff);
      expect(p.answer).toBe(Math[pick](x, y));
      expect([...p.choices!].sort((a, b) => a - b)).toEqual([x, y].sort((a, b) => a - b));
      expect(p.mistakes).toEqual([{ answer: Math[pick === "max" ? "min" : "max"](x, y), tag: "picked-other" }]);
    }
    expect([Math.min(...seen), Math.max(...seen)]).toEqual([min, max]);
  }
}

const groups = (p: Problem) => {
  expect(p.prompt.show.kind).toBe("objects");
  return (p.prompt.show as Extract<Visual, { kind: "objects" }>).groups;
};
const GROUP_RULES: Rule[] = [[1, 1, 5, 2], [2, 1, 8, 1], [3, 1, 10, 1]];

it("compare-groups-more", () => checkPairs("compare-groups-more", GROUP_RULES, groups, "max"));
it("compare-groups-fewer", () => checkPairs("compare-groups-fewer", GROUP_RULES, groups, "min"));

const said = (n: number) => (p: Problem) => {
  const [x, y] = sayNumbers(p.prompt.say) as [number, number];
  const show = p.prompt.show;
  if (show.kind === "equation") expect(show.text).toBe(`${x} or ${y}?`);
  else expect(show).toEqual({ kind: "number-line", from: 0, to: n, marks: [x, y] });
  return [x, y];
};

it.each([
  ["compare-bigger-10", 10, "max", "bigger"], ["compare-smaller-10", 10, "min", "smaller"],
  ["compare-bigger-20", 20, "max", "bigger"], ["compare-smaller-20", 20, "min", "smaller"],
] as const)("%s", (id, n, pick, word) => {
  checkPairs(id, [[1, 0, n, 5], [2, 0, n, 2], [3, 0, n, 1]], said(n), pick);
  for (const p of samples(tpl(id), 1, 20)) expect(p.prompt.say).toMatch(new RegExp(`^Which is ${word}, \\d+ or \\d+\\?$`));
  for (const p of samples(tpl(id), 3, 20)) expect(p.prompt.show.kind).toBe("equation");
});
