# Plan 1 — Skill Map, Problem Maker and Checker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pure, fully tested TypeScript library holding the v1 skill map (33 skills in 8 clusters), 66 seeded problem templates, and the answer checker with spoken-number parsing.

**Architecture:** Everything lives in `src/domain/` as pure code with no I/O and no AI. One file per skill cluster holds that cluster's skills and templates, since they change together. A curriculum index joins the clusters and exposes lookups that Plan 2 (session engine) consumes. Every template must pass one shared property test, plus its own cluster test that checks the answer against an independent oracle.

**Tech Stack:** TypeScript (strict), Node 26, npm, Vitest, fast-check (only in the RNG test).

**Spec:** `docs/superpowers/specs/2026-10-08-adaptive-tutor-design.md` (this plan implements §5, and the skill/problem parts of §9–§10)

## Plan series (v1)

The spec covers five subsystems. Each one gets its own plan, and each plan ships software that works and is tested on its own. Each plan is written after the one before it is done, so it can build on real interfaces.

| # | Plan | Builds | Decisions it must settle (spec §11) |
|---|---|---|---|
| **1** | **Skill map + problem maker + checker** (this file) | `src/domain/curriculum`, `problems`, `checker` | — |
| 2 | Kid model + session engine | BKT, level, next skill, review, loop guard, placement, Thompson style picker, simulated kids; storage behind an interface (in-memory first) | BKT default parameters |
| 3 | Data + parent side | Next.js app shell, Supabase schema + RLS, email-link sign-up, Stripe consent, kid profiles, persistence adapter for Plan 2, weekly report, distress email, data rights, retention | Email vendor; distress list (with lawyer) |
| 4 | Tutor voice | Turn plan → Claude → guards → canned lines; prompt caching; evals | Character name and look |
| 5 | Kid app + speech | Tablet UI, visuals renderer, tap/pad/voice input, speech proxy, offline/resume, end-to-end tests, playtests | Speech vendor |

## Global Constraints

- TypeScript `strict: true` and `noUncheckedIndexedAccess: true`. No `any` in `src/domain`.
- `src/domain` is pure: no network, no file system, no clock, no `Math.random`. All randomness goes through `createRng(seed)`.
- Same `(seed, level)` gives a deep-equal `Problem` (spec §5).
- Every number a problem uses (answer, choices, mistake answers, numbers in `say`) is an integer from 0 to 100. That is the v1 range: addition and subtraction within 100.
- `Style` is exactly `"number-line" | "blocks" | "ten-frame" | "story" | "drawing"` (spec §5).
- `Problem` has exactly the spec §5 fields: `prompt { say, show }`, `answer`, `input`, `choices?`, `mistakes`.
- `check` returns exactly `correct | known-mistake(tag) | wrong` (spec §5).
- Skill ids are `<cluster-id>.<skill-slug>`, for example `add-within-10.make-ten` (spec §5). They are stored in the database later, so renaming one breaks stored data.
- A skill's `grade` is the grade of its first Common Core code (`K.OA…` → `"K"`, `1.OA…` → `"1"`).
- 25–35 skills in total, with 2–3 templates each (spec §2, §5). This plan makes 33 skills with 2 templates each.
- `prompt.say` has at most 30 words and is read aloud to ages 5–7. Use short words, say "plus" / "minus" / "take away", and leave out the kid's name.
- Equation text uses `+`, `−` (U+2212), `=` and `?`.
- Test first. Every task starts with a failing test.
- Commit messages end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Spoken self-corrections and hedges.** "five… no, six" should give 6. "five or six" should give `null`, so the app can ask again rather than mark the kid wrong. Pinned in Task 3.
2. **Speech-to-text homophones.** A whole answer of "to", "too", "for", "won" or "ate" should read as 2, 4, 1 or 8. Pinned in Task 3.
3. **Answer always in the same tap slot.** If the right answer sits in the same position most of the time, kids learn the position instead of the math. Each slot should hold the answer 15–35% of the time. Pinned in Task 2 and in the property test in Task 4.
4. **Zero answers and tiny answers.** `5 − 5 = 0` must still get 4 distinct, non-negative choices and a valid visual. Pinned in Task 2 (choices) and Task 7 (zero appears at level 2 or above).
5. **Renamed skill ids.** Renaming an id quietly orphans stored attempts. A snapshot of all ids makes any rename a deliberate change. Pinned in Task 12.

---

## File structure

```
package.json, tsconfig.json, vitest.config.ts
src/domain/types.ts                 shared types (Style, Skill, Problem, Visual, MistakeTag, Level, AgeBand, Template, Cluster)
src/domain/rng.ts                   seeded RNG
src/domain/problems/build.ts        buildChoices, cleanMistakes, finalize, adaptInput
src/domain/checker/parseSpoken.ts   parseSpokenNumber
src/domain/checker/check.ts         check
src/domain/curriculum/testkit.ts    test helpers (samples, answerRange, solveEquation)
src/domain/curriculum/index.ts      CLUSTERS, SKILLS, getSkill, getTemplate, generate
src/domain/curriculum/words.ts      story word bank (animals, items → icons)
src/domain/curriculum/<cluster>.ts  one per cluster: skills + templates
src/domain/curriculum/<cluster>.test.ts
src/domain/curriculum/templates.property.test.ts
src/domain/curriculum/skillMap.test.ts
```

Each test file sits next to the code it tests.

---

### Task 1: Scaffold, shared types, seeded RNG

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/domain/types.ts`, `src/domain/rng.ts`
- Test: `src/domain/rng.test.ts`

**Interfaces:**
- Produces, in `src/domain/types.ts`:

```ts
export type Style = "number-line" | "blocks" | "ten-frame" | "story" | "drawing";
export type Grade = "K" | "1" | "2";
export type Level = 1 | 2 | 3;
export const LEVELS: readonly Level[] = [1, 2, 3];
export type AgeBand = "5-7" | "8-11";
export type Icon = "apple" | "star" | "fish" | "ball" | "duck" | "shell" | "block" | "cookie";

export type Visual =
  | { kind: "objects"; icon: Icon; groups: number[]; crossedOut?: number }        // crossedOut = last N of groups[0]
  | { kind: "ten-frames"; first: number; second: number; crossedOut?: number }    // first+second ≤ 20; crossedOut = last N dots
  | { kind: "number-line"; from: number; to: number; marks: number[]; jump?: { from: number; by: number } }
  | { kind: "blocks"; groups: { tens: number; ones: number }[]; crossedOut?: { tens: number; ones: number } }
  | { kind: "equation"; text: string }
  | { kind: "story"; text: string; icon: Icon; groups?: number[] };

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
};
export type Template = { id: string; make: (seed: number, level: Level) => Problem };
export type Skill = {
  id: string; name: string; grade: Grade; commonCore: string[];
  needs: string[]; templates: string[]; styles: Style[];
};
export type Cluster = { id: string; name: string; skills: Skill[]; templates: Template[] };
```

- Produces, in `src/domain/rng.ts`: `type Rng = { int(min: number, max: number): number; pick<T>(xs: readonly T[]): T; shuffle<T>(xs: readonly T[]): T[]; chance(p: number): boolean }` and `createRng(seed: number): Rng`. `int` includes both ends.

- [ ] **Step 1: Scaffold the project**

Write `package.json` with `"type": "module"` and the scripts `"test": "vitest run"` and `"typecheck": "tsc --noEmit"`. Then run `npm i -D typescript vitest fast-check @types/node`. In `tsconfig.json`, set target `ES2023`, module `ESNext`, moduleResolution `Bundler`, `strict`, `noUncheckedIndexedAccess`, `include: ["src"]`. In `vitest.config.ts`, set `test.include: ["src/**/*.test.ts"]`. Write `src/domain/types.ts` exactly as shown above.

- [ ] **Step 2: Write the failing test** in `src/domain/rng.test.ts`

```ts
import fc from "fast-check";
import { createRng } from "./rng";

const draw = (seed: number) => { const r = createRng(seed); return [r.int(0, 100), r.int(0, 100), r.int(0, 100)]; };

it("same seed gives same sequence", () => fc.assert(fc.property(fc.integer(), s => expect(draw(s)).toEqual(draw(s)))));
it("different seeds usually differ", () => expect(draw(1)).not.toEqual(draw(2)));
it("int stays in [min, max] and hits both ends", () => {
  const r = createRng(7); const seen = new Set<number>();
  for (let i = 0; i < 2000; i++) { const v = r.int(3, 6); expect(v).toBeGreaterThanOrEqual(3); expect(v).toBeLessThanOrEqual(6); seen.add(v); }
  expect([...seen].sort()).toEqual([3, 4, 5, 6]);
});
it("normalizes odd seeds", () => {
  expect(draw(-1)).toEqual(draw(4294967295));
  expect(draw(1.9)).toEqual(draw(1));
  expect(draw(2 ** 32 + 5)).toEqual(draw(5));
});
it("shuffle keeps items and does not mutate", () => {
  const xs = [1, 2, 3, 4]; const out = createRng(3).shuffle(xs);
  expect([...out].sort()).toEqual([1, 2, 3, 4]); expect(xs).toEqual([1, 2, 3, 4]);
});
it("int throws when min > max", () => expect(() => createRng(1).int(5, 4)).toThrow());
```

- [ ] **Step 3: Run it.** `npm test -- src/domain/rng.test.ts` → FAIL (module not found).

- [ ] **Step 4: Implement `createRng(seed: number): Rng`.** Use mulberry32 seeded with `Math.trunc(seed) >>> 0`. `shuffle` is a Fisher–Yates shuffle on a copy.

- [ ] **Step 5: Run it.** `npm test -- src/domain/rng.test.ts && npm run typecheck` → PASS, no type errors.

- [ ] **Step 6: Commit.** `git add -A package.json package-lock.json tsconfig.json vitest.config.ts src && git commit -m "feat: scaffold domain library with shared types and seeded RNG"`

---

### Task 2: Problem builders (choices, mistakes, input by age)

**Files:**
- Create: `src/domain/problems/build.ts`
- Test: `src/domain/problems/build.test.ts`

**Interfaces:**
- Consumes: `Rng`, `Problem`, `Mistake`, `Visual`, `AgeBand` (Task 1).
- Produces:
  - `cleanMistakes(answer: number, mistakes: Mistake[]): Mistake[]` drops non-integers, values outside 0–100, and values equal to `answer`. When two mistakes share an answer, the first one listed wins.
  - `buildChoices(rng: Rng, answer: number, wrongPool: number[], count: 2 | 4): number[]` returns `count` distinct integers in 0–100, including `answer`. It fills from `wrongPool` in order (skipping invalid values), then from the nearest unused neighbors `answer±1, ±2, …`, then shuffles with `rng`.
  - `finalize(rng: Rng, p: { say: string; show: Visual; answer: number; mistakes: Mistake[]; choiceCount?: 2 | 4 }): Problem` returns `input: "tap-choice"`, uses `cleanMistakes`, and builds choices with `wrongPool` set to the cleaned mistake answers. `choiceCount` defaults to 4.
  - `adaptInput(p: Problem, band: AgeBand): Problem`. For `"5-7"`, input is `"tap-choice"`. For `"8-11"`, input is `"number-pad"`, unless there are only 2 choices, in which case it stays `"tap-choice"`. Choices are always kept as a fallback. Voice is a parallel channel the UI always offers, so it is not set here.

- [ ] **Step 1: Write the failing test** in `src/domain/problems/build.test.ts`

```ts
it("cleanMistakes drops answer, out-of-range, duplicates (first wins)", () => {
  expect(cleanMistakes(5, [
    { answer: 5, tag: "off-by-one-counting" }, { answer: -1, tag: "subtracted-instead" },
    { answer: 101, tag: "added-instead" }, { answer: 6, tag: "used-double" }, { answer: 6, tag: "off-by-one-counting" },
  ])).toEqual([{ answer: 6, tag: "used-double" }]);
});
it("buildChoices: distinct, in range, includes answer, prefers pool", () => {
  const c = buildChoices(createRng(1), 7, [8, 3, 3, 200], 4);
  expect(new Set(c).size).toBe(4); expect(c).toContain(7); expect(c).toContain(8); expect(c).toContain(3);
});
it("buildChoices works for answer 0 and 100", () => {
  for (const a of [0, 100]) { const c = buildChoices(createRng(2), a, [], 4);
    expect(new Set(c).size).toBe(4); expect(c.every(n => n >= 0 && n <= 100)).toBe(true); expect(c).toContain(a); }
});
it("answer slot is spread out (Review Focus 3)", () => {
  const slot = [0, 0, 0, 0];
  for (let s = 0; s < 1000; s++) slot[buildChoices(createRng(s), 10, [9, 11, 12], 4).indexOf(10)]!++;
  for (const n of slot) { expect(n).toBeGreaterThan(150); expect(n).toBeLessThan(350); }
});
it("adaptInput by age band", () => {
  const p = finalize(createRng(1), { say: "x", show: { kind: "equation", text: "2 + 2 = ?" }, answer: 4, mistakes: [] });
  expect(adaptInput(p, "5-7").input).toBe("tap-choice");
  expect(adaptInput(p, "8-11").input).toBe("number-pad");
  const two = finalize(createRng(1), { say: "x", show: p.prompt.show, answer: 4, mistakes: [{ answer: 3, tag: "picked-other" }], choiceCount: 2 });
  expect(adaptInput(two, "8-11").input).toBe("tap-choice");
});
```

- [ ] **Step 2: Run it.** `npm test -- src/domain/problems` → FAIL.
- [ ] **Step 3: Implement the four functions** in `src/domain/problems/build.ts`.
- [ ] **Step 4: Run it.** `npm test -- src/domain/problems && npm run typecheck` → PASS.
- [ ] **Step 5: Commit.** `git add src/domain/problems && git commit -m "feat: problem builders for choices, mistakes and input by age"`

---

### Task 3: Checker and spoken-number parser

**Files:**
- Create: `src/domain/checker/parseSpoken.ts`, `src/domain/checker/check.ts`
- Test: `src/domain/checker/parseSpoken.test.ts`, `src/domain/checker/check.test.ts`

**Interfaces:**
- Produces:
  - `parseSpokenNumber(text: string): number | null`
  - `type CheckResult = { kind: "correct" } | { kind: "known-mistake"; tag: MistakeTag } | { kind: "wrong" }`
  - `check(problem: Problem, given: number): CheckResult`

Parsing approach: lowercase the text, strip punctuation, and split hyphens. Map number words and digits to tokens, treat "and" directly after "hundred" as part of the number, and ignore all other words. Then apply these rules in order:
1. If a correction marker appears (`no`, `wait`, `actually`, `i mean`), use only the text after the last one.
2. If `or` sits between two numbers, return `null`.
3. A run of single digits with nothing else in it, at most 2 digits long ("one two", "2 3"), joins into one number.
4. If two or more separate numbers remain, return `null`.

- [ ] **Step 1: Write the failing tests**

```ts
// parseSpoken.test.ts
it.each([
  ["12", 12], ["twelve", 12], ["Twelve.", 12], ["twenty-three", 23], ["twenty three", 23],
  ["seventeen", 17], ["seventy", 70], ["one hundred", 100], ["a hundred", 100], ["hundred", 100],
  ["zero", 0], ["none", 0], ["nothing", 0], ["it's 7", 7], ["um, seven", 7], ["I think it's seven", 7],
  ["one two", 12], ["2 3", 23], ["a hundred and five", 105],
  ["five, no, six", 6], ["five wait six", 6], ["four actually five", 5], ["three I mean four", 4],
  ["to", 2], ["too", 2], ["for", 4], ["won", 1], ["ate", 8],
])("%s → %s", (text, n) => expect(parseSpokenNumber(text)).toBe(n));
it.each(["", "I don't know", "five or six", "five and six", "banana", "I want to go"])(
  "%s → null", text => expect(parseSpokenNumber(text)).toBeNull());

// check.test.ts
const p: Problem = { prompt: { say: "8 plus 5", show: { kind: "equation", text: "8 + 5 = ?" } }, answer: 13,
  input: "tap-choice", choices: [12, 13, 14, 3], mistakes: [{ answer: 12, tag: "off-by-one-counting" }, { answer: 3, tag: "subtracted-instead" }] };
it("correct", () => expect(check(p, 13)).toEqual({ kind: "correct" }));
it("known mistake", () => expect(check(p, 3)).toEqual({ kind: "known-mistake", tag: "subtracted-instead" }));
it("wrong", () => expect(check(p, 40)).toEqual({ kind: "wrong" }));
```

The homophone cases ("to", "too", "for", "won", "ate") count only when they are the whole utterance after filler words are removed. That is why "I want to go" → `null`.

- [ ] **Step 2: Run them.** `npm test -- src/domain/checker` → FAIL.
- [ ] **Step 3: Implement `parseSpokenNumber` and `check`.**
- [ ] **Step 4: Run them.** `npm test -- src/domain/checker && npm run typecheck` → PASS.
- [ ] **Step 5: Commit.** `feat: answer checker and spoken-number parser`

---

### Task 4: Curriculum framework + cluster `count-to-20`

**Files:**
- Create: `src/domain/curriculum/index.ts`, `testkit.ts`, `words.ts`, `count-to-20.ts`
- Test: `src/domain/curriculum/templates.property.test.ts`, `skillMap.test.ts`, `count-to-20.test.ts`

**Interfaces:**
- Consumes: `finalize` (Task 2), `createRng` (Task 1).
- Produces, in `index.ts`: `CLUSTERS: Cluster[]` (in the order the tasks add them), `SKILLS: Skill[]`, `getSkill(id: string): Skill` and `getTemplate(id: string): Template` (both throw on an unknown id), and `generate(templateId: string, seed: number, level: Level): Problem`.
- Produces, in `testkit.ts`: `tpl(id)` (alias of `getTemplate`), `samples(t: Template, level: Level, n = 1000): Problem[]` (seeds 0…n−1), `answerRange(t, level): [number, number]`, `solveEquation(text: string): number` (solves `a + b = ?`, `a − b = ?`, `a + ? = c`, `? + b = c`, `a − ? = c` and `? − b = c`, accepting `-` or `−`), and `sayNumbers(say: string): number[]`.
- Produces, in `words.ts`: `ANIMALS = ["Fox", "Bear", "Owl", "Frog", "Duck", "Rabbit"]` and `ITEMS: { word: string; icon: Icon }[]` = apples/apple, stars/star, fish/fish, balls/ball, shells/shell, blocks/block, cookies/cookie.

**Rules for every cluster in Tasks 4–11:**
- Each template is a factory call that returns `Template`. Factories may be shared inside a cluster file.
- **Picture fading:** level 1 and level 2 show the listed picture, and level 3 shows `equation`. The exception is a template marked *fixed*, where the picture is the question itself and stays at every level.
- **Level-3 equation:** unless a row says otherwise, it is the operation written out: `"{a} + {b} = ?"` or `"{a} − {b} = ?"`, using the say's numbers in order.
- **Ranges:** the column `L1 / L2 / L3` gives the exact range of the **answer** at each level, unless the column says otherwise. With 1,000 seeds, the observed min and max must equal these numbers.
- **Mistakes** are listed in priority order. For example, `±1 off-by-one-counting` means `answer+1` and `answer−1`, both tagged `off-by-one-counting`.
- `{icon}` is a random `ITEMS` word, and the visual's icon matches it.

**Cluster `count-to-20`** (name "Count to 20"):

| Skill id | Name | CC | Needs | Styles | Templates |
|---|---|---|---|---|---|
| `count-to-20.objects-to-10` | Count to 10 | K.CC.B.5 | — | drawing, ten-frame, blocks | `count-objects-10`, `count-ten-frame-10` |
| `count-to-20.objects-to-20` | Count to 20 | K.CC.B.5 | `.objects-to-10` | ten-frame, blocks, drawing | `count-objects-20`, `count-ten-frame-20` |
| `count-to-20.number-after` | What comes next | K.CC.A.2 | `.objects-to-10` | number-line, drawing | `number-after`, `count-sequence` |

| Template | Say | Show | Answer | L1 / L2 / L3 | Mistakes |
|---|---|---|---|---|---|
| `count-objects-10` / `-20` | "How many {icon}?" | objects `[n]`, *fixed* | n | 10: 1–5 / 3–8 / 5–10; 20: 10–13 / 11–16 / 11–20 | ±1 off-by-one-counting |
| `count-ten-frame-10` / `-20` | "How many dots?" | ten-frames `first=n, second=0`, *fixed* | n | same as above | ±1 off-by-one-counting |
| `number-after` | "What number comes after {n}?" | number-line `max(0,n−3)…n+3`, marks `[n]`, *fixed* | n+1 | 2–6 / 2–10 / 2–20 | n repeated-number, n−1 counted-back |
| `count-sequence` | "{a}, {a+1}, {a+2}. What comes next?" | number-line `a…a+5`, marks `[a,a+1,a+2]`, *fixed* | a+3 | 4–7 / 4–12 / 4–20 | a+2 repeated-number, a+4 skipped-number |

- [ ] **Step 1: Write `testkit.ts`, then the failing tests.**

`templates.property.test.ts` runs over every template in `CLUSTERS`, at every level, for 1,000 seeds:

```ts
const all = CLUSTERS.flatMap(c => c.templates);
it("has templates", () => expect(all.length).toBeGreaterThan(0));
describe.each(all.map(t => [t.id, t] as const))("%s", (_id, t) => {
  it.each(LEVELS.map(l => [l]))("level %i invariants", lv => {
    const slot = [0, 0, 0, 0];
    for (let s = 0; s < 1000; s++) {
      const p = t.make(s, lv);
      expect(t.make(s, lv)).toEqual(p);                                   // deterministic
      const nums = [p.answer, ...(p.choices ?? []), ...p.mistakes.map(m => m.answer), ...sayNumbers(p.prompt.say)];
      for (const n of nums) { expect(Number.isInteger(n)).toBe(true); expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThanOrEqual(100); }
      expect(p.input).toBe("tap-choice");
      expect([2, 4]).toContain(p.choices!.length);
      expect(new Set(p.choices).size).toBe(p.choices!.length);
      expect(p.choices).toContain(p.answer);
      expect(p.mistakes.every(m => m.answer !== p.answer && MISTAKE_TAGS.includes(m.tag))).toBe(true);
      expect(new Set(p.mistakes.map(m => m.answer)).size).toBe(p.mistakes.length);
      expect(p.prompt.say.split(/\s+/).length).toBeLessThanOrEqual(30);
      expect(validVisual(p.prompt.show)).toBe(true);
      if (lv === 3 && p.prompt.show.kind === "equation" && p.prompt.show.text.includes("="))
        expect(solveEquation(p.prompt.show.text)).toBe(p.answer);
      if (p.choices!.length === 4) slot[p.choices!.indexOf(p.answer)]!++;
    }
    if (slot.some(n => n > 0)) for (const n of slot) expect(n).toBeLessThan(350);   // Review Focus 3
  });
});
```

`validVisual` is defined in that file. It requires integers everywhere. Objects need groups of 0–20 and `crossedOut` ≤ `groups[0]`. Ten-frames need `first+second ≤ 20` and `crossedOut ≤ first+second`. A number line needs `from < to` and every mark and jump endpoint inside it. Blocks need tens 0–10 and ones 0–9 per group. Equation and story text must be non-empty.

`skillMap.test.ts`:
- skill ids are unique;
- each id starts with its cluster id plus `.`;
- every `needs` entry exists;
- the needs graph has no cycles (depth-first search);
- every `templates` id resolves through `getTemplate`;
- each template belongs to exactly one skill;
- `styles.length >= 2`;
- `grade === commonCore[0][0]`;
- `templates.length` is between 2 and 3.

`count-to-20.test.ts` checks the ranges with `it.each` over the table rows, using `answerRange`. It runs these oracles over `samples`:
- `count-objects-*`: `answer === groups[0]`, and the kind is `objects` at all levels;
- `count-ten-frame-*`: `answer === first`;
- `number-after`: `answer === sayNumbers(say)[0] + 1`;
- `count-sequence`: `answer === sayNumbers(say)[2] + 1`.

It also spot-checks one known mistake per template: `number-after` has a mistake `{answer: n, tag: "repeated-number"}`.

- [ ] **Step 2: Run them.** `npm test -- src/domain/curriculum` → FAIL.
- [ ] **Step 3: Implement `index.ts`, `words.ts` and `count-to-20.ts`.** `generate` is `getTemplate(id).make(seed, level)`.
- [ ] **Step 4: Run them.** `npm test && npm run typecheck` → PASS.
- [ ] **Step 5: Commit.** `feat: curriculum framework, property tests and count-to-20 cluster`

---

### Tasks 5–11: one cluster each

Each of Tasks 5–11 follows the same five steps:
1. Write `src/domain/curriculum/<cluster>.test.ts` (answer ranges per level from the table, the oracle listed, the show kind per level, and one known-mistake spot check per template).
2. Run it and see it FAIL.
3. Write `src/domain/curriculum/<cluster>.ts` and register it in `CLUSTERS`.
4. Run `npm test && npm run typecheck` and get PASS. The property test and skill-map test pick up the new cluster automatically.
5. Commit with `feat: <cluster> cluster`.

**Oracle default:** at level 3, the equation solves to the answer (the property test already checks this). Each cluster test also checks one oracle at L1 or L2, listed under each table. **Needs** are shortened: `.x` means a skill in the same cluster.

### Task 5: Cluster `compare-numbers` ("Compare numbers")

| Skill id | Name | CC | Needs | Styles | Templates |
|---|---|---|---|---|---|
| `compare-numbers.groups` | More or fewer | K.CC.C.6 | `count-to-20.objects-to-10` | drawing, blocks, ten-frame | `compare-groups-more`, `compare-groups-fewer` |
| `compare-numbers.to-10` | Bigger or smaller to 10 | K.CC.C.7 | `.groups` | number-line, blocks | `compare-bigger-10`, `compare-smaller-10` |
| `compare-numbers.to-20` | Bigger or smaller to 20 | K.CC.C.7 | `.to-10`, `count-to-20.objects-to-20` | number-line, blocks | `compare-bigger-20`, `compare-smaller-20` |

Every template uses `choiceCount: 2`, with choices `{x, y}`, `x ≠ y`, and the single mistake `other number → picked-other`.

| Template | Say | Show | Answer | Operand rule L1 / L2 / L3 |
|---|---|---|---|---|
| `compare-groups-more` / `-fewer` | "Which group has more?" / "…fewer?" | objects `[x, y]`, *fixed* | max / min | x,y in 1–5 with \|x−y\|≥2 / 1–8, ≥1 / 1–10, ≥1 |
| `compare-bigger-N` / `compare-smaller-N` (N = 10, 20) | "Which is bigger, {x} or {y}?" / "…smaller…" | number-line `0…N`, marks `[x, y]` | max / min | x,y in 0–N with \|x−y\| ≥ 5 / ≥ 2 / ≥ 1 |

At level 3 the show is the equation `"{x} or {y}?"`. It has no `=`, so the property test skips the solve check. Oracle: the answer is the max (or min) of `groups`, or of `marks`.

### Task 6: Cluster `add-within-10` ("Add within 10")

| Skill id | Name | CC | Needs | Styles | Templates |
|---|---|---|---|---|---|
| `add-within-10.pictures` | Add with pictures | K.OA.A.1 | `count-to-20.objects-to-10` | drawing, blocks, ten-frame, story | `add-objects-10`, `add-ten-frame-10` |
| `add-within-10.within-5` | Add within 5 | K.OA.A.5 | `.pictures` | number-line, blocks, drawing | `add-facts-5`, `add-line-5` |
| `add-within-10.count-on` | Count on | 1.OA.C.5 | `.within-5`, `count-to-20.number-after` | number-line, blocks | `count-on-bigger-first`, `count-on-smaller-first` |
| `add-within-10.make-ten` | Make 10 | K.OA.A.4 | `.within-5` | ten-frame, blocks, number-line | `make-ten-frame`, `make-ten-bond` |
| `add-within-10.missing` | Missing number | 1.OA.D.8 | `.make-ten` | blocks, number-line, story | `missing-addend`, `missing-first` |

| Template | Say | Show (L1/L2) | Answer | L1 / L2 / L3 | Mistakes |
|---|---|---|---|---|---|
| `add-objects-10` | "{a} {icon} and {b} more. How many in all?" | objects `[a,b]`, *fixed* | a+b | 2–5 / 2–8 / 2–10 (a,b≥1) | ±1 off-by-one-counting, \|a−b\| subtracted-instead |
| `add-ten-frame-10` | "How many dots in all?" | ten-frames `a,b`, *fixed* | a+b | same | same |
| `add-facts-5` | "What is {a} plus {b}?" | objects `[a,b]` | a+b | 2–5 (a,b≥1) / 0–5 / 0–5 | same |
| `add-line-5` | "Start at {a}. Jump {b}. Where do you land?" | number-line `0…5`, jump `{from:a, by:b}` | a+b | same as `add-facts-5` | same |
| `count-on-bigger-first` | "Start at {a}. Count on {b}." | number-line `0…10`, jump | a+b | a≥b, b in 1–3, sum 4–7 / 4–9 / 4–10 | ±1 off-by-one-counting |
| `count-on-smaller-first` | "What is {a} plus {b}?" | number-line `0…10`, jump `{from:b, by:a}` | a+b | a<b, a in 1–3, sums as above | same |
| `make-ten-frame` | "{a} dots. How many more make 10?" | ten-frames `a,0`, *fixed* | 10−a | a: 5–9 / 3–9 / 1–9 | 10−a ±1 off-by-one-counting, a gave-part, 10 gave-total |
| `make-ten-bond` | "{a} plus what makes 10?" | objects `[a]` | 10−a | same | same |
| `missing-addend` | "{a} plus what makes {c}?" | number-line `0…c`, marks `[a,c]` | c−a | c ≤ 5 / ≤ 8 / ≤ 10; a ≥ 1, answer ≥ 1 | a+c added-instead, c gave-total, a gave-part, ±1 off-by-one-counting |
| `missing-first` | "What plus {b} makes {c}?" | number-line `0…c`, marks `[b,c]` | c−b | same | b+c added-instead, c gave-total, b gave-part, ±1 |

In the `missing-*` rows, the L1 / L2 / L3 column gives the bound on `c`, and the answer is at least 1. Oracle: `objects` answers equal `sum(groups)`, and `make-ten` gives `answer + a === 10`. At level 3, the equations are `"{a} + {b} = ?"`, `"{a} + ? = 10"`, `"{a} + ? = {c}"` and `"? + {b} = {c}"`.

### Task 7: Cluster `subtract-within-10` ("Subtract within 10")

| Skill id | Name | CC | Needs | Styles | Templates |
|---|---|---|---|---|---|
| `subtract-within-10.pictures` | Take away with pictures | K.OA.A.1 | `count-to-20.objects-to-10` | drawing, blocks, story | `sub-objects-10`, `sub-ten-frame-10` |
| `subtract-within-10.within-5` | Subtract within 5 | K.OA.A.5 | `.pictures` | number-line, blocks, drawing | `sub-facts-5`, `sub-line-5` |
| `subtract-within-10.within-10` | Subtract within 10 | K.OA.A.5 | `.within-5` | number-line, blocks, ten-frame | `sub-facts-10`, `sub-count-back` |
| `subtract-within-10.break-apart` | Break apart | K.OA.A.3 | `.within-10`, `add-within-10.within-5` | blocks, ten-frame, drawing | `break-apart`, `break-apart-frame` |

| Template | Say | Show (L1/L2) | Answer | Start number a: L1 / L2 / L3 | Mistakes |
|---|---|---|---|---|---|
| `sub-objects-10` | "{a} {icon}. {b} go away. How many are left?" | objects `[a]`, crossedOut b, *fixed* | a−b | 2–5 / 2–8 / 2–10 | ±1 off-by-one-counting, a+b added-instead, a gave-part |
| `sub-ten-frame-10` | "{a} dots. Take away {b}. How many are left?" | ten-frames `a,0`, crossedOut b, *fixed* | a−b | same | same |
| `sub-facts-5` | "What is {a} minus {b}?" | objects `[a]`, crossedOut b | a−b | 2–5 / 1–5 / 1–5 | same |
| `sub-line-5` | "Start at {a}. Jump back {b}." | number-line `0…5`, jump `{from:a, by:−b}` | a−b | same as `sub-facts-5` | same |
| `sub-facts-10` | "What is {a} minus {b}?" | ten-frames `a,0`, crossedOut b | a−b | 3–7 / 2–10 / 2–10 | same |
| `sub-count-back` | "Start at {a}. Count back {b}." | number-line `0…10`, jump | a−b | b in 1–3; a: 4–7 / 4–10 / 4–10 | ±1 off-by-one-counting |
| `break-apart` | "{c} is {a} and how many more?" | objects `[a, c−a]` with the 2nd group hidden → draw objects `[c]` | c−a | c: 2–5 / 2–8 / 2–10; a in 1…c−1 | c gave-total, a gave-part, c+a added-instead, ±1 |
| `break-apart-frame` | same | ten-frames `a,0` | c−a | same | same |

For `break-apart` at L1/L2, the show is objects `[c]`, so the kid sees the whole amount. At level 3 the equation is `"{a} + ? = {c}"`. For the `sub-*` templates, the bound is b ≥ 1. At L1 the answer is at least 1. At L2 and L3 the answer may be 0.

Oracle: for `objects` with `crossedOut`, `answer === groups[0] − crossedOut`. **Review Focus 4 test:** across 1,000 seeds at level 2, `sub-facts-10` produces at least one answer of 0, and those problems still pass `validVisual` and have 4 distinct choices.

### Task 8: Cluster `add-subtract-within-20` ("Add and subtract within 20")

| Skill id | Name | CC | Needs | Styles | Templates |
|---|---|---|---|---|---|
| `add-subtract-within-20.doubles` | Doubles and near doubles | 1.OA.C.6 | `add-within-10.count-on` | blocks, ten-frame, drawing | `doubles`, `near-doubles` |
| `add-subtract-within-20.make-ten` | Add by making 10 | 1.OA.C.6 | `add-within-10.make-ten` | ten-frame, blocks, number-line | `add-over-ten-frame`, `add-over-ten` |
| `add-subtract-within-20.subtract` | Subtract within 20 | 1.OA.C.6 | `subtract-within-10.within-10` | number-line, ten-frame, blocks | `sub-teen-no-cross`, `sub-across-ten` |
| `add-subtract-within-20.related-facts` | Related facts | 1.OA.B.4 | `.make-ten`, `.subtract` | blocks, number-line, story | `think-addition`, `fact-family` |

| Template | Say | Show (L1/L2) | Answer | L1 / L2 / L3 | Mistakes |
|---|---|---|---|---|---|
| `doubles` | "What is {a} plus {a}?" | ten-frames `a,a` | 2a | a: 1–5 / 1–7 / 1–10 | ±1 off-by-one-counting |
| `near-doubles` | "What is {a} plus {a+1}?" | ten-frames `a,a+1` | 2a+1 | a: 1–4 / 1–6 / 1–9 | 2a used-double, 2a+2 off-by-one-counting |
| `add-over-ten-frame` | "What is {a} plus {b}?" | ten-frames `a,b` | a+b | a 6–9, b ≤ 9; sum 11–13 / 11–16 / 11–18 | a+b−10 forgot-the-ten, ±1 off-by-one-counting |
| `add-over-ten` | "Start at {a}. Jump {b}." | number-line `0…20`, jump | a+b | same | same |
| `sub-teen-no-cross` | "What is {a} minus {b}?" | L1 ten-frames `10,a−10` crossedOut b; L2 number-line `0…20` jump | a−b | a 11–19, b 1…a−10; answer 10–18 at all levels | ±1, a+b added-instead |
| `sub-across-ten` | "What is {a} minus {b}?" | same as above | a−b | a 11–18, b ≤ 9, answer ≤ 9; answer 2–9 at all levels | 10+\|a mod 10 − b\| subtracted-smaller-digit, ±1, a+b added-instead |
| `think-addition` | "{c} minus {b}. Think: {b} plus what makes {c}?" | number-line `0…c`, marks `[b,c]` | c−b | c ≤ 12 / ≤ 15 / ≤ 18; b in 3–9; answer ≤ 9 | c gave-total, b gave-part, c+b added-instead, ±1 |
| `fact-family` | "{a} plus {b} is {c}. So {c} minus {a} is?" | number-line `0…c`, marks `[a,c]` | b | same bounds on c | c gave-total, a gave-part, ±1 |

For `sub-teen-no-cross` and `sub-across-ten`, the L1 ten-frames are `first = 10`, `second = a−10`, with `crossedOut = b` (the last b dots). Oracle: `doubles` gives `answer === first + second`. `sub-across-ten` always has `a mod 10 < b`.

### Task 9: Cluster `place-value` ("Place value - tens and ones")

| Skill id | Name | CC | Needs | Styles | Templates |
|---|---|---|---|---|---|
| `place-value.teens` | Teen numbers | K.NBT.A.1 | `count-to-20.objects-to-20` | blocks, ten-frame | `teen-blocks`, `teen-split` |
| `place-value.tens-ones` | Tens and ones | 1.NBT.B.2 | `.teens`, `compare-numbers.to-20` | blocks, drawing | `blocks-to-number`, `tens-in-number` |
| `place-value.compare` | Compare two-digit numbers | 1.NBT.B.3 | `.tens-ones` | blocks, number-line | `compare-bigger-100`, `compare-smaller-100` |
| `place-value.ten-more-less` | 10 more, 10 less | 1.NBT.C.5 | `.tens-ones` | blocks, number-line | `ten-more`, `ten-less` |

| Template | Say | Show | Answer | L1 / L2 / L3 | Mistakes |
|---|---|---|---|---|---|
| `teen-blocks` | "One ten and {o} ones. What number is it?" | blocks `[{1,o}]`, *fixed* | 10+o | 11–14 / 11–17 / 11–19 | 1+o added-digits, o counted-ones-only, ±1 off-by-one-counting |
| `teen-split` | "{n} is 10 and how many ones?" | L1 blocks `[{1,n−10}]`, L2 ten-frames `10,n−10` | n−10 | n: 11–14 / 11–17 / 11–19 | n gave-total, 10 gave-part, ±1 |
| `blocks-to-number` | "{t} tens and {o} ones. What number is it?" | blocks `[{t,o}]`, *fixed* | 10t+o | 20–49 / 20–79 / 20–99 | 10o+t swapped-digits (only when o≥1 and o≠t), t+o added-digits, ±10 off-by-ten, ±1 off-by-one-counting |
| `tens-in-number` | "How many tens are in {n}?" | blocks `[{t,o}]`; L3 equation `"{n}"` | t | n: 20–49 / 20–79 / 20–99 | o picked-ones-digit (when o≠t) |
| `compare-bigger-100` / `-smaller-100` | "Which is bigger, {x} or {y}?" / "…smaller…" | number-line `0…100`, marks `[x,y]`; L3 equation `"{x} or {y}?"` | max / min | x,y in 10–99: L1 different tens, \|x−y\| ≥ 10; L2 \|x−y\| ≥ 3; L3 same tens, or swapped digits (47 vs 74) | other picked-other; `choiceCount: 2` |
| `ten-more` | "What is 10 more than {n}?" | blocks `[{t,o}]` | n+10 | n: multiples of 10 in 10–80 / 10–59 / 10–89 | n+1 added-one, n−10 subtracted-instead |
| `ten-less` | "What is 10 less than {n}?" | blocks `[{t,o}]` | n−10 | n: multiples of 10 in 20–90 / 20–69 / 20–99 | n−1 subtracted-one, n+10 added-instead |

For `ten-more` and `ten-less`, the range column is the range of `n`, not of the answer. In that column, L1 is multiples of 10 only, and L2 and L3 can have any ones digit. At level 3 their equations are `"{n} + 10 = ?"` and `"{n} − 10 = ?"`. Oracle: blocks give `answer === 10*tens + ones`.

### Task 10: Cluster `add-subtract-within-100` ("Add and subtract within 100")

Picture fading in this cluster: L1 blocks (2 groups for addition, 1 group with `crossedOut` for subtraction), L2 number-line `0…100` with a jump, L3 equation.

| Skill id | Name | CC | Needs | Styles | Templates |
|---|---|---|---|---|---|
| `add-subtract-within-100.tens` | Add and subtract tens | 1.NBT.C.4 | `place-value.ten-more-less` | blocks, number-line | `add-tens`, `sub-tens` |
| `add-subtract-within-100.add` | Add without regrouping | 2.NBT.B.5 | `.tens`, `add-subtract-within-20.make-ten` | blocks, number-line | `add-2d-1d`, `add-2d-2d` |
| `add-subtract-within-100.add-regroup` | Add with regrouping | 2.NBT.B.5 | `.add` | blocks, number-line | `add-2d-1d-regroup`, `add-2d-2d-regroup` |
| `add-subtract-within-100.subtract` | Subtract without regrouping | 2.NBT.B.5 | `.tens`, `add-subtract-within-20.subtract` | blocks, number-line | `sub-2d-1d`, `sub-2d-2d` |
| `add-subtract-within-100.subtract-regroup` | Subtract with regrouping | 2.NBT.B.5 | `.subtract` | blocks, number-line | `sub-2d-1d-regroup`, `sub-2d-2d-regroup` |

Every say is `"What is {a} plus {b}?"` or `"What is {a} minus {b}?"`.

| Template | Rule | Answer L1 / L2 / L3 | Mistakes |
|---|---|---|---|
| `add-tens` | a, b multiples of 10, ≥ 10 | sum ≤ 50 / ≤ 80 / ≤ 100 | sum/10 dropped-zero, ±10 off-by-ten |
| `sub-tens` | a, b multiples of 10, b < a | a ≤ 50 / ≤ 80 / ≤ 100 (answer ≥ 10) | diff/10 dropped-zero, a+b added-instead, ±10 off-by-ten |
| `add-2d-1d` | a 2-digit, b 1–9, ones(a)+b ≤ 9 | sum ≤ 49 / ≤ 79 / ≤ 99 | a+10b added-to-tens, ±1 off-by-one-counting, ±10 off-by-ten |
| `add-2d-2d` | both 10–89, ones sum ≤ 9 | sum ≤ 59 / ≤ 79 / ≤ 99 | ±10 off-by-ten, ±1 off-by-one-counting |
| `add-2d-1d-regroup` | a 2-digit, b 2–9, ones(a)+b ≥ 10 | sum ≤ 59 / ≤ 79 / ≤ 99 | sum−10 forgot-to-regroup, ±1 off-by-one-counting |
| `add-2d-2d-regroup` | both 11–88, ones sum ≥ 10 | sum ≤ 59 / ≤ 79 / ≤ 99 | sum−10 forgot-to-regroup, ±1, +10 off-by-ten |
| `sub-2d-1d` | a 2-digit, b 1–9, ones(a) ≥ b | a ≤ 49 / ≤ 79 / ≤ 99 | a+b added-instead, ±1 off-by-one-counting, −10 off-by-ten |
| `sub-2d-2d` | ones(a) ≥ ones(b), b ≥ 10, answer ≥ 1 | a ≤ 59 / ≤ 79 / ≤ 99 | ±10 off-by-ten, ±1 off-by-one-counting |
| `sub-2d-1d-regroup` | a 2-digit, b 2–9, ones(a) < b | a ≤ 49 / ≤ 79 / ≤ 99 | answer+10 forgot-to-regroup, 10·tens(a)+(b−ones(a)) subtracted-smaller-digit, ±1 |
| `sub-2d-2d-regroup` | ones(a) < ones(b), b ≥ 11, answer ≥ 1 | a ≤ 59 / ≤ 79 / ≤ 99 | answer+10 forgot-to-regroup, 10·(tens(a)−tens(b))+(ones(b)−ones(a)) subtracted-smaller-digit, ±1 |

The answer-range column gives the upper bound (≤) on the sum for addition and on `a` for subtraction. The cluster test asserts that the observed max equals that bound. Oracle at L1: addition gives `answer === Σ(10·tens+ones)` over the groups, and subtraction gives the group value minus `crossedOut`. Spot check: `add-2d-2d-regroup` with 38+27 lists the mistake `{55, forgot-to-regroup}`. Find a seed that produces it, or test the factory's mistake function directly.

### Task 11: Cluster `word-problems` ("Word problems")

Show: `story` with `text = say`, and `icon` from the chosen item. `groups` is set at L1 only, and only when every number ≤ 20. There is no equation at L3: stories stay stories, and the numbers just get bigger. `{A}` and `{B}` are distinct `ANIMALS`, and `{items}` is an `ITEMS` word.

| Skill id | Name | CC | Needs | Styles | Templates |
|---|---|---|---|---|---|
| `word-problems.add` | Adding stories | 1.OA.A.1 | `add-subtract-within-20.make-ten` | story, drawing, blocks | `story-add-to`, `story-put-together` |
| `word-problems.subtract` | Taking-away stories | 1.OA.A.1 | `add-subtract-within-20.subtract` | story, drawing, number-line | `story-take-from`, `story-take-apart` |
| `word-problems.compare` | How many more | 1.OA.A.1 | `.add`, `.subtract` | story, number-line, blocks | `story-how-many-more`, `story-how-many-fewer` |
| `word-problems.to-100` | Stories to 100 | 2.OA.A.1 | `.add`, `.subtract`, `add-subtract-within-100.add-regroup`, `add-subtract-within-100.subtract-regroup` | story, blocks, number-line | `story-add-100`, `story-sub-100` |
| `word-problems.two-step` | Two-step stories | 2.OA.A.1 | `.compare`, `.to-100` | story, number-line, blocks | `story-two-step-add-sub`, `story-two-step-add-add` |

| Template | Say | Answer | L1 / L2 / L3 | Mistakes |
|---|---|---|---|---|
| `story-add-to` | "{A} has {a} {items}. {A} gets {b} more. How many {items} now?" | a+b | ≤ 10 / ≤ 15 / ≤ 20 | \|a−b\| wrong-operation, ±1 off-by-one-counting |
| `story-put-together` | "{A} has {a} {items}. {B} has {b}. How many {items} in all?" | a+b | same | same |
| `story-take-from` | "{A} has {a} {items}. {A} gives {b} away. How many are left?" | a−b | a ≤ 10 / ≤ 15 / ≤ 20 | a+b wrong-operation, a gave-part, ±1 |
| `story-take-apart` | "{A} has {c} {items}. {a} are red. The rest are blue. How many are blue?" | c−a | c ≤ 10 / ≤ 15 / ≤ 20 | c+a wrong-operation, c gave-total, ±1 |
| `story-how-many-more` | "{A} has {x} {items}. {B} has {y}. How many more does {A} have?" | x−y | x ≤ 10 / ≤ 15 / ≤ 20, x > y | x+y wrong-operation, x gave-part, ±1 |
| `story-how-many-fewer` | "…How many fewer does {B} have?" | x−y | same | same |
| `story-add-100` | as `story-add-to` | a+b | 21–50 / 21–80 / 21–100 | \|a−b\| wrong-operation, sum−10 forgot-to-regroup, ±10 off-by-ten |
| `story-sub-100` | as `story-take-from` | a−b | a in 21–50 / 21–80 / 21–100 | a+b wrong-operation, answer+10 forgot-to-regroup, ±10 off-by-ten |
| `story-two-step-add-sub` | "{A} has {a} {items}. {A} gets {b} more, then gives {c} away. How many now?" | a+b−c | a+b ≤ 20 / ≤ 50 / ≤ 100; answer ≥ 1 | a+b stopped-after-one-step, a+b+c wrong-operation, ±1 |
| `story-two-step-add-add` | "{A} has {a} {items}. {B} gives {b}. {C} gives {c}. How many now?" | a+b+c | total ≤ 20 / ≤ 50 / ≤ 100 | a+b stopped-after-one-step, ±1 |

In the `story-two-step-add-add` say, `{C}` is a third distinct animal. The range column bounds the **answer** for `add-*`, the start number for `sub`/`take-from`/`take-apart`/`how-many`, and `a+b` for `add-sub`. The test asserts that the observed max equals each bound. Oracle: `sayNumbers(say)` gives the operands in story order, and the cluster test recomputes the answer from them per template.

---

### Task 12: Whole-map checks and vault update

**Files:**
- Modify: `src/domain/curriculum/skillMap.test.ts`
- Create: `src/domain/curriculum/__snapshots__/` (made by Vitest)
- Modify: the 8 cluster notes in `vault/04 Skills/` and `vault/05 Roadmap/Roadmap.md`

- [ ] **Step 1: Add the failing tests** to `skillMap.test.ts`

```ts
it("skill count within spec (25–35)", () => { expect(SKILLS.length).toBeGreaterThanOrEqual(25); expect(SKILLS.length).toBeLessThanOrEqual(35); });
it("8 clusters in spec order", () => expect(CLUSTERS.map(c => c.id)).toEqual([
  "count-to-20", "compare-numbers", "add-within-10", "subtract-within-10",
  "add-subtract-within-20", "place-value", "add-subtract-within-100", "word-problems"]));
it.each([  // spec §5 cluster prerequisites: some skill in `to` needs (directly or transitively) a skill in `from`
  ["count-to-20", "compare-numbers"], ["count-to-20", "add-within-10"], ["count-to-20", "subtract-within-10"],
  ["count-to-20", "place-value"], ["compare-numbers", "place-value"],
  ["add-within-10", "add-subtract-within-20"], ["subtract-within-10", "add-subtract-within-20"],
  ["add-subtract-within-20", "add-subtract-within-100"], ["place-value", "add-subtract-within-100"],
  ["add-subtract-within-20", "word-problems"], ["add-subtract-within-100", "word-problems"],
])("%s → %s", (from, to) => expect(clusterReaches(to, from)).toBe(true));
it("exactly one entry skill (no needs): count-to-20.objects-to-10", () =>
  expect(SKILLS.filter(s => s.needs.length === 0).map(s => s.id)).toEqual(["count-to-20.objects-to-10"]));
it("skill ids are stable (Review Focus 5 — update snapshot only on purpose)", () =>
  expect(SKILLS.map(s => s.id)).toMatchSnapshot());
```

`clusterReaches(to, from)` is a test-local helper. It returns true if any skill in cluster `to` reaches a skill in cluster `from` by following `needs`.

- [ ] **Step 2: Run it.** `npm test -- skillMap` → the snapshot is written on first run, and all other checks must PASS. If an edge check fails, fix the `needs` in the cluster file, not the test.
- [ ] **Step 3: Update the vault.** In each `vault/04 Skills/<cluster>.md`, replace "Small skills: defined in Section 3." with a list of that cluster's skill names and ids. In `Roadmap.md`, mark "Skill map + problem maker" as `done`.
- [ ] **Step 4: Run the full check.** `npm test && npm run typecheck` → all PASS. Record the test count in the commit body.
- [ ] **Step 5: Commit.** `feat: whole skill-map checks, id snapshot, vault skill lists`

---

## Owner review after Plan 1

The spec says templates are "reviewed by the owner". Before Plan 2 starts, the owner reads through the say lines and the skill names. A good way to do that is a quick script, run through `vitest` or `tsx`, that prints 3 sample problems per template at each level.
