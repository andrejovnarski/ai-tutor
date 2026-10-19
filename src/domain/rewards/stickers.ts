import { CLUSTERS } from "../curriculum";
import { GREAT_WEEKS, KEPT_TRYING } from "./rules";

export type StickerArt =
  | "star"
  | "counters"
  | "ten-frame"
  | "number-line"
  | "rod"
  | "calendar"
  | "pencil";
export type StickerKind = "first" | "skill" | "topic" | "weeks" | "tries";
export type Sticker = {
  id: string;
  kind: StickerKind;
  label: string;
  art: StickerArt;
};

export const CLUSTER_ART: Record<string, StickerArt> = {
  "count-to-20": "counters",
  "compare-numbers": "number-line",
  "add-within-10": "ten-frame",
  "subtract-within-10": "ten-frame",
  "add-subtract-within-20": "number-line",
  "place-value": "rod",
  "add-subtract-within-100": "number-line",
  "word-problems": "counters",
};

// Order: first, skills in curriculum order, topics, weeks, tries.
export const STICKERS: Sticker[] = [
  { id: "first-game", kind: "first", label: "First game", art: "star" },
  ...CLUSTERS.flatMap((c) =>
    c.skills.map((s): Sticker => ({
      id: `skill:${s.id}`,
      kind: "skill",
      label: s.name,
      art: CLUSTER_ART[c.id] as StickerArt,
    })),
  ),
  ...CLUSTERS.map((c): Sticker => ({
    id: `topic:${c.id}`,
    kind: "topic",
    label: c.name,
    art: "rod",
  })),
  ...GREAT_WEEKS.map((n): Sticker => ({
    id: `weeks:${n}`,
    kind: "weeks",
    label: n === 1 ? "1 great week" : `${n} great weeks`,
    art: "calendar",
  })),
  ...KEPT_TRYING.map((n): Sticker => ({
    id: `tries:${n}`,
    kind: "tries",
    label: `Kept trying ${n} times`,
    art: "pencil",
  })),
];

const byId = new Map(STICKERS.map((s) => [s.id, s]));

export function stickerById(id: string): Sticker | undefined {
  return byId.get(id);
}
