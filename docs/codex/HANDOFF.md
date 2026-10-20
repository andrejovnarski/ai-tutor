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

### T15 — Recall checks: e2e
- **Branch:** `codex/recall-checks` (T13, T14 committed; you are on it)
- **Goal:** one Playwright test proves a due skill gets a two-problem recall in real play and the parent page
  then says `remembered`.
- **Context:** plan `docs/superpowers/plans/2026-10-20-recall-checks.md` **Task 3**. Copy patterns from
  `tests/e2e/play.spec.ts` (test at ~line 157: `setUpMia`, `admin()` seeding of `skill_state`, reading the open
  session's `state.pending.problem.answer` to answer right, tiles vs number pad) and `tests/e2e/rewards.spec.ts`
  (finishing a session).
- **Do:** create `tests/e2e/recall.spec.ts`:
  1. `setUpMia`, mark kid `placed: true`. Seed `skill_state` rows for the first few K skills in curriculum order
     as mastered (`p_known 0.99, attempts 10, placed false`) with `check_due` = `new Date(Date.UTC(9999,0,1))` (not
     due), except ONE target skill: mastered the same way, `mastered_at`/`last_seen`/`check_due` = 2 days ago.
     Leave later skills unseeded so there is a frontier to practice.
  2. Play, answering right each time (from `state.pending`), until `attempts` (via `admin()`) has two rows
     `mode = 'recall'` for the target skill, both `result = 'correct'`, `try = 1`. Cap the loop (e.g. 12 problems)
     and fail clearly if not reached. Recall comes at the 5th problem (review slot).
  3. Leave play ("I'm done for now" or however other specs reach the parent page), open Mia's parent kid page,
     expect that skill's row text to contain `remembered`.
- **Don't:** don't change app code or other specs. You cannot run e2e (no network/port) — write it carefully;
  Claude runs it. Don't remove or weaken tests (rule 9).
- **Acceptance:** `npm run typecheck` clean; `npm test` green with a final count.

#### Codex report
- Files changed: `tests/e2e/recall.spec.ts` (new recall flow test); `docs/codex/HANDOFF.md` (this report). No app code or other specs changed. No git writes; port 3000 untouched.
- Test results: `npm run typecheck` → `tsc --noEmit`, exit 0. `npm test` → `Test Files 82 passed (82)`; `Tests 1373 passed (1373)`, exit 0. E2e and db tests not run, as instructed; Claude must run the new spec.
- Choices I made: seeded the first three K skills in curriculum order, with the first (`Count to 10`) as the sole due target; other seeded skills use the year-9999 due date. Capped play at 12 problems, checked exactly two target recall rows with `result: correct` and `try: 1`, then used “I'm done for now” and checked `remembered` in that skill's parent-page row.
- Open questions: None.

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
| T15 — Recall checks: e2e | `codex/recall-checks` | (this commit) | First try; passed on first run. e2e 65 |
