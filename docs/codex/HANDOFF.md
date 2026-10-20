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

### T4 — e2e runs delete their leftover test users first
- **Branch:** `codex/e2e-flakes` (already checked out; builds on T3, not merged yet)
- **Goal:** local e2e runs stay fast forever. Today every e2e run leaves its `@example.com` parents
  behind; `tests/e2e/journey.spec.ts` calls `/api/cron/weekly-report`, which loops over **every**
  consented parent in the local db, so after weeks of runs it hogs the server and other tests time
  out in a batch (owner's db had ~2000 parents; Claude just reset it to 0).
- **Context:** db tests already solve this: `tests/db/globalSetup.ts` (wired in
  `vitest.db.config.ts`) deletes every `@test.dev` auth user before the run, refuses non-local
  Supabase URLs, and pages carefully. E2e users come from `unique()` in `tests/e2e/helpers.ts`
  (`<prefix>-<ts>-<rand>@example.com`). `playwright.config.ts` has no globalSetup.
- **Do:**
  1. Move the cleanup logic into a shared helper (e.g. `tests/helpers/cleanup.ts`,
     `deleteTestUsers(suffix: string)`), keeping the local-only guard and the paging behaviour.
     `tests/db/globalSetup.ts` calls it with `"@test.dev"` — behaviour unchanged.
  2. Add `tests/e2e/globalSetup.ts` that calls it with `"@example.com"` and wire it as
     `globalSetup` in `playwright.config.ts`. Check how the e2e side gets env (Supabase URL and
     secret key) — read `tests/helpers/admin.ts` and match it.
  3. Only users whose email ends with the suffix are deleted. Nothing else.
  4. Unit-test the pure part if there is one (e.g. the filter / local-host guard), else say why not.
- **Don't:** change product code, timeouts, retries, or the journey test's cron call.
- **Acceptance (Claude runs):** `npm run test:db`, then full `npm run test:e2e` twice in a row — both
  green, and the parents count in the local db does not grow between runs beyond one run's worth.

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
