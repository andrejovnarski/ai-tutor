---
tags: [design]
status: approved
date: 2026-10-08
---
# Section 3: Skill map and problem maker

## Skill map = data in the repo
Stored as TypeScript files in the codebase (not the database): reviewable, versioned, testable.

```ts
type Skill = {
  id: string;              // "add-within-10.make-ten"
  name: string;            // "Make 10"
  grade: "K" | "1" | "2";
  commonCore: string[];    // ["K.OA.A.4"]
  needs: string[];         // prerequisite skill ids
  templates: string[];     // problem template ids
  styles: Style[];         // teaching ways that fit this skill
};
type Style = "number-line" | "blocks" | "ten-frame" | "story" | "drawing";
```

Each cluster in [[Skill Map]] splits into 3–5 small skills. Example — [[Add within 10]]:
1. Add with pictures (count all)
2. Add within 5
3. Count on from the bigger number
4. Make 10 (number bonds)
5. Missing number (3 + ? = 7)

## Problem template
A pure function: `(seed, level) → Problem`.

```ts
type Problem = {
  prompt: { say: string; show: Visual };   // what to read aloud + what to draw
  answer: number;
  input: "tap-choice" | "number-pad" | "voice" | "drag";
  choices?: number[];                      // with smart wrong options
  mistakes: { answer: number; tag: string }[]; // e.g. 12 for 8+5 → "off-by-one-counting"
};
```

- **Seeded** → same seed, same problem. Reproducible for tests and reports.
- **Level inside a skill:** number size, and picture support fading out (pictures → numbers only).
- **Known mistakes are tagged.** A tagged wrong answer tells the engine *why* the kid was wrong → better teaching way.
- **Input by age:** 5–7 get big tap choices and voice; 8–11 also get number pad.

## Checker
Pure code. Normalizes voice ("twelve", "12", "one two") to a number, compares, returns `correct | known-mistake(tag) | wrong`.

## Quality
- Property tests per template: 1,000 seeds → answer is right, numbers in range, choices unique and include the answer.
- Size: ~30 skills × 2–3 templates ≈ 60–90 templates. Drafted with Claude from Common Core text, reviewed by you. Biggest single chunk of v1 work.

Related: [[S2 - System Parts]], [[Skill Map]], [[Decision - Approach]]
