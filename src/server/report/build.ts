import type { Mail } from "../email/mailer";
import type { MistakeTag } from "../../domain/types";
import { gained, type Progress } from "../../domain/rewards/progress";
import { DEFAULT_TIP, TAG_LABEL, TIP_FOR_TAG } from "./tips";

export { DEFAULT_TIP, TAG_LABEL, TIP_FOR_TAG };

export type KidWeek = {
  nickname: string;
  sessions: number;
  minutes: number;
  mastered: string[]; // skill names
  currentSkill: string | null; // skill name
  stuck: string[]; // tag labels
  rewards?: string; // one sentence from rewardsLine
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** One sentence about what the child earned this week, or null when there is nothing to say. */
export function rewardsLine(nickname: string, before: Progress, after: Progress): string | null {
  const g = gained(before, after);
  const parts: string[] = [];
  if (after.level > before.level) parts.push(`reached level ${after.level}`);
  if (g.newStickers.length > 0) parts.push(`earned ${plural(g.newStickers.length, "sticker", "stickers")}`);
  if (after.weekStreak >= 1) parts.push(`met the week goal ${plural(after.weekStreak, "week", "weeks")} in a row`);
  if (parts.length === 0) return null;
  const last = parts.pop()!;
  const joined = parts.length === 0 ? last : parts.length === 1 ? `${parts[0]} and ${last}` : `${parts.join(", ")}, and ${last}`;
  return `${nickname} ${joined}.`;
}

/** Lines for one kid, shared by the text and HTML versions. */
function kidLines(k: KidWeek): string[] {
  if (k.sessions === 0) return ["No sessions this week."];
  return [
    `${plural(k.sessions, "session", "sessions")}, ${plural(k.minutes, "minute", "minutes")}`,
    `Mastered this week: ${k.mastered.length ? k.mastered.join(", ") : "nothing new yet"}`,
    `Working on now: ${k.currentSkill ?? "everything so far is mastered"}`,
    `Stuck points: ${k.stuck.length ? k.stuck.join("; ") : "none this week"}`,
    ...(k.rewards ? [k.rewards] : []),
  ];
}

const TAG_BY_LABEL = new Map(Object.entries(TAG_LABEL).map(([tag, label]) => [label, tag as MistakeTag]));

function tipFor(kids: KidWeek[]): string {
  const counts = new Map<MistakeTag, number>();
  for (const k of kids) for (const label of k.stuck) {
    const tag = TAG_BY_LABEL.get(label);
    if (tag) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  let best: MistakeTag | null = null;
  for (const [tag, n] of counts) if (best === null || n > counts.get(best)!) best = tag;
  return (best && TIP_FOR_TAG[best]) || DEFAULT_TIP;
}

export function buildWeeklyReport(kids: KidWeek[], weekOf: string): Omit<Mail, "to"> {
  const tip = tipFor(kids);
  const head = `Your week with Brightling AI (week of ${weekOf})`;
  const text = [
    head,
    ...kids.flatMap((k) => ["", k.nickname, ...kidLines(k).map((l) => `  ${l}`)]),
    "",
    `One tip for home: ${tip}`,
  ].join("\n");
  const html = [
    `<h1>${esc(head)}</h1>`,
    ...kids.map((k) => `<h2>${esc(k.nickname)}</h2><ul>${kidLines(k).map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`),
    `<p><strong>One tip for home:</strong> ${esc(tip)}</p>`,
  ].join("\n");
  return { subject: "Your week with Brightling AI", text, html };
}
