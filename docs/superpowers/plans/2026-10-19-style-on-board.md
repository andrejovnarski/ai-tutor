# Teaching Style on the Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On a retry of a simple sum within 10, the board shows the picture for the teaching style the engine chose (counters, ten-frame, number line or blocks), with the same numbers.

**Architecture:** Six templates record their two addends as `problem.sum`; a pure `styleView(style, sum)` builds the picture; the problem turn carries its retry style; `publicTurn` swaps the picture on try 2; Nova's plan names a style only when the board shows it.

**Tech Stack:** TypeScript domain code, Next.js 16 server, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-19-style-on-board-design.md`

## Global Constraints

- In scope: templates `add-objects-10`, `add-ten-frame-10`, `add-facts-5`, `add-line-5`, `count-on-bigger-first`, `count-on-smaller-first`. No other template sets `sum`.
- `sum` is the two addends in the order the problem says them; `sum[0] + sum[1] === answer`.
- Views, verbatim: `drawing` → `{ kind: "objects", icon: "apple", groups: [a, b] }`; `ten-frame` → `{ kind: "ten-frames", first: a, second: b }`; `number-line` → `{ kind: "number-line", from: 0, to: 10, marks: [a], jump: { from: a, by: b } }`; `blocks` → `{ kind: "blocks", groups: [{ tens: 0, ones: a }, { tens: 0, ones: b }] }`; `story` → `null`.
- The browser never receives `sum` or `style` (their total is the answer).
- No database migration; no change in `src/app`.

## Review Focus

1. **A zero addend** (`add-facts-5`/`add-line-5` at levels 2–3 allow 0): every view must be valid with a = 0 or b = 0 (Task 1 test over all a, b ≥ 0).
2. **Level 3 problems show an equation** (`fade`): their retry still switches to the style picture, which is the intended support; a first try keeps the equation (Task 2 test).
3. **Reload during a retry** returns the same picture and line (Task 2 test).
4. **Story chosen**, or a style chosen for an out-of-scope problem: original picture, and no `style` in Nova's plan (Task 2 tests).
5. **Old sessions saved before this change** have pending problems with no `sum` and turns without `style`: they must render the original picture, not crash (Task 2 test with a pending lacking both).

---

### Task 1: `sum` on six templates and `styleView`

**Files:**
- Modify: `src/domain/types.ts` (`Problem.sum?`), `src/domain/curriculum/kit.ts` (`Draft.sum?`), `src/domain/problems/build.ts` (`finalize` copies `sum`), `src/domain/curriculum/add-within-10.ts` (six templates)
- Create: `src/domain/problems/styleView.ts`
- Test: `src/domain/problems/styleView.test.ts`, `src/domain/curriculum/add-within-10.test.ts`; update `src/domain/curriculum/__snapshots__` if the snapshot test includes the new field (`npx vitest -u` only for that snapshot, after checking the diff is only `sum`)

**Interfaces:**
- Produces: `Problem.sum?: [number, number]`; `styleView(style: Style, sum: [number, number]): Visual | null`.

- [ ] **Step 1: Write the failing tests**
  - `styleView.test.ts`: for every a, b ≥ 0 with a + b ≤ 10: `drawing` groups sum to a + b; `ten-frame` first + second = a + b; `number-line` jump.from + jump.by = a + b, from 0, to 10, marks [a]; `blocks` ones sum to a + b with tens 0; exact object shapes from Global Constraints for one case (3, 4); `styleView("story", [3, 4])` is null.
  - `add-within-10.test.ts`: for each of the six templates, levels 1–3, seeds 1..50: `sum` is set and `sum[0] + sum[1] === answer`; `make-ten-frame`, `make-ten-bond`, `missing-addend`, `missing-first` have no `sum`.
- [ ] **Step 2: Run** `npx vitest run src/domain/problems/styleView.test.ts src/domain/curriculum/add-within-10.test.ts` → FAIL.
- [ ] **Step 3: Implement.** In each of the six drafts add `sum: [a, b]` (for `count-on-smaller-first` and `count-on-bigger-first` the spoken order, e.g. `[a, b]` as in `say`).
- [ ] **Step 4: Run** the same tests, then `npm test` and `npm run typecheck` → PASS.
- [ ] **Step 5: Commit** — `feat: sum problems carry their addends; styleView draws them per teaching style`

---

### Task 2: Retry board shows the style; Nova names it only when shown

**Files:**
- Modify: `src/domain/session/types.ts` (problem `Turn` gains `style: Style | null`), `src/domain/session/engine.ts` (`problemTurn` copies `p.style`), `src/server/play.ts` (`pendingTurn` copies `p.style`), `src/server/publicTurn.ts`, `src/server/tutor/plan.ts`
- Test: `src/server/publicTurn.test.ts` (create if missing), `src/server/tutor/plan.test.ts`, `src/server/play.test.ts`

**Interfaces:**
- Consumes: `Problem.sum`, `styleView` (Task 1).
- Produces: problem `Turn.style: Style | null`. A helper in `publicTurn.ts`, `boardView(turn: ProblemTurn): Visual`: `styleView(turn.style, turn.problem.sum)` when `turn.try === 2`, `turn.style` and `turn.problem.sum` are set and the view is non-null; otherwise `turn.problem.prompt.show`. `plan.ts` uses the same non-null check to decide whether to include `style`.

- [ ] **Step 1: Write the failing tests**
  - `publicTurn`: try 2 + `number-line` + sum [3, 4] → `prompt.show` equals the number-line view; try 1 same problem → original `show`; try 2 + `story` → original; try 2 + style + no `sum` → original; `JSON.stringify(publicTurn(t))` contains neither `"sum"` nor `"style"`.
  - `plan`: `feedbackPlan` for a retry with `feedback.style = "ten-frame"` on a problem with `sum` → plan has `style: "ten-frame"`; with `"story"` or no `sum` → no `style` key. Same for the `explain` (reveal) plan.
  - `play`: a sum-problem session (build with the existing testkit; pick a skill whose templates are in scope, e.g. `add-within-10.within-5`); a wrong first answer → `ok(r).next.prompt.show` equals `styleView(<pending.style from repo>, <pending.problem.sum>)` (or the original for story); `playTurn` right after returns the same `prompt.show`. Review Focus 5: an open session whose pending problem has no `sum` and no `style` field renders its original picture on `playTurn`.
- [ ] **Step 2: Run** `npx vitest run src/server/publicTurn.test.ts src/server/tutor/plan.test.ts src/server/play.test.ts` → FAIL.
- [ ] **Step 3: Implement** as in Interfaces. `pendingTurn`/`problemTurn` use `p.style ?? null` (old sessions).
- [ ] **Step 4: Run** `npm test`, `npm run typecheck` → PASS.
- [ ] **Step 5: Commit** — `feat: the retry board shows the chosen teaching style; Nova names it only when shown`

---

### Task 3: Browser check of the retry picture

**Files:**
- Modify: `tests/e2e/play.spec.ts`

- [ ] **Step 1: Write the test** `"a wrong answer on a sum problem shows the retry picture the server sent, and a reload keeps it"`:
  1. `setUpMia`; through `admin()` set Mia `placed = true` and give her a `skill_state` row making `add-within-10.within-5` her current skill if needed (read `frontier` in `src/domain/kid/next.ts`; the simplest is mastered rows for its prerequisites).
  2. Tap Mia; when a problem shows, read the right answer from `sessions.state.pending.problem.answer` through `admin()`, then answer wrong: tap a choice tile whose text is not that number, or on the number pad enter (answer + 1) and OK. Assert the `/answer` response has `next.try === 2` (if the step went to a prerequisite check instead, answer that and repeat on the next sum problem; at most 5 problems).
  3. Capture the `/answer` response's `next.prompt.show.kind`; assert the board element for that kind is visible (`data-testid` or the visual's `data-*` attribute the visuals already set; check `src/app/play/visuals`).
  4. Reload; the same kind is visible.
- [ ] **Step 2: Run** `npx playwright test tests/e2e/play.spec.ts` (if port 3000 is taken by the owner's dev server, use the temporary port-3100 config and delete it after).
- [ ] **Step 3: Full check** — `npm run typecheck`, `npm test`, `npm run test:db`, all e2e → PASS.
- [ ] **Step 4: Commit** — `test: e2e retry picture follows the teaching style`
