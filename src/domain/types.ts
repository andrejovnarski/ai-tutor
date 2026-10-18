export type Style = "number-line" | "blocks" | "ten-frame" | "story" | "drawing";
export type Grade = "K" | "1" | "2";
export type Level = 1 | 2 | 3;
export const LEVELS: readonly Level[] = [1, 2, 3];
export type AgeBand = "5-7" | "8-11";
export type Icon = "apple" | "star" | "fish" | "ball" | "duck" | "shell" | "block" | "cookie";

export type Visual =
  | { kind: "objects"; icon: Icon; groups: number[]; crossedOut?: number } // crossedOut = last N of groups[0]
  // Two frames filled in order: `first` dots in one color, then `second` in another (first + second ≤ 20,
  // so first may spill into the second frame). crossedOut = last N dots.
  | { kind: "ten-frames"; first: number; second: number; crossedOut?: number }
  | { kind: "number-line"; from: number; to: number; marks: number[]; jump?: { from: number; by: number } }
  // crossedOut.ones may exceed groups[0].ones (43 − 7): the renderer breaks a ten into ones first.
  | { kind: "blocks"; groups: { tens: number; ones: number }[]; crossedOut?: { tens: number; ones: number } }
  | { kind: "equation"; text: string }
  | { kind: "story"; text: string; icon: Icon; groups?: number[]; crossedOut?: number }; // crossedOut = last N objects across groups

export const MISTAKE_TAGS = [
  "off-by-one-counting", "off-by-ten", "added-instead", "subtracted-instead", "wrong-operation",
  "picked-other", "gave-total", "gave-part", "repeated-number", "skipped-number", "counted-back",
  "forgot-the-ten", "subtracted-smaller-digit", "forgot-to-regroup", "added-digits",
  "counted-ones-only", "swapped-digits", "picked-ones-digit", "added-one", "subtracted-one",
  "dropped-zero", "added-to-tens", "used-double", "stopped-after-one-step",
] as const;
export type MistakeTag = (typeof MISTAKE_TAGS)[number];
export type Mistake = { answer: number; tag: MistakeTag };

export type Problem = {
  prompt: { say: string; show: Visual };
  answer: number;
  input: "tap-choice" | "number-pad" | "voice" | "drag";
  choices?: number[];
  mistakes: Mistake[];
  sum?: [number, number]; // the two addends in spoken order (Count on: bigger first); server-only (their total is the answer)
};
export type Template = { id: string; make: (seed: number, level: Level) => Problem };
export type Skill = {
  id: string;
  name: string;
  grade: Grade;
  commonCore: string[];
  needs: string[];
  templates: string[];
  styles: Style[];
};
export type Cluster = { id: string; name: string; skills: Skill[]; templates: Template[] };
