import type { AgeBand, Level, MistakeTag, Style } from "../types";

export type KidGrade = "K" | "1" | "2" | "3" | "4" | "5";
export type Mode = "recall" | "practice" | "review" | "check" | "placement" | "wind-down";

export type SkillState = {
  skillId: string;
  pKnown: number;
  attempts: number;
  level: Level;
  correctStreak: number;
  wrongStreak: number;
  lastSeen: number | null;
  placed: boolean;
  checkStep: 0 | 1 | 2 | 3;
  checkDue: number | null;
  rememberedAt: number | null;
  /** Last 4 first tries, newest last; null = correct or not a known mistake. */
  recentTags: (MistakeTag | null)[];
};

export type StyleStat = { style: Style; tries: number; wins: number };

export type KidState = {
  kidId: string;
  ageBand: AgeBand;
  grade: KidGrade;
  placed: boolean;
  skills: Record<string, SkillState>;
  styles: Record<Style, StyleStat>;
};

export type Attempt = {
  kidId: string;
  skillId: string;
  templateId: string;
  seed: number;
  level: Level;
  answer: number | null;
  result: "correct" | "known-mistake" | "wrong" | "helped";
  mistakeTag: MistakeTag | null;
  style: Style | null;
  timeMs: number;
  at: number;
  try: 1 | 2;
  mode: Mode;
};
