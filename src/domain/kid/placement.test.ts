import { SKILLS } from "../curriculum/index";
import { isMastered } from "./bkt";
import { PROBE_LEVEL, finishPlacement, placementProbe, recordPlacement, startPlacement, type PlacementState } from "./placement";
import { newKidState } from "./state";
import type { KidGrade } from "./types";

const index = (id: string) => SKILLS.findIndex((s) => s.id === id);
const firstOfGrade = (g: string) => SKILLS.findIndex((s) => s.grade === g);

/** Runs placement against a kid who knows exactly the first k skills. */
function place(grade: KidGrade, k: number) {
  let p = startPlacement(grade);
  const probed: number[] = [];
  let problems = 0;
  for (let probe = placementProbe(p); probe; probe = placementProbe(p)) {
    expect(probe.level).toBe(PROBE_LEVEL);
    probed.push(index(probe.skillId));
    problems++;
    p = recordPlacement(p, index(probe.skillId) < k);
  }
  return { p, probed, problems };
}

it("starts at the parent-given grade", () => {
  expect(startPlacement("K").mid).toBe(0);
  expect(startPlacement("1").mid).toBe(firstOfGrade("1"));
  expect(startPlacement("2").mid).toBe(firstOfGrade("2"));
  expect(startPlacement("4").mid).toBe(firstOfGrade("2"));
});

it.each(["K", "1", "2"] as const)("grade %s: a perfect kid is placed within 3 skills in ≤ 10 problems", (grade) => {
  for (const k of [0, 5, 12, 20, SKILLS.length]) {
    const { p, probed, problems } = place(grade, k);
    expect(Math.abs(p.lo - k)).toBeLessThanOrEqual(3);
    expect(problems).toBeLessThanOrEqual(10);
    expect(probed[0]).toBe(startPlacement(grade).mid);
  }
});

it("finishPlacement marks exactly the skills below lo as placed and mastered", () => {
  const { p } = place("K", 12);
  const kid = finishPlacement(newKidState("k", "5-7", "K"), p);
  expect(kid.placed).toBe(true);
  SKILLS.forEach((s, i) => {
    const st = kid.skills[s.id]!;
    expect(st.placed).toBe(i < p.lo);
    expect(isMastered(st)).toBe(i < p.lo);
    if (i < p.lo) expect([st.pKnown, st.level]).toEqual([0.95, 2]);
  });
});

it("survives a JSON round trip mid-placement", () => {
  let p: PlacementState = startPlacement("1");
  p = recordPlacement(p, true);
  p = recordPlacement(p, true);
  p = recordPlacement(p, false);
  const q = JSON.parse(JSON.stringify(p)) as PlacementState;
  expect(placementProbe(q)).toEqual(placementProbe(p));
  expect(recordPlacement(q, true)).toEqual(recordPlacement(p, true));
});
