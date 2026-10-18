import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { kidRecord } = await import("./kidRecord");

const KID = "11111111-1111-4111-8111-111111111111";
const S1 = "22222222-2222-4222-8222-222222222222";
const S2 = "33333333-3333-4333-8333-333333333333";

const skill = (over: Record<string, unknown>) => ({
  kid_id: KID, skill_id: "add-subtract-within-100.add", p_known: 0.4, attempts: 3, level: 2,
  correct_streak: 0, wrong_streak: 1, last_seen: "2026-10-18T20:00:00Z", placed: false,
  recent_tags: [], mastered_at: null, ...over,
});
const session = (id: string, started: string, state: Record<string, unknown>) => ({
  id, kid_id: KID, version: 3, started_at: started, updated_at: started, ended_at: null,
  state: { seed: 99, step: 4, problems: 0, firstTryCorrect: 0, mastered: [], ...state },
});
const attempt = (sessionId: string, at: string, timeMs: number) => ({
  id: 1, kid_id: KID, session_id: sessionId, skill_id: "add-subtract-within-100.add", template_id: "t", seed: 7,
  level: 1, answer: 5, result: "correct", mistake_tag: null, style: null, time_ms: timeMs, at, try: 1, mode: "practice",
});
const empty = { skill_state: [], attempts: [], sessions: [], distress_flags: [] };

describe("kidRecord skills", () => {
  it("names each skill and says mastered (with the New York date), learning (with level) or not started", () => {
    const { skills } = kidRecord({
      ...empty,
      skill_state: [
        skill({ skill_id: "add-subtract-within-100.add-regroup", mastered_at: "2026-10-13T02:00:00Z" }), // Oct 12 in NY
        skill({ skill_id: "add-subtract-within-100.tens", level: 2 }),
        skill({ skill_id: "add-subtract-within-100.add", attempts: 0, last_seen: null }),
      ],
    });
    expect(skills).toEqual([
      { name: "Add with regrouping", status: "Mastered Oct 12", tricky: null },
      { name: "Add and subtract tens", status: "Learning, level 2", tricky: null },
      { name: "Add without regrouping", status: "Not started yet", tricky: null },
    ]);
  });

  it("lists the most recently practised skills first", () => {
    const { skills } = kidRecord({
      ...empty,
      skill_state: [
        skill({ skill_id: "add-subtract-within-100.tens", last_seen: "2026-10-10T20:00:00Z" }),
        skill({ skill_id: "add-subtract-within-100.add", last_seen: "2026-10-18T20:00:00Z" }),
      ],
    });
    expect(skills.map((s) => s.name)).toEqual(["Add without regrouping", "Add and subtract tens"]);
  });

  it("gives the newest mistake in plain words for a skill still being learned, never for a mastered one", () => {
    const { skills } = kidRecord({
      ...empty,
      skill_state: [
        skill({ recent_tags: ["forgot-the-ten", null, "off-by-one-counting", null] }),
        skill({ skill_id: "add-subtract-within-100.tens", recent_tags: ["off-by-ten"], mastered_at: "2026-10-18T20:00:00Z" }),
      ],
    });
    expect(skills[0]!.tricky).toBe("Counting one too many or too few");
    expect(skills[1]!.tricky).toBeNull();
  });

  it("falls back to the stored code for a skill the curriculum no longer has", () => {
    const { skills } = kidRecord({ ...empty, skill_state: [skill({ skill_id: "retired.skill" })] });
    expect(skills[0]!.name).toBe("retired.skill");
  });
});

describe("kidRecord sessions", () => {
  it("one line per session with problems, newest first, with time, minutes, first-try count and mastered names", () => {
    const { sessions } = kidRecord({
      ...empty,
      sessions: [
        session(S1, "2026-10-17T20:12:00Z", { problems: 1, firstTryCorrect: 1 }),
        session(S2, "2026-10-18T20:12:00Z", {
          problems: 20, firstTryCorrect: 15, mastered: ["add-subtract-within-100.add"],
        }),
      ],
      attempts: [
        attempt(S1, "2026-10-17T20:12:10Z", 4_000),
        attempt(S2, "2026-10-18T20:12:30Z", 5_000),
        attempt(S2, "2026-10-18T20:26:00Z", 5_000), // 13.5 min + 5 s -> 14
      ],
    });
    expect(sessions).toEqual([
      { when: "Sun, Oct 18, 4:12 PM", length: "14 min", problems: "20 problems, 15 right first time", mastered: ["Add without regrouping"] },
      { when: "Sat, Oct 17, 4:12 PM", length: "under a minute", problems: "1 problem, 1 right first time", mastered: [] },
    ]);
  });

  it("leaves out sessions that were opened but had no problems", () => {
    const { sessions } = kidRecord({ ...empty, sessions: [session(S1, "2026-10-18T20:12:00Z", { problems: 0 })] });
    expect(sessions).toEqual([]);
  });
});

describe("kidRecord flagged messages", () => {
  it("shows when, the words, and whether we emailed the parent, newest first", () => {
    const { flags } = kidRecord({
      ...empty,
      distress_flags: [
        { id: 1, line: "i feel sad", at: "2026-10-17T20:00:00Z", emailed_at: "2026-10-17T20:00:05Z" },
        { id: 2, line: "nobody likes me", at: "2026-10-18T20:00:00Z", emailed_at: null },
      ],
    });
    expect(flags).toEqual([
      { when: "Sun, Oct 18, 4:00 PM", line: "nobody likes me", emailed: "Not emailed yet" },
      { when: "Sat, Oct 17, 4:00 PM", line: "i feel sad", emailed: "We emailed you on Oct 17" },
    ]);
  });
});

describe("kidRecord", () => {
  it("is empty for a kid with no data", () => {
    expect(kidRecord(empty)).toEqual({ skills: [], sessions: [], flags: [] });
  });

  it("never carries ids, seeds or other internal fields into what the page shows", () => {
    const out = JSON.stringify(kidRecord({
      skill_state: [skill({})],
      sessions: [session(S1, "2026-10-18T20:12:00Z", { problems: 2, firstTryCorrect: 1 })],
      attempts: [attempt(S1, "2026-10-18T20:12:10Z", 4_000)],
      distress_flags: [{ id: 7, line: "help", at: "2026-10-18T20:00:00Z", emailed_at: null }],
    }));
    expect(out).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(out).not.toMatch(/seed|p_known|kid_id|session_id|template/);
  });
});
