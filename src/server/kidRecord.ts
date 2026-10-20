import "server-only";
import { isMastered } from "../domain/kid/bkt";
import type { SkillState } from "../domain/kid/types";
import { getSkill } from "../domain/curriculum";
import type { MistakeTag } from "../domain/types";
import type { KidExport } from "./rights";
import { minutesOf } from "./report/collect";
import { TAG_LABEL } from "./report/tips";

// What the parent's kid page shows from the stored rows: plain words, no ids or internal fields.
// The download (exportKid) stays the complete record.

export type SkillLine = { name: string; status: string; tricky: string | null };
export type SessionLine = { when: string; length: string; problems: string; helped: number; mastered: string[] };
export type FlagLine = { when: string; line: string; emailed: string };
export type KidRecord = { skills: SkillLine[]; sessions: SessionLine[]; flags: FlagLine[] };

type SkillStateRow = {
  skill_id: string; attempts: number; level: number; last_seen: string | null;
  recent_tags: (MistakeTag | null)[]; mastered_at: string | null;
  p_known: number; placed: boolean; remembered_at: string | null;
};
type SessionRow = { id: string; started_at: string; state: { problems?: number; firstTryCorrect?: number; mastered?: string[] } };
type AttemptRow = { result: string; session_id: string; time_ms: number; at: string };

const TZ = "America/New_York";
const dateTime = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
});
export const monthDay = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric" });

const nameOf = (id: string) => { try { return getSkill(id).name; } catch { return id; } };
const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;
const newestFirst = (a: string | null, b: string | null) => (b ? Date.parse(b) : 0) - (a ? Date.parse(a) : 0);

function skillLine(r: SkillStateRow): SkillLine {
  const mastered = isMastered({ pKnown: r.p_known, attempts: r.attempts, placed: r.placed } as SkillState);
  if (mastered) {
    const learned = r.placed ? "Knew at start" : r.mastered_at ? `Learned ${monthDay.format(new Date(r.mastered_at))}` : "Learned";
    const recall = r.remembered_at ? `remembered ${monthDay.format(new Date(r.remembered_at))}` : "not checked yet";
    return { name: nameOf(r.skill_id), status: `${learned} · ${recall}`, tricky: null };
  }
  const tag = r.recent_tags.findLast((t) => t !== null);
  return {
    name: nameOf(r.skill_id),
    status: r.mastered_at ? "Practicing again" : r.attempts > 0 ? `Learning, level ${r.level}` : "Not started yet",
    tricky: tag ? TAG_LABEL[tag] : null,
  };
}

export function kidRecord(data: Pick<KidExport, "skill_state" | "attempts" | "sessions" | "distress_flags">): KidRecord {
  const skillRows = data.skill_state as SkillStateRow[];
  const attempts = data.attempts as AttemptRow[];
  const sessions = (data.sessions as SessionRow[])
    .filter((s) => (s.state.problems ?? 0) > 0)
    .sort((a, b) => newestFirst(a.started_at, b.started_at))
    .map((s): SessionLine => {
      const sessionAttempts = attempts.filter((a) => a.session_id === s.id);
      const minutes = minutesOf(sessionAttempts);
      return {
        when: dateTime.format(new Date(s.started_at)),
        length: minutes === 0 ? "under a minute" : `${minutes} min`,
        problems: `${plural(s.state.problems ?? 0, "problem")}, ${s.state.firstTryCorrect ?? 0} right first time`,
        helped: sessionAttempts.filter((a) => a.result === "helped").length,
        mastered: (s.state.mastered ?? []).map(nameOf),
      };
    });
  const flags = [...data.distress_flags]
    .sort((a, b) => newestFirst(a.at, b.at))
    .map((f): FlagLine => ({
      when: dateTime.format(new Date(f.at)),
      line: f.line,
      emailed: f.emailed_at ? `We emailed you on ${monthDay.format(new Date(f.emailed_at))}` : "Not emailed yet",
    }));
  return {
    skills: [...skillRows].sort((a, b) => newestFirst(a.last_seen, b.last_seen)).map(skillLine),
    sessions,
    flags,
  };
}
