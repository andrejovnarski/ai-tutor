import fc from "fast-check";
import { SKILLS } from "../curriculum";
import { gained, progress, type SessionFacts } from "./progress";

const YEAR_START = Date.parse("2026-01-01T05:00:00Z");
const YEAR_END = Date.parse("2027-01-01T04:59:59Z");

const finished: fc.Arbitrary<SessionFacts> = fc
  .record({
    lastActivity: fc.integer({ min: YEAR_START, max: YEAR_END }),
    problems: fc.integer({ min: 1, max: 30 }),
    firstTryShare: fc.double({ min: 0, max: 1, noNaN: true }),
    mastered: fc.subarray(SKILLS.map((s) => s.id), { maxLength: 3 }),
  })
  .map(({ lastActivity, problems, firstTryShare, mastered }) => ({
    startedAt: lastActivity - 600_000,
    endedAt: lastActivity,
    lastActivity,
    problems,
    firstTryCorrect: Math.floor(problems * firstTryShare),
    mastered,
  }));

const masteredAt = fc.dictionary(
  fc.constantFrom(...SKILLS.map((s) => s.id)),
  fc.integer({ min: YEAR_START, max: YEAR_END }),
);

it("adding a finished session never lowers xp or level and never removes a sticker", () => {
  fc.assert(
    fc.property(
      fc.array(finished, { maxLength: 25 }),
      finished,
      masteredAt,
      fc.integer({ min: YEAR_START, max: YEAR_END }),
      (history, next, mastered, now) => {
        const before = progress(history, mastered, now);
        const after = progress([...history, next], mastered, now);
        expect(after.xp).toBeGreaterThanOrEqual(before.xp);
        expect(after.level).toBeGreaterThanOrEqual(before.level);
        const ids = new Set(after.stickers.map((s) => s.id));
        for (const s of before.stickers) expect(ids.has(s.id)).toBe(true);
        expect(gained(before, after).xp).toBeGreaterThanOrEqual(0);
      },
    ),
    { numRuns: 200 },
  );
});
