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

### T16 — Fill the frame: flag and interactive ten-frame
- **Branch:** `codex/fill-frame` (Claude made it; you are on it)
- **Goal:** on "Make 10" frame problems the child can tap empty cells to add counters (undo, start over) as a
  counting tool; answering with tiles is unchanged.
- **Context:** spec `docs/superpowers/specs/2026-10-20-fill-the-frame-design.md`; plan
  `docs/superpowers/plans/2026-10-20-fill-the-frame.md` **Task 1** — read both, plus `DESIGN.md` for the colour
  token and button look. Files: `src/domain/types.ts`, `src/domain/curriculum/add-within-10.ts`,
  `src/app/play/visuals/{TenFrames,Visual}.tsx`, `src/app/play/{Board,PlayScreen}.tsx`,
  `src/app/play/{tokens.css,play.module.css}`.
- **Do:** plan Task 1 Steps 1–4 (tests first, watch them fail, then implement). Exact accessible names and
  interfaces from the plan. Cover Review Focus 1, 2, 3, 5.
- **Don't:** no engine/grading/API/database/tutor change; don't show any count; don't save/log/send taps
  (COPPA); no e2e (that is T17). Don't remove or weaken tests (rule 9) — if an existing visual/render test
  breaks, stop and ask.
- **Acceptance:** `npm run typecheck` clean; `npm test` green with a final count.

#### Codex report
- Files changed: `src/domain/types.ts`, `src/domain/curriculum/add-within-10.ts`, `src/domain/curriculum/add-within-10.test.ts`, `src/app/play/visuals/TenFrames.tsx`, new `src/app/play/visuals/TenFrames.test.tsx`, `src/app/play/visuals/Visual.tsx`, `src/app/play/Board.tsx`, `src/app/play/PlayScreen.tsx`, `src/app/play/tokens.css`, `src/app/play/play.module.css`, and this report.
- Test results: tests first demonstrated 6 expected failures; final `npm run typecheck` → `tsc --noEmit` (exit 0); final `npm test` → `Test Files 83 passed (83)`, `Tests 1382 passed (1382)`. Covers ordered additions, undo, clearing, locking, full-frame focus, retry reset, changed-frame reset, passive visuals, and template flags. No git writes, port 3000 activity, db tests, or e2e tests.
- Choices I made: native HTML grid buttons for the interactive frame; existing SVG rendering retained for passive frames. Added counters use blue (`--counter-added: #3b7dd8`); reserved reset-button space avoids layout shifts. Used a Node-only hook/render harness following `usePlay.test.tsx`, without new dependencies. Per Claude's explicit ruling, strengthened the existing make-ten-frame exact-object assertion to also require `fill: true`, preserving every other field and check. Taps remain local React state with no count display or persistence.
- Open questions: none. Browser hit-area and clipping checks remain T17, as planned.

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
