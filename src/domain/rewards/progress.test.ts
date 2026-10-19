import { CLUSTERS } from "../curriculum";
import { endRewards, progress, type SessionFacts } from "./progress";

/** Noon in New York on a YYYY-MM-DD date (17:00Z is noon EST, 1 pm EDT: the same date either way). */
const ny = (day: string) => Date.parse(`${day}T17:00:00Z`);

let clock = ny("2026-01-01");
function session(over: Partial<SessionFacts> = {}): SessionFacts {
  const at = over.lastActivity ?? (clock += 60_000);
  return {
    startedAt: at - 600_000,
    endedAt: at,
    lastActivity: at,
    problems: 1,
    firstTryCorrect: 1,
    mastered: [],
    ...over,
  };
}
const on = (day: string, over: Partial<SessionFacts> = {}) => session({ lastActivity: ny(day), ...over });
const ids = (p: { stickers: { id: string }[] }) => p.stickers.map((s) => s.id);

it("XP adds problems, first tries, mastered skills and finished", () => {
  const p = progress(
    [session({ problems: 15, firstTryCorrect: 10, mastered: ["add-within-10.make-ten"] })],
    {},
    ny("2026-01-02"),
  );
  expect(p.xp).toBe(15 * 10 + 10 * 5 + 100 + 20);
  expect(p.xp).toBe(320);
  expect(p.level).toBe(1);
  expect(p.cubesInRod).toBe(6);
});

it("level and cube boundaries", () => {
  // One session: 10 * problems + 5 * first tries + 20. XP moves in steps of 5, so 495 is the last value below 500.
  const at = (xp: number) => {
    const problems = Math.floor((xp - 20) / 10);
    return progress([session({ problems, firstTryCorrect: ((xp - 20) % 10) / 5 })], {}, clock);
  };
  expect(at(495)).toMatchObject({ xp: 495, level: 1, cubesInRod: 9 });
  expect(at(500)).toMatchObject({ xp: 500, level: 2, cubesInRod: 0 });
  expect(at(550)).toMatchObject({ xp: 550, level: 2, cubesInRod: 1 });
});

it("unfinished and empty sessions count for nothing", () => {
  const p = progress([session({ endedAt: null, problems: 5 }), session({ problems: 0 })], {}, clock);
  expect(p.xp).toBe(0);
  expect(p.stickers).toEqual([]);
});

it("malformed counters count as zero", () => {
  expect(() => progress([session({ problems: undefined as never, mastered: "x" as never })], {}, clock)).not.toThrow();
  expect(progress([session({ problems: undefined as never, mastered: "x" as never })], {}, clock).xp).toBe(0);
  const p = progress([session({ problems: 3, firstTryCorrect: "2" as never, mastered: null as never })], {}, clock);
  expect(p.xp).toBe(3 * 10 + 20);
});

it("a session's day is its last activity in New York", () => {
  const late = session({ lastActivity: Date.parse("2026-10-18T03:30:00Z") }); // Oct 17, 23:30 in New York
  const thatWeek = progress([late], {}, ny("2026-10-12"));
  expect(thatWeek.week.days).toEqual([false, false, false, false, false, false, true]);
  expect(thatWeek.week.played).toBe(1);
  expect(progress([late], {}, ny("2026-10-18")).week.played).toBe(0);
});

it("weeks run Sunday to Saturday across DST", () => {
  const fall = progress([on("2026-11-01"), on("2026-11-07")], {}, ny("2026-11-04"));
  expect(fall.week.days).toEqual([true, false, false, false, false, false, true]);
  expect(progress([on("2026-10-31")], {}, ny("2026-11-01")).week.played).toBe(0);
  const spring = progress([on("2026-03-08"), on("2026-03-14")], {}, ny("2026-03-10"));
  expect(spring.week.days).toEqual([true, false, false, false, false, false, true]);
  expect(progress([on("2026-03-15")], {}, ny("2026-03-14")).week.played).toBe(0);
});

const goalWeek = (sunday: string) => {
  const [y, m, d] = sunday.split("-").map(Number) as [number, number, number];
  return [0, 2, 4].map((i) => on(new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10)));
};

it("week goal and streak", () => {
  const history = [...goalWeek("2026-10-04"), ...goalWeek("2026-10-11")];
  const p = progress(history, {}, ny("2026-10-19"));
  expect(p.weekStreak).toBe(2);
  expect(p.week.played).toBe(0);
  expect(p.week.goalMet).toBe(false);
  const q = progress([...history, ...goalWeek("2026-10-18")], {}, ny("2026-10-23"));
  expect(q.weekStreak).toBe(3);
  expect(q.week).toMatchObject({ played: 3, goalMet: true });
  expect(q.goalWeeks).toBe(3);
});

it("a missed week starts the count again", () => {
  const history = [...goalWeek("2026-09-27"), on("2026-10-05"), ...goalWeek("2026-10-11")];
  const p = progress(history, {}, ny("2026-10-19"));
  expect(p.weekStreak).toBe(1);
  expect(p.goalWeeks).toBe(2);
});

it("stickers and dates", () => {
  const first = on("2026-10-04", { problems: 4, firstTryCorrect: 4 });
  const skill = on("2026-10-06", { problems: 10, firstTryCorrect: 4, mastered: ["add-within-10.make-ten"] });
  const third = on("2026-10-08", { problems: 6, firstTryCorrect: 2 }); // tries 6 + 4 = 10, and the 3rd day
  const p = progress([third, first, skill], {}, ny("2026-10-19"));
  const at = Object.fromEntries(p.stickers.map((s) => [s.id, s.at]));
  expect(at).toEqual({
    "first-game": first.lastActivity,
    "skill:add-within-10.make-ten": skill.lastActivity,
    "weeks:1": third.lastActivity,
    "tries:10": third.lastActivity,
  });
  expect(ids(p)).toEqual(["first-game", "skill:add-within-10.make-ten", "weeks:1", "tries:10"]);
});

it("placement-only skills earn nothing", () => {
  const p = progress([session()], { "add-within-10.make-ten": ny("2026-01-01") }, clock);
  expect(ids(p)).toEqual(["first-game"]);
  expect(p.xp).toBe(10 + 5 + 20);
});

it("topic from practice plus placement", () => {
  const cluster = CLUSTERS.find((c) => c.id === "add-within-10")!;
  const placed = ny("2026-02-01");
  const practised = ny("2026-02-10");
  const masteredAt = Object.fromEntries(cluster.skills.map((s) => [s.id, placed]));
  masteredAt["add-within-10.make-ten"] = practised;
  const practice = session({ lastActivity: practised, mastered: ["add-within-10.make-ten"] });
  const p = progress([practice], masteredAt, practised);
  expect(p.stickers).toContainEqual({ id: "topic:add-within-10", at: practised });
  expect(ids(progress([session()], masteredAt, practised))).not.toContain("topic:add-within-10");
  // Not every skill mastered yet: no topic.
  const { ["add-within-10.missing"]: _, ...partial } = masteredAt;
  expect(ids(progress([practice], partial, practised))).not.toContain("topic:add-within-10");
  // Dated at the later of the last mastery and the first skill sticker.
  const later = { ...masteredAt, "add-within-10.pictures": ny("2026-03-01") };
  expect(progress([practice], later, practised).stickers).toContainEqual({ id: "topic:add-within-10", at: ny("2026-03-01") });
});

it("endRewards is for the latest finished session and ignores an open one", () => {
  const a = on("2026-10-12", { problems: 5, firstTryCorrect: 5 });
  const b = on("2026-10-13", { problems: 8, firstTryCorrect: 3, mastered: ["add-within-10.make-ten"] });
  const open = session({ lastActivity: ny("2026-10-14"), endedAt: null, problems: 4 });
  const r = endRewards([b, open, a], {}, ny("2026-10-14"))!;
  expect(r.xp).toBe(8 * 10 + 3 * 5 + 100 + 20);
  expect(r.newStickers).toEqual(["skill:add-within-10.make-ten"]);
  expect(r).toMatchObject({ levelBefore: 1, levelAfter: 1, cubesBefore: 1, cubesAfter: 6 });
  expect(r.week.played).toBe(2);
});

it("no finished sessions", () => {
  expect(endRewards([], {}, clock)).toBeNull();
  const p = progress([], {}, clock);
  expect(p).toMatchObject({ xp: 0, level: 1, cubesInRod: 0, weekStreak: 0, goalWeeks: 0, stickers: [] });
  expect(p.week).toEqual({ days: [false, false, false, false, false, false, false], played: 0, goalMet: false });
});
