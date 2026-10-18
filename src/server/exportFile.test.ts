import { describe, it, expect } from "vitest";
import { exportFile } from "./exportFile";

const data = {
  kid: { id: "k1", nickname: "Mia", grade: "K", age_band: "5-7", avatar: "fox", placed: true, created_at: "2026-10-01T00:00:00Z" },
  skill_state: [{ skill_id: "count.to-10", p_known: 0.5 }],
  style_stats: [],
  attempts: [{ id: 1, answer: 5 }],
  sessions: [],
  distress_flags: [],
};

describe("exportFile", () => {
  const text = exportFile(data, new Date("2026-10-18T20:00:00Z"));
  const parsed = JSON.parse(text);

  it("is indented JSON, one field per line", () => {
    expect(text).toContain('\n  "about": {');
    expect(text).toContain('"nickname": "Mia"');
  });

  it("starts with an about section, then the export time, then every table unchanged", () => {
    expect(Object.keys(parsed)).toEqual([
      "about", "exported_at", "kid", "skill_state", "style_stats", "attempts", "sessions", "distress_flags",
    ]);
    expect(parsed.exported_at).toBe("2026-10-18T20:00:00.000Z");
    const { about: _a, exported_at: _e, ...rest } = parsed;
    expect(rest).toEqual(data);
  });

  it("explains every table in plain words, using the child's nickname", () => {
    for (const key of ["kid", "skill_state", "style_stats", "attempts", "sessions", "distress_flags"]) {
      expect(typeof parsed.about[key]).toBe("string");
    }
    expect(parsed.about.file).toContain("Mia");
    expect(parsed.about.attempts).toContain("Every answer Mia gave");
  });
});
