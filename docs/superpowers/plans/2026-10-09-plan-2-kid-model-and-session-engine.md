# Plan 2 — Kid Model and Session Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deterministic code that decides what each kid does next: how well they know each skill (BKT), the level inside a skill, which skill comes next (practice, step up, step back, review), placement, how to explain (teaching style), and the session loop that ties these together. Then prove the whole thing with simulated kids.

**Architecture:** A functional core in `src/domain/kid/` (pure functions on plain data) and `src/domain/session/` (a JSON-serializable session state machine). The engine does no I/O. Each answer returns the new state plus a `Writes` record: the rows Plan 3 must save (attempt, skill states, style stats) before the next problem is shown. Simulated kids in `src/domain/sim/` play hundreds of problems against the real engine.

**Tech Stack:** TypeScript, Vitest. Built on Plan 1 (`src/domain/curriculum`, `problems`, `checker`, `rng`).

**Spec:** `docs/superpowers/specs/2026-10-08-adaptive-tutor-design.md` (§4 loop, §6 kid model, §9 errors, §10 simulated kids). Plan 1: `docs/superpowers/plans/2026-10-09-plan-1-skill-map-and-problem-maker.md`.

## Decisions this plan makes

- **Mastery-model starting numbers** (spec §11): every skill starts with `prior 0.2, learn 0.15, slip 0.1`. The spec asks for per-skill values, so `BKT_OVERRIDES` exists but stays empty until real data arrives. **Guess** is not a per-skill number. It comes from how the problem was answered: number pad 0.05, two choices 0.5, otherwise 1 ÷ number of choices. A per-skill guess would be wrong for half the kids, because ages 5–7 tap and ages 8–11 type the same skill.
- **Storage:** the plan-series table said "storage behind an interface". This plan replaces that with a `Writes` record returned after each answer, which keeps the engine pure and easy to simulate. Plan 3 saves each `Writes` to Supabase.
- **Retries:** a wrong first try gets an explanation in a chosen style and one retry. A wrong retry gets a final explanation that reveals the answer, then the next problem. This matches the spec §7 rule that the answer is spoken only after 2 failed tries. BKT, level and streaks use the **first try only**. The retry only updates style stats.

## Global Constraints

- `src/domain` stays pure. There is no I/O, no `Date.now()` (time is always passed in as `now`, in ms), and no `Math.random`. All randomness comes from `createRng` with seeds derived from the session seed and step.
- A `Session` must survive `JSON.parse(JSON.stringify(session))` and then behave identically. This is how "resume at the same problem" works (spec §9).
- Mastered = `pKnown ≥ 0.95` and (`attempts ≥ 5` or set by placement) (spec §6).
- Level: 3 first-try correct in a row → one level up (max 3). 2 first-try wrong in a row → one level down (min 1) (spec §6).
- Struggling = 2 first-try wrong in a row at level 1, or the same mistake tag twice in the skill's last 4 first tries (spec §6).
- Review is every 5th problem: a mastered skill, oldest `lastSeen` first (spec §6).
- Loop guard: at most 3 step-backs in a row. A 4th triggers an easy review, ending on a win, and a log (spec §6).
- Placement takes about 10 problems: 5 probes × 2 problems, binary search along `SKILLS` order, starting at the parent-given grade (spec §6).
- Session length: ages 5–7 run 10–15 minutes, ages 8–11 run 15–20 minutes. Always end on a likely win (spec §6).
- Teaching style uses Thompson sampling over the skill's allowed styles. Mistake tags bias the choice (spec §6).
- An attempt row holds: kid, skill, template, seed, level, answer, result, mistake tag, style used, time taken, timestamp (spec §6).
- A kid who quits mid-problem gets no penalty, and that attempt is not counted (spec §9).
- If a template throws, use another template for the same skill and log it (spec §9).
- Test first. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Double tap on a tablet.** `answer` is called twice for one problem. The second call must be ignored: no second attempt row, no second BKT update. Pinned in Task 6.
2. **Coming back the next day.** A session loaded hours later must not wind down on one problem. If more than 30 minutes have passed since the last activity, `nextTurn` ends the session (dropping any unanswered problem with no penalty), so the app can start a fresh one. Pinned in Task 6.
3. **Clock oddities.** If `now` is earlier than when the problem was shown, or an answer comes after 20 minutes, `timeMs` is clamped to 0…600000. Pinned in Task 6.
4. **A kid who has mastered everything** (a strong 8–11-year-old). There is no frontier skill, so every problem is a review. Nothing may crash or loop forever. Pinned in Task 7.
5. **Struggling on the entry skill**, which has no prerequisites. There is no check and no step-back: only a switch of teaching style. Pinned in Task 7.

---

## File structure

```
src/domain/kid/types.ts        KidState, SkillState, StyleStat, Attempt, Mode, KidGrade
src/domain/kid/bkt.ts          BKT update, guessFor, isMastered, params
src/domain/kid/state.ts        newKidState, applyFirstTry (BKT + level + streaks + tags)
src/domain/kid/style.ts        TAG_STYLES, sampleBeta, pickStyle, recordStyle
src/domain/kid/next.ts         frontier, reviewTarget, easyReview, weakestPrereq, isStruggling
src/domain/kid/placement.ts    placement state machine
src/domain/session/types.ts    Session, Turn, Feedback, Writes, LogEntry, SessionSummary
src/domain/session/engine.ts   startSession, nextTurn, answer
src/domain/sim/bot.ts          simulated kid
src/domain/sim/sim.test.ts     whole-system checks
```

Each `*.test.ts` sits next to its module.

---

### Task 1: Kid types and BKT

**Files:** Create `src/domain/kid/types.ts` and `src/domain/kid/bkt.ts`. Test: `src/domain/kid/bkt.test.ts`

**Interfaces — Produces:**

```ts
// types.ts
export type KidGrade = "K" | "1" | "2" | "3" | "4" | "5";
export type Mode = "practice" | "review" | "check" | "placement" | "wind-down";
export type SkillState = {
  skillId: string; pKnown: number; attempts: number; level: Level;
  correctStreak: number; wrongStreak: number; lastSeen: number | null;
  placed: boolean; recentTags: (MistakeTag | null)[];   // last 4 first tries, newest last; null = not a known mistake
};
export type StyleStat = { style: Style; tries: number; wins: number };
export type KidState = {
  kidId: string; ageBand: AgeBand; grade: KidGrade; placed: boolean;
  skills: Record<string, SkillState>; styles: Record<Style, StyleStat>;
};
export type Attempt = {
  kidId: string; skillId: string; templateId: string; seed: number; level: Level;
  answer: number; result: "correct" | "known-mistake" | "wrong"; mistakeTag: MistakeTag | null;
  style: Style | null; timeMs: number; at: number; try: 1 | 2; mode: Mode;
};
```

```ts
// bkt.ts
export type BktParams = { prior: number; learn: number; slip: number };
export const BKT_DEFAULTS: BktParams = { prior: 0.2, learn: 0.15, slip: 0.1 };
export const BKT_OVERRIDES: Record<string, Partial<BktParams>> = {};
export const MASTERED_P = 0.95;
export const MASTERED_ATTEMPTS = 5;
export function bktParams(skillId: string): BktParams;
export function guessFor(p: Problem): number;     // number-pad 0.05; else 1 / choices.length
export function bktUpdate(pKnown: number, correct: boolean, params: BktParams, guess: number): number;
export function isMastered(s: SkillState): boolean;
```

`bktUpdate` takes the standard posterior given the evidence, then applies learning: `post + (1 − post) · learn`.

- [ ] **Step 1: Write the failing test**

```ts
const P = BKT_DEFAULTS;
it("correct answer from prior", () => expect(bktUpdate(0.2, true, P, 0.25)).toBeCloseTo(0.552632, 5));
it("wrong answer from prior", () => expect(bktUpdate(0.2, false, P, 0.25)).toBeCloseTo(0.177419, 5));
it("three correct on 4 choices pass 0.95", () => {
  let p = P.prior; for (let i = 0; i < 3; i++) p = bktUpdate(p, true, P, 0.25);
  expect(p).toBeGreaterThan(0.95);
});
it("stays in (0, 1)", () => { for (const c of [true, false]) for (const p of [0.001, 0.5, 0.999]) {
  const q = bktUpdate(p, c, P, 0.5); expect(q).toBeGreaterThan(0); expect(q).toBeLessThan(1); } });
it("guessFor by input", () => {
  const base = { prompt: { say: "", show: { kind: "equation", text: "" } }, answer: 1, mistakes: [] } as const;
  expect(guessFor({ ...base, input: "number-pad", choices: [1, 2, 3, 4] })).toBe(0.05);
  expect(guessFor({ ...base, input: "tap-choice", choices: [1, 2] })).toBe(0.5);
  expect(guessFor({ ...base, input: "tap-choice", choices: [1, 2, 3, 4] })).toBe(0.25);
});
it("mastered needs 0.95 and 5 attempts, or placement", () => {
  const s = { skillId: "x", pKnown: 0.96, attempts: 4, level: 1, correctStreak: 0, wrongStreak: 0, lastSeen: null, placed: false, recentTags: [] } as const;
  expect(isMastered(s)).toBe(false);
  expect(isMastered({ ...s, attempts: 5 })).toBe(true);
  expect(isMastered({ ...s, placed: true })).toBe(true);
  expect(isMastered({ ...s, attempts: 9, pKnown: 0.94 })).toBe(false);
});
it("bktParams merges overrides over defaults", () => expect(bktParams("count-to-20.objects-to-10")).toEqual(BKT_DEFAULTS));
```

- [ ] **Step 2: Run it.** `npm test -- src/domain/kid` → FAIL (module not found).
- [ ] **Step 3: Implement** `types.ts` and `bkt.ts`.
- [ ] **Step 4: Run it.** `npm test && npm run typecheck` → PASS.
- [ ] **Step 5: Commit.** `feat: kid types and BKT mastery model`

---

### Task 2: Kid state and first-try update

**Files:** Create `src/domain/kid/state.ts`. Test: `src/domain/kid/state.test.ts`

**Interfaces:**
- Consumes `SKILLS` (Plan 1) and `bktUpdate`, `bktParams` (Task 1).
- Produces:
  - `newKidState(kidId: string, ageBand: AgeBand, grade: KidGrade): KidState`. Every skill in `SKILLS` gets `pKnown = bktParams(id).prior`, level 1, streaks 0, `lastSeen` null, `placed` false and `recentTags` `[]`. Every `Style` gets 0 tries and 0 wins. `placed` is false.
  - `applyFirstTry(s: SkillState, o: { correct: boolean; tag: MistakeTag | null; guess: number; now: number }): SkillState` updates the BKT value and adds 1 to `attempts`. It sets `lastSeen = now` and pushes the tag (null when correct or plain wrong) onto `recentTags`, keeping the last 4. It then applies the level rule: 3 correct in a row raises the level and resets streaks, and 2 wrong in a row lowers it and resets streaks. At level 1 the wrong streak is **not** reset, so `isStruggling` can see it.
  - `resetStruggle(s: SkillState): SkillState` sets `wrongStreak = 0` and `recentTags = []`.

- [ ] **Step 1: Write the failing tests**
  - A new kid has 33 skills and 5 styles, and every `pKnown` is 0.2.
  - Three correct at level 1 → level 2 with streaks 0. Three more → 3. Three more → stays at 3.
  - From level 3, two wrong → level 2 with wrong streak 0. Two more → level 1. Two more at level 1 → stays at 1 with `wrongStreak` 2.
  - A correct answer resets `wrongStreak`, and a wrong answer resets `correctStreak`.
  - `recentTags` keeps the last 4: after tags a, b, null, c, d it holds `[b, null, c, d]`.
  - `attempts`, `lastSeen` and `pKnown` change exactly as in Task 1's numbers (0.2, correct, guess 0.25 → 0.552632).
  - `applyFirstTry` does not mutate its input.
- [ ] **Step 2: Run them.** FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them.** `npm test && npm run typecheck` → PASS.
- [ ] **Step 5: Commit.** `feat: kid state, level rule and first-try update`

---

### Task 3: Teaching-style picker

**Files:** Create `src/domain/kid/style.ts`. Test: `src/domain/kid/style.test.ts`

**Interfaces — Produces:**
- `TAG_STYLES: Record<MistakeTag, Style[]>`, exactly:

| Tags | Preferred styles |
|---|---|
| off-by-one-counting, repeated-number, skipped-number, counted-back, picked-other | number-line |
| added-instead, subtracted-instead, wrong-operation, stopped-after-one-step | story, drawing |
| gave-total, gave-part, used-double, forgot-the-ten | ten-frame, blocks |
| subtracted-smaller-digit, forgot-to-regroup, added-digits, counted-ones-only, swapped-digits, picked-ones-digit, added-one, subtracted-one, dropped-zero, added-to-tens, off-by-ten | blocks |

- `sampleBeta(rng: Rng, a: number, b: number): number` for integers a, b ≥ 1 (a Gamma ratio built from sums of `−ln U`).
- `pickStyle(rng: Rng, allowed: Style[], stats: Record<Style, StyleStat>, opts: { tag?: MistakeTag | null; exclude?: Style | null }): Style`. For each allowed style (minus `exclude`, unless that would leave nothing), it draws `Beta(wins + 1 + bias, tries − wins + 1)`, where `bias = 2` if the style is in `TAG_STYLES[tag]`, else 0. The highest draw wins.
- `recordStyle(stats, style: Style, won: boolean): Record<Style, StyleStat>` returns a copy with 1 added to `tries` and, if `won`, 1 added to `wins`.

- [ ] **Step 1: Write the failing tests**
  - `sampleBeta(rng, 3, 1)`: the mean of 2000 draws is within 0.03 of 0.75, and every draw is in (0, 1).
  - `pickStyle` returns only allowed styles, and with the same seed it gives the same style.
  - Bias: with zero stats, `allowed = ["number-line", "blocks"]` and `tag: "off-by-one-counting"`, number-line wins in more than 60% of 1,000 seeds. Without the tag it wins in 40–60%.
  - Learning: stats with blocks `{tries: 20, wins: 18}` and number-line `{tries: 20, wins: 2}` → blocks wins in more than 90% of 1,000 seeds.
  - `exclude` is never returned when another allowed style exists, and is returned when it is the only one.
  - `recordStyle` does not mutate its input.
- [ ] **Step 2: Run them.** FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them.** `npm test && npm run typecheck` → PASS.
- [ ] **Step 5: Commit.** `feat: Thompson-sampling teaching-style picker`

---

### Task 4: Next-skill helpers

**Files:** Create `src/domain/kid/next.ts`. Test: `src/domain/kid/next.test.ts`

**Interfaces — Produces:**
- `frontier(kid: KidState): string | null` returns the first skill in `SKILLS` order that is not mastered and whose `needs` are all mastered. It returns null when every skill is mastered.
- `reviewTarget(kid: KidState, exclude: string | null): string | null` returns the mastered skill (≠ `exclude`) with the oldest `lastSeen`. `null` counts as oldest, and ties go to the earliest in `SKILLS` order.
- `easyReview(kid: KidState): string | null` returns the mastered skill earliest in `SKILLS` order.
- `weakestPrereq(kid: KidState, skillId: string): string | null` returns the need with the lowest `pKnown`, with ties going to the earliest in order. It returns null when the skill has no needs.
- `isStruggling(s: SkillState): boolean` is true when `(level === 1 && wrongStreak >= 2)` or when some non-null tag appears at least twice in `recentTags`.

- [ ] **Step 1: Write the failing tests** (build kid states with `newKidState` plus small helpers that mark skills mastered by setting `pKnown: 0.97, attempts: 5`):
  - `SKILLS` order is topological: every need appears earlier than the skill that needs it. `frontier` relies on this.
  - A new kid's frontier is `count-to-20.objects-to-10`.
  - With the first 3 skills mastered, the frontier is `compare-numbers.groups`.
  - A skill whose need is not mastered is skipped, even if it comes earlier in order and is itself not mastered.
  - With everything mastered, the frontier is null.
  - `reviewTarget` returns the oldest `lastSeen`, skips `exclude`, and returns null when nothing is mastered.
  - `easyReview` returns the earliest mastered skill.
  - `weakestPrereq("add-subtract-within-20.related-facts")` picks the need with the lower `pKnown`, and `weakestPrereq("count-to-20.objects-to-10")` is null.
  - `isStruggling` covers the two triggers. Level 2 with a wrong streak of 2 and no repeated tag is false. `[a, null, a, null]` is true.
- [ ] **Step 2: Run them.** FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them.** `npm test && npm run typecheck` → PASS.
- [ ] **Step 5: Commit.** `feat: next-skill helpers (frontier, review, prerequisite, struggling)`

---

### Task 5: Placement

**Files:** Create `src/domain/kid/placement.ts`. Test: `src/domain/kid/placement.test.ts`

**Interfaces — Produces:**
- `type PlacementState = { lo: number; hi: number; mid: number; probes: number; inProbe: number; probeOk: boolean }` (JSON-serializable).
- `PLACEMENT_PROBES = 5`, `PROBE_SIZE = 2`, `PROBE_LEVEL: Level = 2`.
- `startPlacement(grade: KidGrade): PlacementState` sets `lo = 0` and `hi = SKILLS.length − 1`. `mid` is the index of the first skill with the matching grade: `"K"` → 0, `"1"` → the first `"1"` skill, and `"2"` through `"5"` → the first `"2"` skill.
- `placementProbe(p: PlacementState): { skillId: string; level: Level } | null` returns null once placement is done.
- `recordPlacement(p: PlacementState, correct: boolean): PlacementState`. After `PROBE_SIZE` answers, a probe passes only if all of them were correct. A pass sets `lo = mid + 1` and a fail sets `hi = mid − 1`. Then `probes` goes up by 1, the probe counters reset, and `mid = ⌊(lo + hi) / 2⌋`. Placement is done when `probes === PLACEMENT_PROBES` or `lo > hi`.
- `finishPlacement(kid: KidState, p: PlacementState): KidState`. Every skill with index < `lo` gets `pKnown 0.95`, `placed true` and level 2. Then `kid.placed = true`.

- [ ] **Step 1: Write the failing tests**
  - Start index: `"K"` → 0. `"1"` → the index of the first grade-1 skill in `SKILLS`. `"4"` → the first grade-2 skill.
  - A perfect oracle that "knows" the first k skills (for k in 0, 5, 12, 20, 33, and grades K, 1 and 2): run probes until done, then `|lo − k| ≤ 3` and the number of problems is ≤ 10.
  - The first probe is at the grade start.
  - `finishPlacement` sets exactly the skills below `lo` as placed, and `isMastered` holds for each of them.
  - The state survives a JSON round trip mid-placement.
- [ ] **Step 2: Run them.** FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them.** `npm test && npm run typecheck` → PASS.
- [ ] **Step 5: Commit.** `feat: placement by binary search along the skill chain`

---

### Task 6: Session engine — core loop

**Files:** Create `src/domain/session/types.ts` and `src/domain/session/engine.ts`. Test: `src/domain/session/engine.test.ts`

**Interfaces:**
- Consumes everything from Tasks 1–5, plus `generate`, `getSkill` and `SKILLS` (Plan 1), `adaptInput` (Plan 1 `problems/build`), `check` (Plan 1 `checker/check`), and `createRng`.
- Produces, in `types.ts`:

```ts
export type LogEntry = { type: "template-failed" | "step-back" | "loop-guard" | "check-passed"; skillId: string; detail?: string };
export type Turn =
  | { kind: "problem"; problem: Problem; skillId: string; templateId: string; seed: number; level: Level; mode: Mode; try: 1 | 2; logs: LogEntry[] }
  | { kind: "end"; summary: SessionSummary };
export type SessionSummary = { problems: number; firstTryCorrect: number; minutes: number; mastered: string[] };
export type Feedback = {
  result: CheckResult; then: "retry" | "next"; style: Style | null; reveal: boolean;
  mastered: string[]; logs: LogEntry[];
};
export type Writes = { kidId: string; attempts: Attempt[]; skillStates: SkillState[]; styleStats: StyleStat[]; kidPlaced?: true };
export type Session = { /* JSON-serializable; fields are the implementer's choice, holding kid: KidState */ kid: KidState };
export const SESSION_MINUTES: Record<AgeBand, [min: number, max: number]> = { "5-7": [10, 15], "8-11": [15, 20] };
export const STALE_MS = 30 * 60_000;
export const REVIEW_EVERY = 5;
```

- Produces, in `engine.ts`:
  - `startSession(kid: KidState, seed: number, now: number): Session`
  - `nextTurn(s: Session, now: number, deps?: Deps): { session: Session; turn: Turn }`. While a problem is pending, it returns that **same** problem (same seed, template and level). On a retry it returns the same problem with `try: 2`.
  - `answer(s: Session, given: number, now: number): { session: Session; feedback: Feedback; writes: Writes } | null`. It returns null when no problem is pending (double tap).
  - `type Deps = { generate: (templateId: string, seed: number, level: Level) => Problem }`, which defaults to Plan 1's `generate`. It exists so tests can inject a throwing template.

**Rules in this task:**
- **Seeds.** Each decision draws from `createRng(mix(sessionSeed, step))`, where `step` counts `nextTurn` calls that produce a new problem. The problem seed is `rng.int(0, 2**31 − 1)`, and the template is picked from `skill.templates` with the rng.
- **Template fallback.** If `generate` throws, try the skill's other templates in order and log `template-failed`. If every template throws, end the session (`kind: "end"`).
- **Input.** The problem is run through `adaptInput(problem, kid.ageBand)`.
- **Order of choice in `nextTurn`:**
  1. A pending problem is returned as it is.
  2. If `now − lastActivity > STALE_MS`: end the session and drop the pending problem.
  3. Placement runs while `!kid.placed`. It ends with `finishPlacement`, and `Writes.kidPlaced` is set on the answer that finishes it.
  4. The remaining branches belong to Task 7 (check, review, wind-down). In this task, practice the frontier skill at its level. When there is no frontier, use `reviewTarget`.
  5. End when `elapsed ≥ min` and the last answer was correct.
- **Answer.**
  - Run `check`, and clamp `timeMs` to 0…600000.
  - Build the `Attempt` row: `style` is the style used for the explanation before a retry, null on the first try.
  - On a first try in practice or review mode, call `applyFirstTry` with `guessFor(problem)`.
  - Correct: `then: "next"`. Wrong on try 1 in practice or review: pick a style with `pickStyle(rng, skill.styles, kid.styles, { tag })`, return `then: "retry"`, and keep the problem pending as try 2. Wrong on try 2: `reveal: true`, `then: "next"`, and the style used again.
  - After a retry, `recordStyle(style, won = retry correct)`.
  - In placement mode a wrong answer gives `then: "next"`, `reveal: false` and `style: null`, with no BKT update.
  - `feedback.mastered` lists any skill that became mastered on this answer.
  - `Writes` holds the attempt and every changed skill state and style stat.

- [ ] **Step 1: Write the failing tests** (use a helper `playUntilEnd(session, answerFn, clock)` in the test file):
  - **Deterministic:** two sessions with the same kid, seed and clock produce identical turns.
  - **Resume:** run 7 turns, JSON round-trip the session, then continue. The turns and writes match a run with no round trip, and a pending problem comes back unchanged after the round trip.
  - **First session = placement:** a new kid's first 10 problems or fewer are in `mode: "placement"`. Then `kid.placed` is true and the writes on that answer have `kidPlaced: true`.
  - **Retry flow:** in practice, a wrong first answer gives `then: "retry"`, a style from `skill.styles` and `reveal: false`, and the next turn is the same problem with `try: 2`. A wrong second answer gives `reveal: true` and `then: "next"`. A correct second answer gives a style-stat write with `wins + 1`.
  - **BKT on first try only:** after wrong then correct, `attempts` went up by 1 (not 2) and two attempt rows exist with `try` 1 and 2.
  - **Review Focus 1 (double tap):** `answer` with nothing pending returns null.
  - **Review Focus 2 (stale):** answer one problem, get the next turn, then call `nextTurn` again with `now + 31 min`. The result is `kind: "end"` with no writes for the unanswered problem.
  - **Review Focus 3 (clock):** an answer at `now − 5000` gives `timeMs` 0, and an answer after 25 minutes gives 600000.
  - **Session length:** a kid aged 5–7 who is always right ends between 10 and 11 minutes (20 s per answer). A kid who is right except at the 10-minute mark gets a turn after 10 minutes, and the session ends on a correct answer. An 8–11 kid ends at 15 minutes or later.
  - **Template fallback:** inject `deps.generate` that throws for one template id. That turn uses the other template and logs `template-failed`. If every template throws, the result is `kind: "end"`.
  - **8–11 input:** the problem input is `number-pad`, except for two-choice problems.
- [ ] **Step 2: Run them.** FAIL.
- [ ] **Step 3: Implement** `types.ts` and `engine.ts`.
- [ ] **Step 4: Run them.** `npm test && npm run typecheck` → PASS.
- [ ] **Step 5: Commit.** `feat: session engine core loop (placement, practice, retry, resume, writes)`

---

### Task 7: Session engine — adapting (review, check, step-back, loop guard, wind-down)

**Files:** Modify `src/domain/session/engine.ts`. Test: `src/domain/session/adapt.test.ts`

**Interfaces:** Same public API as Task 6. This task fills in branch 4 of `nextTurn` and the struggling logic in `answer`.

**Rules:**
- **Review cadence.** When the session's problem count (practice and review problems, counted from 1) is a multiple of `REVIEW_EVERY` and `reviewTarget(kid, current)` is not null, serve that skill in `mode: "review"` at its level.
- **Low accuracy.** If 4 or more of the last 10 first tries were wrong and `easyReview` exists, the next problem is `mode: "review"` on `easyReview` at level 1. This is the "aim for ~80% correct" valve.
- **Struggling** (checked after a first-try wrong in practice, using `isStruggling`):
  - If `weakestPrereq` exists, start a check: 2 problems on the prerequisite at level 1 in `mode: "check"`. Check answers go through `applyFirstTry`, and a wrong check answer gives `reveal: true` and `then: "next"` with no retry.
    - A failed check (any wrong answer) steps back: the current skill becomes the prerequisite, the `step-back` log is written and `stepBacksInRow` goes up by 1.
    - A passed check (both right) keeps the current skill, logs `check-passed`, resets `stepBacksInRow` to 0, and marks the skill so the next `pickStyle` excludes the last style used for it.
  - If there is no prerequisite (the entry skill), only mark the style switch.
  - In every case, call `resetStruggle` on the skill.
- **Loop guard.** When a failed check would make `stepBacksInRow` 4, do not step back. Log `loop-guard` and enter wind-down.
- **Mastery.** When the current skill becomes mastered, set the current skill to `frontier(kid)`, reset `stepBacksInRow` to 0 and add it to `feedback.mastered`.
- **Wind-down** starts when `elapsed ≥ max` or when the loop guard fires. Serve `easyReview` (or the current skill if nothing is mastered) at level 1 in `mode: "wind-down"`. End after the first correct answer, or after 3 wind-down problems.

- [ ] **Step 1: Write the failing tests** (handmade kid states, scripted answers):
  - **Review cadence:** a placed kid with 3 mastered skills and an always-right answerer. Problems 5, 10 and 15 are `mode: "review"` on the oldest-`lastSeen` skill, and the others are practice.
  - **Review failure lowers pKnown:** a wrong review answer gives the reviewed skill a lower `pKnown` in the writes.
  - **Step-back:** on `add-within-10.missing` (needs `add-within-10.make-ten`), answer wrong twice at level 1. Then come 2 check problems on `make-ten` at level 1. Answering one of them wrong logs `step-back`, and the following practice problems are on `make-ten`.
  - **Check passed:** both check answers right logs `check-passed`. Practice returns to `missing`, and the next explanation style differs from the last one (whenever the skill allows more than one style).
  - **Same mistake tag twice** triggers a check even at level 2.
  - **Review Focus 5 (entry skill):** struggling on `count-to-20.objects-to-10` gives no check and no step-back, and the next explanation style differs.
  - **Loop guard:** a kid whose answerer is always wrong on skills above index 5 and always right below it, started with frontier `add-subtract-within-100.add-regroup` (all earlier skills marked mastered). At most 3 step-back logs appear in a row, `loop-guard` is logged, the wind-down problems are on `easyReview` at level 1, and the session ends on a correct answer.
  - **Mastery advances:** practicing the frontier with all answers right gives `feedback.mastered` that includes it within 5–8 problems, and the next practice skill is the new frontier.
  - **Review Focus 4 (all mastered):** with every skill mastered, every problem is review or wind-down, and the session ends normally within the time limit.
  - **Low accuracy valve:** after 4 wrong first tries out of the last 10, the next problem is an `easyReview` at level 1.
  - **Wind-down at max:** a kid who is always wrong past the max time gets at most 3 wind-down problems, then the session ends.
- [ ] **Step 2: Run them.** FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them.** `npm test && npm run typecheck` → PASS.
- [ ] **Step 5: Commit.** `feat: review, prerequisite check, step-back, loop guard and wind-down`

---

### Task 8: Simulated kids, and roadmap update

**Files:** Create `src/domain/sim/bot.ts`. Test: `src/domain/sim/sim.test.ts`. Modify `vault/05 Roadmap/Roadmap.md`.

**Interfaces — Produces:**
- `type BotProfile = { knows: Set<string>; slip: number; guess: number; learn: number; habit?: MistakeTag }`
- `makeBot(profile: BotProfile, seed: number): { respond(turn: Extract<Turn, { kind: "problem" }>): number; learnFrom(skillId: string, feedback: Feedback): void }`
  - If the bot knows the skill, it answers correctly with probability `1 − slip`.
  - If it does not know the skill, then with probability `guess` it picks uniformly from `choices`. Otherwise it gives a wrong answer: the mistake tagged `habit` if there is one, else `mistakes[0]`, else `answer + 1`.
  - `learnFrom`: after any explanation (feedback with a style), the bot learns the skill with probability `learn`, but only if it knows every need of that skill.
- `simulate(profile, opts: { grade: KidGrade; ageBand: AgeBand; seed: number; problems: number }): SimResult`. It plays back-to-back sessions (20 s per answer, a new session after each `end`, with the kid state carried over) until `problems` answers have been given. It returns `{ kid: KidState; firstTryRate: number; logs: LogEntry[]; placementIndex: number; modes: Mode[] }`.

- [ ] **Step 1: Write the failing tests** (spec §10: bots with known skill profiles play 200 problems):
  - **Placement accuracy:** noiseless bots (`slip 0, guess 0`) that know the first k skills in `SKILLS` order, k ∈ {0, 6, 12, 20, 28}, grade K. `|placementIndex − k| ≤ 3`. With noisy bots (`slip 0.1, guess 0.25`) across 20 seeds, the median `|error|` is ≤ 4.
  - **Step-back:** a bot that knows every skill before `add-within-10.missing` except `add-within-10.make-ten`, with `learn 0`. A kid state placed through `missing` (`make-ten` marked mastered by placement) logs a `step-back` to `add-within-10.make-ten` within 200 problems.
  - **Mastery reached:** a bot that knows the first 5 skills, with `learn 0.3`, `slip 0.05` and `guess 0.25`, starting from grade K, has at least 3 skills mastered by real attempts (not placement) after 200 problems.
  - **About 80% correct:** 20 bots, each knowing a random prefix (k from 0 to 25), with `learn 0.2`, `slip 0.08`, `guess 0.25` and 200 problems each. The overall first-try rate across all bots is between 0.65 and 0.92.
  - **Loop guard holds:** a bot with `learn 0` that knows only the first 6 skills, on a kid state placed through index 25. No more than 3 step-backs in a row are logged anywhere in the logs, and every session ends.
  - **Habit:** a bot with `habit: "off-by-one-counting"` that does not know `add-within-10.count-on`. Its explanations pick `number-line` in more than 50% of cases for that skill.
- [ ] **Step 2: Run them.** FAIL.
- [ ] **Step 3: Implement `bot.ts`.** If a sim threshold fails, find the cause with superpowers:systematic-debugging first. Change an engine rule only when the simulated behavior is really wrong, and ledger that as a ruling. Never loosen a threshold to make a test pass.
- [ ] **Step 4: Run them.** `npm test && npm run typecheck` → PASS. The sim suite should run in under 30 s. If it is slower, reduce bot count, not problem count.
- [ ] **Step 5: Update the roadmap.** In `vault/05 Roadmap/Roadmap.md`, mark "Session engine + kid model" as `done`. Add a line under the gantt: "BKT defaults: prior 0.2, learn 0.15, slip 0.1; guess from input (Plan 2)."
- [ ] **Step 6: Commit.** `feat: simulated kids validate placement, step-back, mastery and ~80% target`
