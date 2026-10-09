import { newKidState } from "../../domain/kid/state";
import { fresh, placedKid, firstSkills, play, rightFor } from "../../domain/session/testkit";
import { kidStateFromRows, skillRow, styleRow, attemptRow, type KidRow } from "./rows";

const rowsOf = (kid: ReturnType<typeof newKidState>) => ({
  kidRow: { id: kid.kidId, grade: kid.grade, age_band: kid.ageBand, placed: kid.placed } satisfies KidRow,
  skills: Object.values(kid.skills).map((s) => skillRow(kid.kidId, s)),
  styles: Object.values(kid.styles).map((s) => styleRow(kid.kidId, s)),
});

it("round trips a kid after a played session, lastSeen included", () => {
  const { session } = play(fresh(placedKid(firstSkills(3)), 7, 1_700_000_000_000), 1_700_000_000_000, (t) => rightFor(t), { max: 12 });
  const kid = session.kid;
  expect(Object.values(kid.skills).some((s) => s.lastSeen !== null)).toBe(true);
  const { kidRow, skills, styles } = rowsOf(kid);
  expect(kidStateFromRows(kidRow, skills, styles)).toEqual(kid);
  const seen = skills.find((r) => r.last_seen !== null)!;
  expect(typeof seen.last_seen).toBe("string");
  expect(new Date(seen.last_seen!).toISOString()).toBe(seen.last_seen);
});

it("fills missing skill and style rows with new-kid defaults", () => {
  const base = newKidState("k1", "8-11", "2");
  const kid = kidStateFromRows({ id: "k1", grade: "2", age_band: "8-11", placed: false }, [], []);
  expect(kid).toEqual(base);
});

it("keeps stored rows and defaults the rest", () => {
  const base = newKidState("k1", "5-7", "K");
  const id = Object.keys(base.skills)[0]!;
  const row = skillRow("k1", { ...base.skills[id]!, pKnown: 0.9, attempts: 4, recentTags: [null, "added-one"] });
  const kid = kidStateFromRows({ id: "k1", grade: "K", age_band: "5-7", placed: true }, [row], []);
  expect(kid.placed).toBe(true);
  expect(kid.skills[id]).toMatchObject({ pKnown: 0.9, attempts: 4, recentTags: [null, "added-one"] });
  expect(Object.keys(kid.skills)).toHaveLength(Object.keys(base.skills).length);
});

it("maps an attempt to snake_case with an ISO timestamp", () => {
  const row = attemptRow("s1", {
    kidId: "k1", skillId: "x", templateId: "t", seed: 5, level: 2, answer: 7, result: "known-mistake",
    mistakeTag: "added-one", style: "blocks", timeMs: 900, at: 1_700_000_000_000, try: 2, mode: "practice",
  });
  expect(row).toEqual({
    kid_id: "k1", session_id: "s1", skill_id: "x", template_id: "t", seed: 5, level: 2, answer: 7,
    result: "known-mistake", mistake_tag: "added-one", style: "blocks", time_ms: 900,
    at: "2023-11-14T22:13:20.000Z", try: 2, mode: "practice",
  });
});
