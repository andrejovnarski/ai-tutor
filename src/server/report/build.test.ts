import { describe, it, expect } from "vitest";
import { MISTAKE_TAGS } from "../../domain/types";
import { buildWeeklyReport, DEFAULT_TIP, TAG_LABEL, TIP_FOR_TAG, type KidWeek } from "./build";

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
