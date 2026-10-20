import { getSkill } from "../curriculum";
import type { SessionSummary } from "./types";

/** A skill's kid name, or null for an id no longer in the curriculum (a saved session can outlive a rename). */
function nameOf(id: string): string | null {
  try {
    const skill = getSkill(id);
    return skill.kidName ?? skill.name;
  } catch {
    return null;
  }
}

/** Kid words for the end card. The browser receives text, not the selected skill ids. */
export function progressLines(summary: Pick<SessionSummary, "today" | "next">): { today: string | null; next: string | null } {
  const { today, next } = summary;
  const todayName = today && "skillId" in today ? nameOf(today.skillId) : null;
  const nextName = next && "skillId" in next ? nameOf(next.skillId) : null;
  return {
    today: today === null ? null
      : today.kind === "learned" ? todayName && `You learned ${todayName}!`
      : today.kind === "practiced" ? todayName && `You practiced ${todayName}.`
      : today.kind === "kept-going" ? "You kept going and solved a tricky one!"
      : "You showed Nova what you can do!",
    next: next === null ? null
      : next.kind === "mix" ? "Next time: a mix of your skills"
      : nextName && `Next time: ${next.kind === "more" ? "more " : ""}${nextName}`,
  };
}
