# Recall Checks Implementation Plan

> **For agentic workers:** executed by Codex one task at a time through `docs/codex/HANDOFF.md`
> (Claude writes each task there, owns git, runs db/e2e, reviews). Steps use checkbox (`- [ ]`) syntax.

**Goal:** mastered skills are re-checked 1, 3, 7, then 21 days later with a two-problem recall; parents see
"learned" apart from "remembered".

**Architecture:** the pure kid model gains a per-skill schedule and `recallTarget()`; the session engine runs a
recall in the review slot and scores the pair; persistence maps three new columns; parent words read them.

**Tech Stack:** Next.js 16, Supabase (Postgres), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-recall-checks-design.md`

## Global Constraints

- `RECALL_GAP_DAYS = [1, 3, 7, 21]`, `RECALL_DAY_MS = 20 * 3_600_000`, two problems per recall.
- Old saved states/sessions without the new fields read as `checkStep 0`, `checkDue null`, `rememberedAt null`,
  `recall null`. No backfill.
- The prerequisite `check` (`Session.check`, mode `"check"`) is not changed.
- Exact parent copy: `Learned {date} · not checked yet`, `Learned {date} · remembered {date}`,
  `Knew at start · not checked yet`, `Knew at start · remembered {date}`, `Practicing again`, `Learned: …`,
  `Learned this week: …`. Dates use `monthDay` from `src/server/kidRecord.ts`. The separator is ` · ` (U+00B7).
- Nothing about recall is shown to the kid. No new data destinations (COPPA).

## Review Focus

1. **Kid away for weeks, many skills overdue** → still at most one recall per review slot (one every 5
   problems), oldest due first; no flood. Test in Task 1.
2. **Session hits max time mid-recall** → the second recall problem is served before wind-down; the pair is
   always scored. Task 1.
3. **Recall skill is also `current`/frontier, or was seen earlier today** → no recall for it this session
   (`lastSeen >= startedAt`). Task 1.
4. **Reload mid-recall** (session JSON round-trip) → `recall` survives; second problem still uses a different
   template. Task 1.
5. **Row mastered by placement, then forgotten, then re-mastered in play** → `placed` is still true, so the line
   reads `Knew at start · …`; `Practicing again` only while not mastered. Task 2.

---

### Task 1 (T13): Model, engine, sims

**Files:**
- Modify: `src/domain/kid/types.ts` (`SkillState` fields, `Mode` gains `"recall"`)
- Modify: `src/domain/kid/state.ts` (`newKidState` defaults)
- Modify: `src/domain/kid/next.ts` (`recallTarget`, `isRecallDue`, `reviewTarget` skip)
- Modify: `src/domain/session/types.ts` (`Session.recall`, constants)
- Modify: `src/domain/session/engine.ts` (`startSession`, `nextTurn`, `serve` template choice, `answer`, `firstTry` schedule on mastery)
- Modify: `src/domain/sim/bot.ts` (forgetting, `simulate` option)
- Test: `src/domain/kid/next.test.ts`, `src/domain/session/engine.test.ts`, `src/domain/sim/sim.test.ts`

**Interfaces:**
- Produces:
  - `SkillState` + `checkStep: 0 | 1 | 2 | 3; checkDue: number | null; rememberedAt: number | null`
  - `Mode` = existing | `"recall"`
  - `export const RECALL_GAP_DAYS = [1, 3, 7, 21] as const; export const RECALL_DAY_MS = 20 * 3_600_000;`
    (in `src/domain/kid/next.ts`)
  - `export function isRecallDue(s: SkillState, now: number, sessionStart: number): boolean` — mastered,
    `(s.checkDue ?? -Infinity) <= now`, `s.lastSeen === null || s.lastSeen < sessionStart`.
  - `export function recallTarget(kid: KidState, now: number, sessionStart: number): string | null` — due
    skill with oldest `checkDue` (`null` oldest), ties curriculum order.
  - `reviewTarget(kid, exclude, now?, sessionStart?)` — when `now`/`sessionStart` are given, skips skills where
    `isRecallDue` is true. Existing callers keep working.
  - `Session.recall: { skillId: string; results: boolean[]; templates: string[] } | null`
  - `BotProfile.forget?: { day: number; skills: string[] }`; `simulate` opts gain `dayGap?: number` (days
    between sessions, default 1).

- [ ] **Step 1: Failing tests** (`next.test.ts`):
  - `isRecallDue`: not mastered → false; `checkDue` in future → false; `checkDue null` → true;
    `lastSeen >= sessionStart` → false.
  - `recallTarget`: picks `null` before older date before newer date; ties → curriculum order; none → `null`.
  - `reviewTarget(kid, null, now, start)` skips a due skill and returns a not-due one; without `now` it behaves
    as today.
- [ ] **Step 2: Failing tests** (`engine.test.ts`, `testkit.ts` helpers; give due skills `lastSeen` before start):
  - Mastery in play sets `checkStep 0`, `checkDue = now + RECALL_DAY_MS`.
  - Review slot with a due skill → two `mode: "recall"` problems of that skill in a row, different
    `templateId`s when the skill has ≥ 2 templates.
  - Both right → `checkStep` +1, `checkDue = now + RECALL_GAP_DAYS[newStep] * RECALL_DAY_MS`,
    `rememberedAt = now`, `pKnown` raised; at step 3 stays 3 with a 21-day gap.
  - One right (either order) → `pKnown` unchanged from before the recall, `checkStep 0`, `checkDue = now + RECALL_DAY_MS`.
  - Both wrong → not mastered, `level 1`, `checkStep 0`, `checkDue null`.
  - Help 1 on a recall problem = a miss; the try-2 retry after it (or after a wrong answer) doesn't change `recall.results`.
  - No recall in a session that ran placement (start unplaced, finish placement, reach review slot).
  - Review Focus 1: 10 overdue skills → recalls only at review slots, oldest first.
  - Review Focus 2: max time reached after the first recall problem → next turn is the second recall problem.
  - Review Focus 3: skill seen earlier this session → no recall for it.
  - Review Focus 4: `JSON.parse(JSON.stringify(session))` between the two recall problems → second problem
    served with a different template; old session JSON without `recall` and skills without the fields → no throw.
- [ ] **Step 3: Failing tests** (`sim.test.ts`): a bot that keeps its skills, `dayGap: 1`, enough problems →
  some skill reaches `checkStep 3`; a bot with `forget` on day N → each forgotten skill that gets a recall ends
  not mastered after it and later is practiced again; `slip` bot → no skill loses mastery from a recall with one miss.
- [ ] **Step 4:** run → FAIL.
- [ ] **Step 5:** implement. The pair is scored when the second first-try lands: for "both right" and "both
  wrong" apply `applyFirstTry` for each answer in order (first answer's BKT is held until then, so "one right"
  leaves the skill untouched); `lastSeen` updates either way. A recall in progress is served before
  `windDown`/`check`/end, like `check`.
- [ ] **Step 6:** `npm run typecheck`, `npm test` green.

### Task 2 (T14): Migration, rows, parent words

**Files:**
- Create: `supabase/migrations/0010_recall.sql`
- Modify: `src/server/persist/rows.ts`, `src/server/kidRecord.ts`, `src/app/parent/kids/[kidId]/page.tsx`,
  `src/app/parent/kids/[kidId]/WeekSummary.tsx`, `src/server/report/build.ts`, `src/server/exportFile.ts`
- Test: rows test (next to `rows.ts`, or create `src/server/persist/rows.test.ts`), `src/server/kidRecord.test.ts`,
  `src/server/report/build.test.ts`, `src/server/exportFile.test.ts`, `tests/db/repo.db.test.ts`

**Interfaces:**
- Consumes: `SkillState` fields from Task 1; `isMastered` from `src/domain/kid/bkt.ts`.
- Produces: `SkillRow` + `check_step: number; check_due: string | null; remembered_at: string | null`.

- [ ] **Step 1: Migration** `0010_recall.sql`: add the three columns (`check_step int not null default 0`,
  `check_due timestamptz`, `remembered_at timestamptz`); `create or replace function save_step` copied from
  `0002_save_step_hardening.sql` with the three columns added to the insert list and the `on conflict ... do
  update set` list; keep its `revoke`/`grant` lines.
- [ ] **Step 2: Failing tests:**
  - rows: `kidStateFromRows` → `skillRow` round-trips the three fields (ISO ↔ ms; nulls stay null); a row
    missing them (old shape) reads `0`/`null`/`null`.
  - `kidRecord`: one test per row of the spec table, plus Review Focus 5 (placed + forgotten + re-mastered).
  - Session line / week summary / email use `Learned:` and `Learned this week:`.
  - Export "about" text contains the new recall line.
- [ ] **Step 3: db test (Codex writes, Claude runs):** `repo.db.test.ts` saves a skill with
  `checkStep 2`, a `checkDue`, a `rememberedAt` through `save_step` and reads the same values back.
- [ ] **Step 4:** run → FAIL. **Step 5:** implement. **Step 6:** `npm run typecheck`, `npm test` green.

### Task 3 (T15): e2e

**Files:**
- Create: `tests/e2e/recall.spec.ts`

- [ ] **Step 1 (Codex writes, Claude runs):** set up a placed kid (pattern from `tests/e2e/play.spec.ts:169`
  and `rewards.spec.ts`): seed one mastered skill with `last_seen` and `check_due` 2 days ago. Play by answering
  right (the review slot is problem 5) until `attempts` (read with `admin()`) holds two `mode = 'recall'` rows
  for that skill, both `correct`; finish with "I'm done for now". Open the parent kid page → that skill's line
  contains `remembered`.
- [ ] **Step 2:** `npm run typecheck`, `npm test` green; Claude runs `npm run test:db` and `npm run test:e2e`.
