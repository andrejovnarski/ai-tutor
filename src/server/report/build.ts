import type { Mail } from "../email/mailer";
import type { MistakeTag } from "../../domain/types";
import { DEFAULT_TIP, TAG_LABEL, TIP_FOR_TAG } from "./tips";

export { DEFAULT_TIP, TAG_LABEL, TIP_FOR_TAG };

export type KidWeek = {
  nickname: string;
  sessions: number;
  minutes: number;
  mastered: string[]; // skill names
  currentSkill: string | null; // skill name
  stuck: string[]; // tag labels
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Lines for one kid, shared by the text and HTML versions. */
function kidLines(k: KidWeek): string[] {
  if (k.sessions === 0) return ["No sessions this week."];
  return [
    `${plural(k.sessions, "session", "sessions")}, ${plural(k.minutes, "minute", "minutes")}`,
    `Mastered this week: ${k.mastered.length ? k.mastered.join(", ") : "nothing new yet"}`,
    `Working on now: ${k.currentSkill ?? "everything so far is mastered"}`,
    `Stuck points: ${k.stuck.length ? k.stuck.join("; ") : "none this week"}`,
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
  const head = `Your week with Math Friend (week of ${weekOf})`;
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
  return { subject: "Your week with Math Friend", text, html };
}
