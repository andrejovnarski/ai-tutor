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

### T17 — Fill the frame: e2e and kid-shots
- **Branch:** `codex/fill-frame` (T16 committed; you are on it)
- **Goal:** browser tests prove the fill frame works by touch and keyboard, resets on retry, and fits every kid
  screen size with ≥ 48 px cells at tablet.
- **Context:** plan `docs/superpowers/plans/2026-10-20-fill-the-frame.md` **Task 2**; spec
  `docs/superpowers/specs/2026-10-20-fill-the-frame-design.md`. Patterns: `tests/e2e/play.spec.ts` (~line 157:
  seeding `skill_state` with `admin()`, reading `state.pending` to know the answer and `templateId`),
  `tests/e2e/recall.spec.ts` (seeding with `check_due` year 9999 so no recall interferes),
  `tests/e2e/kid-shots.spec.ts` (`SIZES`, `SLACK` clipping guard). The frame grid has `data-frame="true"`;
  added counters `data-counter="added"`; empty cells `data-empty="true"`.
- **Do:**
  1. `tests/e2e/fill-frame.spec.ts` per plan Task 2 Step 1. Seed every skill before `add-within-10.make-ten`
     in curriculum order as mastered (`check_due` year 9999), so Make 10 is the frontier. It has two templates
     (`make-ten-frame`, `make-ten-bond`); answer right until `state.pending.templateId === "make-ten-frame"`
     (cap the loop, fail clearly).
  2. kid-shots per plan Task 2 Step 2: a Make 10 frame screen with 3 added counters at every `SIZES` entry;
     cell button boxes ≥ 48 × 48 at the tablet size; frame grid, `Start over` and the answer tiles inside the
     viewport (use the existing SLACK guard style).
- **Don't:** no app code changes. Don't remove or weaken tests (rule 9). You can't run e2e — write carefully;
  Claude runs it.
- **Acceptance:** `npm run typecheck` clean; `npm test` green with a final count.

#### Codex report — round 2
- Files changed: `tests/e2e/helpers.ts`, `tests/e2e/fill-frame.spec.ts`, `tests/e2e/kid-shots.spec.ts`, `docs/codex/HANDOFF.md`. No app code changes.
- Test results: `npm run typecheck` → `tsc --noEmit` (exit 0); `npm test` → `Test Files  83 passed (83)`, `Tests  1382 passed (1382)`. E2e and db tests not run. No git writes; port 3000 untouched.
- Choices I made: Replaced both template-search loops with shared `forcePending`, using the kid's age band and `adaptInput(generate(...))`. Only `state.pending` is replaced; the remaining state and session version are preserved, followed by reload and a board visibility check. Fixed seed `0` at level 1 produces answer `4`; both callers assert answer ≥ 4. Kept the other interaction, retry, screenshot, tablet cell-size and clipping assertions, along with the frontier seeding.
- Open questions: None. Claude still needs to run the browser tests.

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
| T16 — Fill the frame: flag + interactive ten-frame | `codex/fill-frame` | (this commit) | Stopped once to ask about tightening an exact-object test (allowed: adds `fill: true`). Claude added `data-frame` marker. unit 1382, e2e 65 |
| T17 — Fill the frame: e2e + kid-shots | `codex/fill-frame` | (this commit) | 1 fix round: template search by playing was luck (Make 10 mastered first) → `forcePending` helper writes a fixed make-ten-frame pending. e2e 66, new specs 14/14 on repeat |
