# Claude ↔ Codex handoff

Shared notes between Claude Code (lead: plans, reviews, merges) and Codex (implementer).
Claude writes tasks here; Codex reads this file, does the task, and writes its report
back under the task. The owner (Andrej) has the final say on everything.

## Rules for Codex

1. Read `AGENTS.md`, `PRODUCT.md` and `DESIGN.md` first. This repo uses a newer Next.js than
   you know — check `node_modules/next/dist/docs/` before touching Next APIs.
2. Do **only** the active task below. No drive-by refactors, no renames, no new dependencies
   unless the task says so.
3. Claude creates the task branch before handing it to you. **Don't run git commands that write**
   (no commit, checkout, branch, stash, reset, push). Leave your changes uncommitted; Claude reviews
   and commits them. Read-only git (`status`, `diff`, `log`) is fine.
4. Write the test first when the task changes behaviour (Vitest for units, `tests/` for e2e).
5. Before reporting done, run and paste the result lines of:
   - `npm run typecheck`
   - `npm test`
   - Don't run `npm run test:db` / `npm run test:e2e` — they need Docker and network, which your
     sandbox doesn't have. Claude runs them.
6. Don't kill anything on port 3000 — that's the owner's dev server.
7. Kids' privacy matters (COPPA): never log, store or send child data anywhere new.
   If a task seems to need that, stop and say so in the report.
8. If something is unclear, make the smallest sensible choice and list it under
   "Choices I made" in the report rather than stopping.
9. **Never remove or weaken an existing test** (assertion, threshold, check) to make your change pass. If a
   test conflicts with the task, stop and say so under "Open questions".

## Rules for Claude

- One active task at a time; each has a goal, files, acceptance checks and a branch.
- Use the project skill `/codex-task` — it covers the whole loop (write task → branch → dispatch →
  review → commit → done log).
- When Codex reports back: read the diff, run all suites yourself (db/e2e via
  `echo '<cmd>' | newgrp docker` if Docker is needed), then review.
  Fixes go back to Codex as a new "Fix round" under the same task.
- Move finished tasks to the Done log with the commit range.
- Ask the owner before merging to `main` or pushing.

---

## Active task

### T14 — Recall checks: migration, rows, parent words
- **Branch:** `codex/recall-checks` (T13 already committed there; you are on it)
- **Goal:** the three recall fields are stored in the database, and parents read "learned" apart from
  "remembered" on the kid page, in the week summary, and in the weekly email.
- **Context:** spec `docs/superpowers/specs/2026-10-20-recall-checks-design.md` (sections "Persistence",
  "Parents"); plan `docs/superpowers/plans/2026-10-20-recall-checks.md` **Task 2** — read both.
  T13 already did `src/server/persist/rows.ts` mapping (optional row fields) and its round-trip test; keep it,
  just make the `SkillRow` fields non-optional if that typechecks cleanly, otherwise leave them.
  The db tests are red right now only because the columns don't exist yet (PGRST204 "check_due") — your migration fixes that.
- **Do:** plan Task 2 Steps 1–6. Migration `supabase/migrations/0010_recall.sql`: copy `save_step` from
  `0002_save_step_hardening.sql` exactly, add the three columns to its insert list and update-set list; keep
  revoke/grant. Exact parent copy from the plan's Global Constraints (separator ` · ` U+00B7). Cover Review
  Focus 5. Write the `repo.db.test.ts` round-trip test (Step 3) but don't run it (Claude runs db).
- **Don't:** no engine/domain behaviour changes, no kid-visible changes, no rewards changes, don't touch
  `mastered_at` trigger. Don't remove or weaken tests (rule 9): changing an old expected string from
  `Mastered` to the new `Learned` wording is allowed because the spec changes that copy — list every such edit
  in your report.
- **Acceptance:** `npm run typecheck` clean; `npm test` green with a final count.

#### Codex report
- Files changed: `supabase/migrations/0010_recall.sql`; `src/server/kidRecord.ts` and `.test.ts`; `src/server/report/build.ts` and `.test.ts`; `src/server/exportFile.ts` and `.test.ts`; `src/app/parent/kids/[kidId]/page.tsx` and `page.test.tsx`; `src/app/parent/kids/[kidId]/WeekSummary.tsx` and `WeekSummary.test.tsx`; `tests/db/repo.db.test.ts`; `docs/codex/HANDOFF.md`.
- Test results: `npm run typecheck` → `tsc --noEmit`, exit 0. `npm test` → `Test Files 82 passed (82)`; `Tests 1373 passed (1373)`. New wording tests failed before implementation. `git diff --check` clean. Database round-trip test written for insert and update, not run; no db/e2e tests, git writes, or port 3000 operations.
- Choices I made: Kept T13's row mapper and tests unchanged. Making `SkillRow` recall fields required produced TS2790 in the existing old-row test, so left them optional as allowed. Used current `isMastered` status for parent lines and covered placement → forgotten → re-mastered (Review Focus 5). Preserved the migration's hardened function and revoke/grant; no trigger changes. Existing expected-copy edits: `kidRecord.test.ts`, `Mastered Oct 12` → `Learned Oct 12 · not checked yet`; `WeekSummary.test.tsx`, positive `Mastered: Counting to 20, Adding within 5` → `Learned: Counting to 20, Adding within 5`, and negative `Mastered:` → `Learned:`. Updated two existing mastered fixtures to satisfy current mastery (`p_known: 0.98`, `attempts: 5`), preserving all assertions. Added session-copy, email-copy and download-guide assertions.
- Open questions: None. Claude still needs to apply the migration and run db/e2e validation.

<!-- Template:
### T1 — <title>
- **Branch:** `codex/<slug>`
- **Goal:** what should be true when done (plain words)
- **Context:** spec/plan links, relevant files
- **Do:** numbered steps
- **Don't:** out-of-scope things
- **Acceptance:** commands that must pass + behaviour to check

#### Codex report
- Files changed:
- Test results:
- Choices I made:
- Open questions:
-->

## Done log

| Task | Branch | Commits | Result |
|------|--------|---------|--------|
| T1 — "-es" plurals in number guard | `codex/es-plurals` | 0b6e0d4 | Done first try; unit 1214 green, typecheck clean |
| T2 — Placement step cap (6 per probe) | `codex/placement-step-cap` | af8bade | 1 fix round (old sim tests assumed K kid knows ~all; ruled grade-matched). unit 1220, db 133, e2e 62 (4 flaky reruns) |
| T3 — e2e flakes: mail wait + rewards XP seed | `codex/e2e-flakes` | db3696f | rewards.spec 20/20 repeated. Remaining flakes: journey weekly-report cron loops over all leftover local test parents and slows the server |
| T4 — e2e deletes leftover @example.com users | `codex/e2e-flakes` | 8118237 | parents stay flat between runs. Remaining flakes: local auth container runs out of ports (`cannot assign requested address`) under ~1200 getUser calls/min |
| T5 — getClaims in proxy + kid play API | `codex/auth-claims` | b3ec752 | First try. Auth /user calls per e2e run ~3100 → ~600–800; e2e 62/62 twice in 1.3 min |
| T6 — Help me: engine `help()` + sims | `codex/help-me` | c90eb59 | First try. unit 1251 green |
| T7 — Help me: migration, `/help` route, help line | `codex/help-me` | ccfe5f4 | Stopped at out-of-scope fixture (Claude fixed). unit 1271, db 134, e2e 62 |
| T8 — Help me button + e2e | `codex/help-me` | 0fd8693 | 2 fix rounds (48px in tray → 88px next to Nova; phone bubble clipped → own row ≤720px). e2e 63 |
| T9 — Help me: parent page, download text, lawyer line | `codex/help-me` | f4a3c89 | First try. unit 1289, db 134, e2e 63. Final review: nothing serious, 2 small fixes → T10 |
| T10 — Help me review fixes (focus, retry notice) | `codex/help-me` | 94acc5c | First try. unit 1293, e2e 63 ×2 |
| T11 — Progress lines: counters, summary, words | `codex/progress-lines` | 9f911b0 | Asked before touching 2 out-of-scope fixtures (OK given). unit 1324, db 134 |
| T12 — Progress lines: end card + e2e | `codex/progress-lines` | edea2f4 | 1 fix round: had deleted the end-card fit check (Claude restored it; card overflowed 79 px on phone) → tightened spacing. unit 1331, e2e 64 |
| T13 — Recall checks: model, engine, sims | `codex/recall-checks` | (this commit) | 1 ruling round (old review tests kept via testkit `checkDue` far future; pair BKT per-answer guess; both-wrong cap 0.9). unit 1365; db red until T14 migration (missing columns, expected) |
| T14 — Recall checks: migration, rows, parent words | `codex/recall-checks` | (this commit) | First try. Claude fixes: `coalesce(check_step,0)` in save_step (old payloads), testkit not-due date → year 9999 (Postgres range), null mastered_at guard, "recall" in download mode list. unit 1373, db 135, e2e 64 |
