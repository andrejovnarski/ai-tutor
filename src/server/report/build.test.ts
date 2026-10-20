import { describe, it, expect } from "vitest";
import { MISTAKE_TAGS } from "../../domain/types";
import type { Progress } from "../../domain/rewards/progress";
import { buildWeeklyReport, rewardsLine, DEFAULT_TIP, TAG_LABEL, TIP_FOR_TAG, type KidWeek } from "./build";

const kid = (o: Partial<KidWeek> = {}): KidWeek => ({
  nickname: "Ann", sessions: 3, minutes: 42, mastered: ["Add within 10"], currentSkill: "Subtract within 10", stuck: [TAG_LABEL["off-by-ten"]], ...o,
});

describe("buildWeeklyReport", () => {
  it("shows the counts, skill names, stuck points and the tip", () => {
    const r = buildWeeklyReport([kid()], "2026-10-04");
    expect(r.subject).toBe("Your week with Brightling AI");
    for (const body of [r.text, r.html]) {
      expect(body).toContain("Ann");
      expect(body).toContain("3 sessions");
      expect(body).toContain("42 minutes");
      expect(body).toContain("Add within 10");
      expect(body).toContain("Subtract within 10");
      expect(body).toContain(TAG_LABEL["off-by-ten"]);
      expect(body).toContain(TIP_FOR_TAG["off-by-ten"]!);
      expect(body).toContain("2026-10-04");
    }
  });

  it("uses the default tip when nothing is stuck", () => {
    const r = buildWeeklyReport([kid({ stuck: [] })], "2026-10-04");
    expect(r.text).toContain(DEFAULT_TIP);
  });

  it("takes the tip from the most common stuck tag across kids", () => {
    const a = TAG_LABEL["off-by-ten"], b = TAG_LABEL["added-instead"];
    const r = buildWeeklyReport([kid({ stuck: [a] }), kid({ nickname: "Bo", stuck: [b] }), kid({ nickname: "Cy", stuck: [b] })], "2026-10-04");
    expect(r.text).toContain(TIP_FOR_TAG["added-instead"]!);
    expect(r.text).not.toContain(TIP_FOR_TAG["off-by-ten"]!);
  });

  it("handles a kid with no sessions without undefined, NaN or null", () => {
    const r = buildWeeklyReport([kid({ sessions: 0, minutes: 0, mastered: [], currentSkill: null, stuck: [] })], "2026-10-04");
    expect(r.text).toContain("No sessions this week");
    expect(r.html).toContain("No sessions this week");
    for (const s of [r.subject, r.text, r.html]) expect(s).not.toMatch(/undefined|NaN|null/);
  });

  it("escapes every value in the HTML", () => {
    const r = buildWeeklyReport([kid({ nickname: "<b>", mastered: ["<i>x</i>"], currentSkill: "<u>" })], "<s>");
    expect(r.html).not.toMatch(/<b>|<i>|<u>|<s>/);
    expect(r.html).toContain("&lt;b&gt;");
  });

  it("has a label for every mistake tag", () => {
    for (const t of MISTAKE_TAGS) expect(TAG_LABEL[t], t).toBeTruthy();
  });
});

const prog = (o: Partial<Progress> & { n?: number } = {}): Progress => ({
  xp: 0, level: 1, cubesInRod: 0, goalWeeks: 0, weekStreak: 0,
  week: { days: [], played: 0, goalMet: false },
  stickers: Array.from({ length: o.n ?? 0 }, (_, i) => ({ id: `s${i}`, at: i })), ...o,
});

describe("rewardsLine", () => {
  it("joins level, stickers and streak", () => {
    expect(rewardsLine("Mia", prog({ level: 3, n: 1, weekStreak: 3 }), prog({ level: 5, n: 3, weekStreak: 4 })))
      .toBe("Mia reached level 5, earned 2 stickers, and met the week goal 4 weeks in a row.");
  });
  it("uses singular forms and two-part joins", () => {
    expect(rewardsLine("Mia", prog(), prog({ n: 1 }))).toBe("Mia earned 1 sticker.");
    expect(rewardsLine("Mia", prog(), prog({ weekStreak: 1 }))).toBe("Mia met the week goal 1 week in a row.");
    expect(rewardsLine("Mia", prog(), prog({ level: 2, n: 1 }))).toBe("Mia reached level 2 and earned 1 sticker.");
  });
  it("is null when nothing happened", () => {
    expect(rewardsLine("Mia", prog({ level: 2, n: 1 }), prog({ level: 2, n: 1 }))).toBeNull();
  });
  it("appears escaped in both text and HTML mail", () => {
    const rewards = rewardsLine("A<b>", prog(), prog({ n: 1 }))!;
    const r = buildWeeklyReport([kid({ nickname: "A<b>", rewards })], "2026-10-04");
    expect(r.text).toContain("A<b> earned 1 sticker.");
    expect(r.html).toContain("A&lt;b&gt; earned 1 sticker.");
    expect(r.html).not.toContain("A<b> earned");
  });
});
