import { getSkill } from "../curriculum";
import type { SessionSummary } from "./types";

/** Kid words for the end card. The browser receives text, not the selected skill ids. */
export function progressLines(summary: Pick<SessionSummary, "today" | "next">): { today: string | null; next: string | null } {
  const name = (id: string) => { const skill = getSkill(id); return skill.kidName ?? skill.name; };
  const { today, next } = summary;
  return {
    today: today === null ? null
      : today.kind === "learned" ? `You learned ${name(today.skillId)}!`
      : today.kind === "practiced" ? `You practiced ${name(today.skillId)}.`
      : today.kind === "kept-going" ? "You kept going and solved a tricky one!"
      : "You showed Nova what you can do!",
    next: next === null ? null
      : next.kind === "mix" ? "Next time: a mix of your skills"
      : `Next time: ${next.kind === "more" ? "more " : ""}${name(next.skillId)}`,
  };
}
