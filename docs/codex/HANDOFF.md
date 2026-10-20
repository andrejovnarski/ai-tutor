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

### T3 — Make two flaky e2e checks deterministic
- **Branch:** `codex/e2e-flakes` (already checked out, from `main`)
- **Goal:** full e2e runs stop failing at random. Two causes found by Claude:
  1. **Mail wait too short.** `latestEmailTo()` in `tests/helpers/admin.ts` polls Mailpit 10 × 200 ms
     (2 s). Under a full parallel run, sign-in mail arrives later → `Error: no mail for <email>`
     (seen in kid-shots, screen, speech, play specs).
  2. **Rewards test relies on luck.** `tests/e2e/rewards.spec.ts` taps the first choice until the end
     card. XP per session varies (`src/domain/rewards/rules.ts`: 10/problem, +5 first try, +20
     finished; 1 cube = `XP_PER_CUBE` 50). A short or mostly-wrong session earns < 50 XP → rod reads
     "0 of 10 cubes" → the test at line 39 fails (`/^[1-9]\d* of 10 cubes$/`) and the reduced-motion test
     at line 67 finds no `[data-drop=true]`. Repro: `npx playwright test tests/e2e/rewards.spec.ts
     --repeat-each=6` → 2 of 6 fail. This is a test problem, not a product bug: 0 cubes after < 50 XP is correct.
- **Context:** XP/cubes come from `src/domain/rewards/progress.ts` (derived from finished sessions —
  read how before choosing a fix). Test helpers: `tests/e2e/helpers.ts`, `tests/helpers/admin.ts`.
- **Do:**
  1. Mail: poll for up to ~15 s total (keep 200 ms steps, or back off). Keep the error message.
  2. Rewards: make both tests guarantee at least one new cube in the finished session, without
     depending on which answers are right. Preferred: seed prior progress through the db (e.g. an
     earlier finished session / XP the code already reads) so the kid sits just below a cube boundary,
     so the guaranteed +20 "finished" XP always adds a cube. If that isn't possible cleanly, explain and
     instead make the line-39 assertion derive the expected cube count from the shown "+N" and the
     prior XP, and the reduced-motion test seed as above.
  3. You can't run e2e in your sandbox: run `npm run typecheck` (it covers tests/) and `npm test`,
     and say exactly what Claude should run to check.
- **Don't:** change product code under `src/`, change timeouts in `playwright.config.ts`, or add retries.
- **Acceptance (Claude runs):** `npx playwright test tests/e2e/rewards.spec.ts --repeat-each=10` all
  pass; full `npm run test:e2e` passes with no "no mail for" errors.

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
