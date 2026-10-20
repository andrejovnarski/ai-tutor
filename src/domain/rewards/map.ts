import { CLUSTERS } from "../curriculum";
import type { MasteredAt } from "./progress";

export type IslandMap = {
  islands: { clusterId: string; name: string; flags: { skillId: string; up: boolean; isNew: boolean }[] }[];
  boat: { island: number; flag: number } | { done: true };
};

export const ISLAND_NAMES: Record<string, string> = {
  "count-to-20": "Counting Cove",
  "compare-numbers": "Compare Cliffs",
  "add-within-10": "Adding Island",
  "subtract-within-10": "Take-Away Bay",
  "add-subtract-within-20": "Twenty Reef",
  "place-value": "Tens Town",
  "add-subtract-within-100": "Hundred Harbor",
  "word-problems": "Story Shore",
};

/** Historical mastery and placement stay up, independently of current recall/practice state. */
export function islandMap(masteredAt: MasteredAt, placed: ReadonlySet<string>, learnedNow: readonly string[]): IslandMap {
  const learned = new Set(learnedNow);
  const islands = CLUSTERS.map(c => ({
    clusterId: c.id,
    name: ISLAND_NAMES[c.id]!,
    flags: c.skills.map(s => {
      const up = Object.hasOwn(masteredAt, s.id) || placed.has(s.id);
      return { skillId: s.id, up, isNew: up && learned.has(s.id) };
    }),
  }));
  for (const [island, i] of islands.entries()) {
    const flag = i.flags.findIndex(f => !f.up);
    if (flag >= 0) return { islands, boat: { island, flag } };
  }
  return { islands, boat: { done: true } };
}
