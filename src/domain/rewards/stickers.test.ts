import { CLUSTERS, SKILLS } from "../curriculum";
import { CLUSTER_ART, STICKERS, stickerById } from "./stickers";

it("one skill sticker per skill and one topic sticker per cluster", () => {
  expect(STICKERS.filter((s) => s.kind === "skill")).toHaveLength(
    SKILLS.length,
  );
  expect(STICKERS.filter((s) => s.kind === "topic")).toHaveLength(
    CLUSTERS.length,
  );
});

it("every cluster has art", () => {
  expect(Object.keys(CLUSTER_ART).sort()).toEqual(
    CLUSTERS.map((c) => c.id).sort(),
  );
});

it("ids are unique", () => {
  expect(new Set(STICKERS.map((s) => s.id)).size).toBe(STICKERS.length);
});

// Skill and topic labels come verbatim from the curriculum (e.g. "Missing number"),
// so only the labels this module writes itself are checked.
it("no label talks about losing", () => {
  for (const s of STICKERS.filter((s) =>
    ["first", "weeks", "tries"].includes(s.kind),
  ))
    expect(s.label).not.toMatch(/\b(lose|lost|miss|break|broke)/i);
});

it("finds a sticker by id", () => {
  expect(stickerById("first-game")?.label).toBe("First game");
  expect(stickerById("nope")).toBeUndefined();
});
