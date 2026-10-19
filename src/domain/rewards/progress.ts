import { CLUSTERS, SKILLS } from "../curriculum";
import { nyDay } from "../../server/nyDay";
import { CUBES_PER_LEVEL, GREAT_WEEKS, KEPT_TRYING, WEEK_GOAL_DAYS, XP, XP_PER_CUBE } from "./rules";
import { STICKERS } from "./stickers";

export type SessionFacts = {
  startedAt: number;
  endedAt: number | null;
  lastActivity: number;
  problems: number;
  firstTryCorrect: number;
  mastered: string[];
};
export type MasteredAt = Record<string, number>; // skillId -> ms of skill_state.mastered_at
export type EarnedSticker = { id: string; at: number };
export type Week = { days: boolean[]; played: number; goalMet: boolean }; // days[0] = Sunday
export type Progress = {
  xp: number;
  level: number;
  cubesInRod: number;
  week: Week;
  weekStreak: number;
  goalWeeks: number;
  stickers: EarnedSticker[];
};
export type Gained = {
  xp: number;
  levelBefore: number;
  levelAfter: number;
  cubesBefore: number;
  cubesAfter: number;
  newStickers: string[];
};
export type EndRewards = Gained & { week: Week };

const XP_PER_LEVEL = XP_PER_CUBE * CUBES_PER_LEVEL;
const KNOWN_SKILLS = new Set(SKILLS.map((s) => s.id));
const CATALOGUE_ORDER = new Map(STICKERS.map((s, i) => [s.id, i]));

/** A counter from stored JSON: anything but a finite non-negative number is 0. */
const count = (n: unknown): number => (typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

type Finished = { problems: number; firstTry: number; mastered: string[]; at: number; day: string };

function finishedFacts(s: SessionFacts): Finished | null {
  const problems = count(s.problems);
  if (s.endedAt == null || problems < 1) return null;
  const at = Number.isFinite(s.lastActivity) ? s.lastActivity : (s.endedAt as number);
  if (!Number.isFinite(at)) return null;
  const mastered = Array.isArray(s.mastered)
    ? [...new Set(s.mastered.filter((m): m is string => typeof m === "string"))]
    : [];
  return { problems, firstTry: Math.min(count(s.firstTryCorrect), problems), mastered, at, day: nyDay(at) };
}

const dateParts = (day: string) => day.split("-").map(Number) as [number, number, number];

/** Day of the week of a YYYY-MM-DD date, 0 = Sunday. Calendar arithmetic, so DST never shifts it. */
const weekday = (day: string): number => {
  const [y, m, d] = dateParts(day);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

/** The YYYY-MM-DD date `offset` days from `day`. */
const addDays = (day: string, offset: number): string => {
  const [y, m, d] = dateParts(day);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
};

const sundayOf = (day: string): string => addDays(day, -weekday(day));

export function progress(sessions: SessionFacts[], masteredAt: MasteredAt, now: number): Progress {
  const done = sessions
    .map(finishedFacts)
    .filter((f): f is Finished => f !== null)
    .sort((a, b) => a.at - b.at);

  const earned = new Map<string, number>();
  const earn = (id: string, at: number) => {
    if (!earned.has(id)) earned.set(id, at);
  };

  let xp = 0;
  let tries = 0;
  let goalWeeks = 0;
  const weekDays = new Map<string, Set<string>>(); // Sunday -> days played

  for (const f of done) {
    xp += f.problems * XP.problem + f.firstTry * XP.firstTry + f.mastered.length * XP.mastered + XP.finished;
    earn("first-game", f.at);
    for (const skill of f.mastered) if (KNOWN_SKILLS.has(skill)) earn(`skill:${skill}`, f.at);

    tries += f.problems - f.firstTry;
    for (const n of KEPT_TRYING) if (tries >= n) earn(`tries:${n}`, f.at);

    const sunday = sundayOf(f.day);
    const days = weekDays.get(sunday) ?? new Set<string>();
    weekDays.set(sunday, days);
    if (!days.has(f.day)) {
      days.add(f.day);
      if (days.size === WEEK_GOAL_DAYS) {
        goalWeeks += 1;
        for (const n of GREAT_WEEKS) if (goalWeeks >= n) earn(`weeks:${n}`, f.at);
      }
    }
  }

  for (const c of CLUSTERS) {
    const times = c.skills.map((s) => masteredAt[s.id]);
    if (!times.every((t): t is number => typeof t === "number" && Number.isFinite(t))) continue;
    const skillStickers = c.skills
      .map((s) => earned.get(`skill:${s.id}`))
      .filter((t): t is number => t !== undefined);
    if (skillStickers.length === 0) continue;
    earn(`topic:${c.id}`, Math.max(Math.max(...times), Math.min(...skillStickers)));
  }

  const thisSunday = sundayOf(nyDay(now));
  const metGoal = (sunday: string) => (weekDays.get(sunday)?.size ?? 0) >= WEEK_GOAL_DAYS;
  const thisWeek = weekDays.get(thisSunday) ?? new Set<string>();
  const days = Array.from({ length: 7 }, (_, i) => thisWeek.has(addDays(thisSunday, i)));
  const played = days.filter(Boolean).length;
  const week: Week = { days, played, goalMet: played >= WEEK_GOAL_DAYS };

  let weekStreak = 0;
  for (let sunday = addDays(thisSunday, -7); metGoal(sunday); sunday = addDays(sunday, -7)) weekStreak += 1;
  if (week.goalMet) weekStreak += 1;

  const stickers = [...earned]
    .map(([id, at]) => ({ id, at }))
    .sort((a, b) => a.at - b.at || (CATALOGUE_ORDER.get(a.id) ?? 0) - (CATALOGUE_ORDER.get(b.id) ?? 0));

  return {
    xp,
    level: 1 + Math.floor(xp / XP_PER_LEVEL),
    cubesInRod: Math.floor((xp % XP_PER_LEVEL) / XP_PER_CUBE),
    week,
    weekStreak,
    goalWeeks,
    stickers,
  };
}

export function gained(before: Progress, after: Progress): Gained {
  const had = new Set(before.stickers.map((s) => s.id));
  return {
    xp: after.xp - before.xp,
    levelBefore: before.level,
    levelAfter: after.level,
    cubesBefore: before.cubesInRod,
    cubesAfter: after.cubesInRod,
    newStickers: after.stickers.filter((s) => !had.has(s.id)).map((s) => s.id),
  };
}

/** Rewards for the latest finished session (by endedAt); null when there is none. */
export function endRewards(sessions: SessionFacts[], masteredAt: MasteredAt, now: number): EndRewards | null {
  let latest = -1;
  sessions.forEach((s, i) => {
    if (finishedFacts(s) === null) return;
    if (latest < 0 || (s.endedAt as number) > (sessions[latest]!.endedAt as number)) latest = i;
  });
  if (latest < 0) return null;
  const session = sessions[latest]!;
  const others = sessions.filter((_, i) => i !== latest);
  const masteredBefore = Object.fromEntries(
    Object.entries(masteredAt).filter(([, t]) => t < session.startedAt),
  );
  const before = progress(others, masteredBefore, now);
  const after = progress(sessions, masteredAt, now);
  return { ...gained(before, after), week: after.week };
}
