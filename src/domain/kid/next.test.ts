import { SKILLS } from "../curriculum/index";
import { easyReview, frontier, isStruggling, reviewTarget, weakestPrereq } from "./next";
import { newKidState } from "./state";
import type { KidState, SkillState } from "./types";

const kid = () => newKidState("k", "5-7", "K");
const set = (k: KidState, id: string, patch: Partial<SkillState>): KidState =>
  ({ ...k, skills: { ...k.skills, [id]: { ...k.skills[id]!, ...patch } } });
const master = (k: KidState, ids: string[], lastSeen: number | null = null) =>
  ids.reduce((acc, id) => set(acc, id, { pKnown: 0.97, attempts: 5, lastSeen }), k);
const first = (n: number) => SKILLS.slice(0, n).map((s) => s.id);

it("SKILLS order is topological", () => {
  const index = new Map(SKILLS.map((s, i) => [s.id, i]));
  for (const s of SKILLS) for (const n of s.needs) expect(index.get(n)!).toBeLessThan(index.get(s.id)!);
});

it("new kid starts at the entry skill", () => expect(frontier(kid())).toBe("count-to-20.objects-to-10"));

it("first three mastered → compare-numbers.groups", () => expect(frontier(master(kid(), first(3)))).toBe("compare-numbers.groups"));

it("skips skills whose needs are not mastered", () => {
  const k = master(kid(), ["count-to-20.objects-to-10", "count-to-20.number-after"]);
  expect(frontier(k)).toBe("count-to-20.objects-to-20");
  const k2 = master(kid(), first(3).concat(["compare-numbers.groups"]));
  // compare-numbers.to-10 needs .groups, now mastered
  expect(frontier(k2)).toBe("compare-numbers.to-10");
  // a skill earlier in order whose need is missing is skipped
  const k3 = master(kid(), ["count-to-20.objects-to-20", "count-to-20.number-after"]);
  expect(frontier(k3)).toBe("count-to-20.objects-to-10");
  const k4 = master(kid(), first(6).filter((id) => id !== "compare-numbers.groups"));
  expect(frontier(k4)).toBe("compare-numbers.groups");
});

it("a not-mastered skill with unmastered needs is never the frontier", () => {
  const k = master(kid(), first(10).filter((id) => id !== "add-within-10.within-5"));
  const f = frontier(k)!;
  for (const n of SKILLS.find((s) => s.id === f)!.needs) expect(k.skills[n]!.pKnown).toBeGreaterThanOrEqual(0.95);
});

it("everything mastered → null", () => expect(frontier(master(kid(), first(SKILLS.length)))).toBeNull());

it("reviewTarget: oldest lastSeen, null first, honors exclude", () => {
  let k = master(kid(), ["count-to-20.objects-to-10"], 500);
  k = master(k, ["count-to-20.objects-to-20"], 100);
  k = master(k, ["count-to-20.number-after"], null);
  expect(reviewTarget(k, null)).toBe("count-to-20.number-after");
  expect(reviewTarget(k, "count-to-20.number-after")).toBe("count-to-20.objects-to-20");
  expect(reviewTarget(kid(), null)).toBeNull();
});

it("easyReview: earliest mastered", () => {
  expect(easyReview(master(kid(), ["compare-numbers.groups", "count-to-20.number-after"]))).toBe("count-to-20.number-after");
  expect(easyReview(kid())).toBeNull();
});

it("weakestPrereq: lowest pKnown need, null for the entry skill", () => {
  let k = set(kid(), "add-subtract-within-20.make-ten", { pKnown: 0.9 });
  k = set(k, "add-subtract-within-20.subtract", { pKnown: 0.4 });
  expect(weakestPrereq(k, "add-subtract-within-20.related-facts")).toBe("add-subtract-within-20.subtract");
  expect(weakestPrereq(kid(), "count-to-20.objects-to-10")).toBeNull();
});

it("isStruggling", () => {
  const s = kid().skills["count-to-20.objects-to-10"]!;
  expect(isStruggling({ ...s, level: 1, wrongStreak: 2 })).toBe(true);
  expect(isStruggling({ ...s, level: 2, wrongStreak: 2 })).toBe(false);
  expect(isStruggling({ ...s, level: 2, recentTags: ["gave-total", null, "gave-total", null] })).toBe(true);
  expect(isStruggling({ ...s, level: 2, recentTags: [null, null, "gave-total", "gave-part"] })).toBe(false);
});

it("weakestPrereq ties go to curriculum order, not the needs list order", () =>
  expect(weakestPrereq(kid(), "word-problems.to-100")).toBe("add-subtract-within-100.add-regroup"));
