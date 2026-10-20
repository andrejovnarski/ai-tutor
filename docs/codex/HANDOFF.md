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

### T2 — Placement: cap the jump per probe
- **Branch:** `codex/placement-step-cap` (already checked out, from `main`)
- **Goal:** one passed (or failed) placement probe moves the search at most 6 skills. Today a
  kindergarten kid who passes the first probe (skill 0) jumps to skill 16
  (`add-subtract-within-20.make-ten`, e.g. 7+6) as their 3rd problem. After the fix they get skill 6
  (`add-within-10.pictures`). Owner chose this small fix; full branch-aware placement (roadmap §5)
  comes later, after pilot data.
- **Context:** `src/domain/kid/placement.ts` (binary search over `SKILLS`, 33 skills, 5 probes of 2
  problems). `recordPlacement` sets `mid = floor((lo + hi) / 2)`. Tests: `src/domain/kid/placement.test.ts`,
  placement accuracy sims in `src/domain/sim/sim.test.ts` (lines ~19–35).
- **Do:**
  1. Tests first in `placement.test.ts`:
     - K kid passes probe 1 → next probe is `SKILLS[6]`, not `SKILLS[16]`.
     - Grade-2 kid (starts at index 24) fails probe 1 → next probe is index 18, not 11.
     - For any pass/fail sequence, consecutive probe indices differ by ≤ 6 and stay within `[lo, hi]`
       (loop over all 2^5 outcome sequences for each grade K/1/2).
     - Run them; confirm they fail.
  2. Add `export const MAX_STEP = 6;` and in `recordPlacement` clamp the new `mid` to
     `[p.mid - MAX_STEP, p.mid + MAX_STEP]` (and still within `[lo, hi]`). Nothing else changes:
     `PlacementState` shape, probe count, `finishPlacement` stay the same, so saved placement state in
     the db stays valid.
  3. Keep the existing sim tests in `sim.test.ts` passing **unchanged** (my hand check says they
     should: a K bot knowing 28 skills reaches index 25). If one fails, don't edit it — report the
     numbers under Open questions.
  4. Update the comment at the top of `placement.ts` to say the search is step-capped.
- **Don't:** change grade start points, probe count, `bkt.ts`, engine, UI, or the roadmap doc.
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
| T1 — "-es" plurals in number guard | `codex/es-plurals` | 0b6e0d4 | Done first try; unit 1214 green, typecheck clean |
