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

### T1 — Number guard reads "-es" plurals ("sixes", "zeroes")
- **Branch:** `codex/es-plurals` (already checked out)
- **Goal:** the tutor-line guard in `src/server/tutor/guards.ts` sees "sixes" as 6 and "zeroes" as 0
  (also upper case, e.g. "SIXES"), so an AI line can't say the answer early by using an "-es" plural.
- **Context:** `wordNumber()` tries `SUFFIXES = ["ths","th","st","nd","rd","s"]`. "sixes" strips "s" to
  "sixe", which is not a number, so it is missed. Same for "zeroes" → "zeroe". Tests live in
  `src/server/tutor/guards.test.ts` — copy the style of the existing `numbersIn` / `checkLine` plural tests.
- **Do:**
  1. Add failing tests first: `numbersIn("two sixes")` contains 6, `numbersIn("zeroes")` contains 0,
     and a `checkLine` case where the answer is 6 and the line says "sixes" → rejected the same way
     "sevens" is rejected when the answer is 7.
  2. Run `npm test -- src/server/tutor/guards.test.ts` and confirm they fail.
  3. Make the smallest change in `wordNumber()` so "-es" plurals are cardinals (not ordinals).
     Keep "fives", "threes", "hundreds", "dozens", "seconds" working exactly as now.
  4. Add a regression test that ordinary words ending in "es" (e.g. "yes", "times", "ones" if it is not
     already a number word) are not new false positives — check what `WORD_VALUES` holds first.
- **Don't:** touch other guards, the prompt, or other files.
- **Acceptance:** new tests pass; `npm run typecheck` and `npm test` all green.

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
