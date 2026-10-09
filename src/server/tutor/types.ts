import { z } from "zod";
import type { AgeBand, MistakeTag, Style } from "@/domain/types";

export const VISUAL_CUES = ["count-along", "highlight-numbers", "show-style", "sparkle"] as const;
export type VisualCue = (typeof VISUAL_CUES)[number];

export type TutorEvent = "present" | "correct" | "wrong" | "hint" | "explain" | "celebrate" | "kid-said";

export type TurnPlan = {
  event: TutorEvent;
  ageBand: AgeBand;
  skill: string;
  problem: string;
  /** Numbers in the prompt text and the visual. Computed by code; Claude gets it as context. */
  problemNumbers: number[];
  answer: number;
  kidAnswer?: number;
  mistakeTag?: MistakeTag;
  style?: Style;
  kidSaid?: string;
  revealed?: boolean;
  recentLines: string[];
};

export const TutorLineSchema = z.object({
  say: z.string().min(1).max(400),
  show: z.enum(VISUAL_CUES).optional(),
  tone: z.enum(["cheer", "calm", "curious"]),
});
export type TutorLine = z.infer<typeof TutorLineSchema>;

export type CheckResult =
  | { ok: true }
  | { ok: false; reason: "numbers" | "early-answer" | "length" | "word" | "name" };
