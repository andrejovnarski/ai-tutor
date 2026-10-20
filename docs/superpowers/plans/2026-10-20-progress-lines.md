# Progress Lines Implementation Plan

> **For agentic workers:** executed by Codex one task at a time through `docs/codex/HANDOFF.md`
> (Claude writes each task there, owns git, runs db/e2e, reviews). Steps use checkbox (`- [ ]`) syntax.

**Goal:** the end card shows one "Today" line and one "Next time" line in kid words.

**Architecture:** the pure engine counts two things per session and `summaryOf()` picks `today`/`next` as ids;
one pure `progressLines()` turns them into text; `publicTurn` swaps the ids for that text on the end turn;
`EndCard` renders it.

**Tech Stack:** Next.js 16, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-progress-lines-design.md`

## Global Constraints

- Exact copy (US English): `You learned {skill}!`, `You kept going and solved a tricky one!`,
  `You practiced {skill}.`, `You showed Nova what you can do!`, `Next time: more {skill}`,
  `Next time: {skill}`, `Next time: a mix of your skills`.
- `{skill}` = `kidName ?? name`. The eight `kidName` values are the spec's "Kid names" table, verbatim.
- A correct answer after Help 2 never counts toward `recovered`.
- Placement-mastered skills never produce a "learned" line.
- No line mentions days, streaks, or coming back.
- Old saved sessions (no `recovered` / `practiced`) read as `0` / `{}`.
- The browser gets text only: no `today`/`next` skill ids in `PublicTurn`.

## Review Focus

1. **Session with only wind-down problems** (kid arrives late in the day, max time hit) → "practiced" names a
   wind-down skill; test in Task 1.
2. **Mastered by placement in a session that then practiced** → Today is "practiced", never "learned"; Task 1.
3. **Reload of today's end card** (`todaysEndCard` rebuilds from saved state) → same two lines; Task 1 (summary
   from a JSON round-tripped session) and Task 2 (e2e reload).
4. **Long kidName on a phone (390 px)** — "Big taking away with borrowing" → wraps, never clipped; Task 2
   kid-shots guard.
5. **Help 1 then correct on try 2** counts as kept going; **Help 2 then correct** doesn't; Task 1.

---

### Task 1 (T11): Counters, summary and words

**Files:**
- Modify: `src/domain/types.ts` (`Skill.kidName?: string`)
- Modify: curriculum files in `src/domain/curriculum/` holding the 8 skills (add `kidName`)
- Modify: `src/domain/session/types.ts` (`Session.recovered`, `Session.practiced`, `SessionSummary.today/next`)
- Modify: `src/domain/session/engine.ts` (`startSession`, `respond`, `serve` or wherever first tries are
  served, `summaryOf`)
- Create: `src/domain/session/progressLines.ts`
- Modify: `src/server/publicTurn.ts` (end turn: drop `today`/`next` from summary, add `progress`)
- Test: `src/domain/session/engine.test.ts`, `src/domain/session/progressLines.test.ts`, `src/server/publicTurn.test.ts`

**Interfaces:**
- Produces:
  - `type Today = { kind: "learned" | "practiced"; skillId: string } | { kind: "kept-going" | "placement" }`
  - `type Next = { kind: "skill" | "more"; skillId: string } | { kind: "mix" }`
  - `SessionSummary` gains `today: Today | null; next: Next | null`.
  - `export function progressLines(summary: Pick<SessionSummary, "today" | "next">): { today: string | null; next: string | null }`
  - `PublicTurn` end variant: `summary` without `today`/`next`, plus `progress: { today: string | null; next: string | null }`.

- [ ] **Step 1: Failing tests** (`engine.test.ts`, using `testkit.ts`):
  - `recovered` +1 for a correct try 2 after a wrong first try; +1 after Help 1; +0 after Help 2; +0 for a
    correct first try (Review Focus 5).
  - `practiced[skillId]` +1 per first try served in practice, review, check and wind-down; not in placement.
  - `summaryOf`: mastered this session → `{ kind: "learned", skillId: <last of session.mastered> }`; else
    `recovered > 0` → `kept-going`; else most-practiced skill (tie → the later key in insertion order) →
    `practiced`; else placement happened → `placement`; else `problems === 0` → `today: null, next: null`.
  - `summaryOf` next: `frontier(kid)` null → `mix`; equals the `practiced` today skill → `more`; else `skill`.
  - placement-mastered skill + practice → `practiced`, not `learned` (Review Focus 2); wind-down-only session
    → `practiced` (Review Focus 1); a session JSON round-tripped and missing `recovered`/`practiced` → today
    from `mastered`/`placement` rules only, no throw (Review Focus 3).
- [ ] **Step 2: Failing tests** (`progressLines.test.ts`): every Global Constraints copy line, `kidName`
  used when set (`add-subtract-within-100.add-regroup` → `You practiced Big adding with carrying.`), `name`
  otherwise, nulls → nulls. `publicTurn.test.ts`: end turn has `progress`, and its `summary` has no `today`/`next` keys.
- [ ] **Step 3:** run → FAIL.
- [ ] **Step 4:** implement. Counters default with `?? 0` / `?? {}` where read.
- [ ] **Step 5:** `npm run typecheck`, `npm test` green.

### Task 2 (T12): End card lines and e2e

**Files:**
- Modify: `src/app/play/EndCard.tsx`, `src/app/play/play.module.css`, `src/app/play/playMachine.ts` (carry
  `progress` from the end turn into state), `src/app/play/PlayScreen.tsx` (pass it)
- Test: `src/app/play/screen.test.tsx` (or an EndCard render test), `tests/e2e/rewards.spec.ts` or the session
  ending spec, `tests/e2e/kid-shots.spec.ts`

**Interfaces:**
- Consumes: `PublicTurn` end `progress` (Task 1).
- Produces: `EndCard` prop `progress?: { today: string | null; next: string | null }`.

- [ ] **Step 1: Failing tests:** EndCard renders `data-testid="progress-today"` / `"progress-next"` with the
  given text; omits each when null; omits both when `progress` is undefined (older server). Lines sit after the
  title and before the stats.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement; Today in body size, Next time quieter (DESIGN.md tokens).
- [ ] **Step 4:** `npm run typecheck`, `npm test` green.
- [ ] **Step 5 (Codex writes, Claude runs):** e2e — finish a session with the existing `finishSession` helper,
  expect both lines visible; reload → same text (Review Focus 3). kid-shots: the end-card screens get the
  same no-clip guard as Nova's bubble applied to `progress-today`/`progress-next` (Review Focus 4).
