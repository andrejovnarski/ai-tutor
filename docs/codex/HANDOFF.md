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

### T6 — Help me, part 1: engine `help()` and sims
- **Branch:** `codex/help-me` (already checked out, from `main`; T7–T9 follow on the same branch)
- **Goal:** the pure session engine supports "Help me": Help 1 (hint + picture, scored as a quiet miss) and
  Help 2 (worked answer the child then types), stored as `helped` attempts.
- **Read first:** spec `docs/superpowers/specs/2026-10-20-help-me-design.md` (section "Learning model") and plan
  `docs/superpowers/plans/2026-10-20-help-me.md` — do **Task 1 (T6)** exactly, steps 1–6, including the
  Global Constraints and Review Focus items 2, 3 and 4 that belong to Task 1.
- **Don't:** touch `src/server`, `src/app`, migrations, or tutor lines (that's T7/T8) except type-only fixes the
  plan's Step 4 allows. No new deps.
- **Acceptance:** all new engine and sim tests pass; `npm run typecheck` and `npm test` green.

#### Codex report
- Files changed:
- Test results:
- Choices I made:
- Open questions:

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
