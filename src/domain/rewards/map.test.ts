import { CLUSTERS, SKILLS } from "../curriculum";
import { islandMap, ISLAND_NAMES } from "./map";

it("starts with eight named islands, 33 flags down and the first boat spot", () => {
  const m = islandMap({}, new Set(), []);
  expect(m.islands.map(i => i.name)).toEqual(["Counting Cove", "Compare Cliffs", "Adding Island", "Take-Away Bay", "Twenty Reef", "Tens Town", "Hundred Harbor", "Story Shore"]);
  expect(m.islands.map(i => i.clusterId)).toEqual(CLUSTERS.map(c => c.id));
  expect(m.islands.flatMap(i => i.flags.map(f => f.skillId))).toEqual(SKILLS.map(s => s.id));
  expect(m.islands.flatMap(i => i.flags)).toHaveLength(33);
  expect(m.islands.flatMap(i => i.flags).every(f => !f.up && !f.isNew)).toBe(true);
  expect(m.boat).toEqual({ island: 0, flag: 0 });
  expect(m.islands.map(i => ISLAND_NAMES[i.clusterId])).toEqual(m.islands.map(i => i.name));
});
it("combines mastery and placement and ignores unknown ids", () => {
  const at = Object.fromEntries(CLUSTERS[0]!.skills.map(s => [s.id, 1]));
  const placed = new Set(CLUSTERS[1]!.skills.map(s => s.id));
  const m = islandMap({ ...at, unknown: 1 }, new Set([...placed, "unknown"]), ["unknown"]);
  expect(m.islands.slice(0, 2).flatMap(i => i.flags).every(f => f.up)).toBe(true);
  expect(m.islands.slice(2).flatMap(i => i.flags).every(f => !f.up)).toBe(true);
  expect(m.boat).toEqual({ island: 2, flag: 0 });
});
it("keeps a mastered flag up after recall and marks only up learned-now flags new", () => {
  const [a, b, c] = SKILLS;
  const m = islandMap({ [a!.id]: 1 }, new Set([b!.id]), [a!.id, c!.id]);
  expect(m.islands[0]!.flags.slice(0, 3)).toEqual([
    { skillId: a!.id, up: true, isNew: true },
    { skillId: b!.id, up: true, isNew: false },
    { skillId: c!.id, up: false, isNew: false },
  ]);
});
it("finishes when all flags are up", () => {
  expect(islandMap({}, new Set(SKILLS.map(s => s.id)), []).boat).toEqual({ done: true });
});
