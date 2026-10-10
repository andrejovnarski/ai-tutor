// What Nova's bubble shows for a play state. Pure, so the hold / lead / note rules are unit-tested.
import type { NovaTone } from "./Nova";
import type { PlayState } from "./playMachine";

export type BubbleView = {
  say?: string;
  /** The feedback line shown above the new problem's line (no timed swap). */
  lead?: string;
  /** The reveal note: only ever beside the feedback line, never under a new problem's line alone. */
  note?: string;
  tone: NovaTone;
  hop: boolean;
  /** True while a correct answer's feedback line is held before the timed swap. */
  holding: boolean;
};

/** Whether this state wants the 1.2 s hold: a correct answer that moved on, with motion allowed. */
export const wantsHold = (s: PlayState, reduced: boolean) => !!s.message && !!s.correct && !reduced;

export function bubbleView(s: PlayState, { reduced, holdDone }: { reduced: boolean; holdDone: boolean }): BubbleView {
  const hop = !!s.correct && !reduced;
  const note = s.note ?? undefined;
  const lineTone = s.line?.tone ?? "calm";
  if (s.phase === "ended") return { say: s.line?.say, note, tone: "cheer", hop, holding: false };
  if (!s.message) return { say: s.line?.say, note, tone: lineTone, hop, holding: false };
  if (wantsHold(s, reduced)) {
    return holdDone
      ? { say: s.line?.say, tone: lineTone, hop, holding: false }
      : { say: s.message, note, tone: s.messageTone ?? "cheer", hop, holding: true };
  }
  // Not correct (an explain line that may state the answer), or reduced motion: both lines stay, feedback first.
  return { say: s.line?.say, lead: s.message, note, tone: lineTone, hop, holding: false };
}
