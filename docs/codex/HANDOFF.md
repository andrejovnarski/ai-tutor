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

### T13 — Recall checks: model, engine, sims
- **Branch:** `codex/recall-checks` (Claude made it; you are on it)
- **Goal:** mastered skills get a two-problem "recall" at growing gaps (1, 3, 7, 21 days) in the review slot,
  scored as a pair; sims prove kept skills climb and forgotten ones return to practice.
- **Context:** spec `docs/superpowers/specs/2026-10-20-recall-checks-design.md` (sections "Learning model" and
  "Session engine"); plan `docs/superpowers/plans/2026-10-20-recall-checks.md` **Task 1** — read both. Files:
  `src/domain/kid/{types,state,next}.ts`, `src/domain/session/{types,engine,testkit}.ts`, `src/domain/sim/bot.ts`.
- **Do:** plan Task 1 Steps 1–6, in order (tests first, watch them fail, then implement). Names and signatures
  exactly as in the plan's Interfaces block. Cover all four Review Focus lines that point at Task 1.
- **Don't:** no db/migration/rows/parent/server/client changes (that is T14). Don't touch the prerequisite
  `check`. Nothing kid-visible. Don't remove or weaken any existing test (rule 9) — if an old test now fails
  because review behaviour changed by design, stop and list it under Open questions instead of editing it.
- **Acceptance:** `npm run typecheck` clean; `npm test` green; new tests named after the plan bullets.

#### Claude rulings (round 2) — answer to your open questions
1. **Old review tests:** do not edit them. Instead `placedKid` in `src/domain/session/testkit.ts` sets every
   placed skill to `checkDue: 8.64e15` (max Date ms = "not due"), so old fixtures keep today's review
   behaviour. New recall tests opt in per skill with `setSkill(k, id, { checkDue: null or a past time, lastSeen: <before start> })`.
   That also isolates your scoring tests from other due skills.
2. **Mapper/fixture:** yes, in T13. `rows.ts`: `SkillRow` gains optional `check_step?`, `check_due?`,
   `remembered_at?`; read with `?? 0` / `?? null`, write all three (ISO ↔ ms). Add the three fields to the
   `bkt.test.ts` fixture. (Migration stays T14.)
3. **No frontier, all due:** when `current` is null (no frontier), a recall may start at any problem, not only
   the slot. Order in that branch: `recallTarget` → `reviewTarget` (skipping due) → end. With a frontier, the
   slot-only rule stays.
4. **Per-answer guess:** change `Session.recall.results` to
   `{ correct: boolean; tag: MistakeTag | null; guess: number }[]` and apply each answer's own guess.
5. **Both wrong must un-master:** after the two BKT updates set `pKnown = Math.min(pKnown, 0.9)`.
6. `Session.ranPlacement?` is fine. Make sure `npm test` finishes (the stall was likely rule 3's case); the full
   suite must end with a count.

#### Codex report (round 1)
- Files changed: `src/domain/kid/{types,state,next,next.test}.ts`, `src/domain/session/{types,engine,engine.test}.ts`, `src/domain/sim/{bot,sim.test}.ts`, and this report. Partial implementation; T13 is not complete. Existing tests were not edited or weakened. No git writes; port 3000 untouched.
- Test results:
  - Tests-first run: `Test Files 3 failed (3)`; `Tests 18 failed | 74 passed (92)`.
  - `npm run typecheck`: `tsc --noEmit` failed with 3 errors: missing required recall fields in `src/domain/kid/bkt.test.ts:33` and `src/server/persist/rows.ts:23`, plus an inferred `lastSeen` type mismatch in `src/domain/session/engine.ts:317`.
  - `npm test`: started; observed 11 failures across engine/adapt/rows, then stalled without a final count; interrupted with exit 130. A diagnostic run excluding sim also stalled and was interrupted.
  - Focused diagnostic run (next, engine, adapt, rows): `Test Files 3 failed | 1 passed (4)`; `Tests 11 failed | 104 passed (115)`; exit 1. Of these, 3 are existing tests and 8 are new recall tests. Full suite is not green; simulations are not verified.
- Choices I made: stopped implementation as explicitly required by T13 when existing review tests conflicted. Added optional `Session.ranPlacement` to preserve placement-session exclusion after placement completes. Added simulation trace events to inspect forgotten skills and partial recalls. Left all persistence, prerequisite-check, and kid-visible code untouched.
- Open questions:
  - T13 explicitly says to stop if old review tests fail by design. Existing `progress summary > counts served review once` expects `review` but gets `recall`; `a wrong review lowers pKnown` also fails under the changed selection. These tests need a lead decision before implementation continues.
  - Required `SkillState` fields cannot typecheck while the out-of-scope persistence mapper and existing BKT fixture omit them. The existing rows round-trip test also fails because the mapper drops the new fields. May the minimal mapper defaults and fixture defaults move into T13, or should these wait for T14?
  - When all mastered skills are due and no frontier exists, skipping every due skill in normal review ends the session before the first review slot. The new all-known simulation then makes no progress. What should fill those initial slots while preserving both no warm-up and recall-only-at-review-slots requirements?
  - Partial work still needs fixes: new scoring tests do not isolate their due skill from other null-due skills; engine `lastSeen` annotation; per-answer guess probabilities for delayed BKT (currently uses the second problem's guess for both); ensuring two misses drop mastery even at near-1 pKnown; legacy-session/default normalization. Do not treat this patch as acceptance-ready.


#### Codex report (round 2)
- Files changed: `src/domain/kid/{types,state,next}.ts`, `src/domain/kid/{next,bkt}.test.ts`, `src/domain/session/{types,engine,testkit}.ts`, `src/domain/session/engine.test.ts`, `src/domain/sim/{bot,sim.test}.ts`, `src/server/persist/{rows,rows.test}.ts`, and `docs/codex/HANDOFF.md` (cumulative T13 changes).
- Test results:
  - Round 2 tests-first run: `Test Files 2 failed (2)`; `Tests 21 failed | 55 passed (76)`.
  - Final `npm run typecheck`: `tsc --noEmit`, exit 0; no errors.
  - Final full `npm test`: `Test Files 82 passed (82)`; `Tests 1365 passed (1365)`; duration 24.69s, exit 0.
  - `git diff --check`: clean. No db/e2e runs.
- Choices I made: applied all six rulings. Existing tests remain unchanged except the authorized testkit and BKT fixture defaults; mapper tests were added. Recall results retain each answer's correctness, mistake tag, and guess probability through JSON reloads. Two misses cap pKnown at 0.9 and refresh the frontier for gentle practice. Added separate simulation learning traces without changing the existing trace semantics. Forgetting simulations isolate three skills in separate runs with 21-day gaps, ensuring recall precedes any prerequisite check; they verify loss of mastery followed by practice. Coverage includes all four Task 1 Review Focus cases, no-frontier recalls, all scoring outcomes, Help 1/2 and retries, old-state defaults, mapper round-trips, and scheduling after re-mastery. No git writes; port 3000 untouched; prerequisite checks and kid-visible code unchanged.
- Open questions: none. T13 is complete. Migration and remaining parent/server work stay in T14.

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
