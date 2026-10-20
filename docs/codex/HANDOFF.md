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

### T21 — Pocket Planet: kid-shots, DESIGN.md, grown-up Nova
- **Branch:** `codex/pocket-planet` (T18–T20 committed; you are on it)
- **Goal:** browser screenshots and guards cover the map with real flags, the map moment, "all islands done"
  and reduced motion; DESIGN.md describes the Pocket Planet kid side.
- **Context:** plan `docs/superpowers/plans/2026-10-20-pocket-planet.md` **Task 4** and its Review Focus 1, 4, 5;
  spec (all of it — DESIGN.md copies its values). Seeding patterns: `tests/e2e/kid-shots.spec.ts` (kids, SIZES,
  SLACK), `tests/e2e/fill-frame.spec.ts` (seeding `skill_state` with `admin()`; mastered rows need
  `p_known >= 0.95` and `attempts >= 5` so the DB trigger sets `mastered_at`; known-at-start rows use
  `placed: true`; always set `check_due` year 9999 so no recall starts), `tests/e2e/rewards.spec.ts`
  (`finishSession`, reduced-motion check with `getAnimations`).
- **Do:**
  1. kid-shots, every size: picker where Theo has all of Counting Cove + Compare Cliffs learned and two Adding
     Island skills placed (so his mini map shows flags), Alexandrina has **every** skill learned; end card for
     a kid whose finished session's `state.mastered` lists a skill that has a `mastered_at` (≥ 1 `[data-new="true"]`
     flag, `data-flag="up"`); end card for the all-learned kid with label `Map: all islands done!`. Keep the map
     height floors, name-wrap and SLACK guards on all these screens.
  2. One reduced-motion test (one size is enough): `page.emulateMedia({ reducedMotion: "reduce" })`, end card with
     new flags → no running animations inside the map and Nova (`getAnimations({ subtree: true })` length 0), and
     every `[data-new="true"]` flag is `data-flag="up"`.
  3. DESIGN.md: rewrite the kid half as "The Pocket Planet" (frontmatter colours/components for kid tokens
     `--pp-*`, Overview, Colors, kid Typography notes, Layout for picker/play/end card, Elevation (hard ink edge),
     Components: Nova (planet, moods, burst), island map, shell rod, tiles, mic). Keep the grown-up half and its
     tokens as they are, and say the grown-up side still uses the exercise book. Update Do's/Don'ts (no felt on
     the kid side; map flags never come down; text always ink on light; no text on `--pp-sea-deep`).
  4. Check `src/app/parent/ui/GrownupFrame.tsx` and `src/app/sign-in/page.tsx` still render Nova at 32 / 96 px
     with no clipping (an existing grown-up screenshot test may already cover it — if so, just say so).
- **Don't:** no app code changes unless a test you write proves a real bug — then stop and describe it under
  "Open questions" instead of fixing. Rule 9 applies. You can't run e2e — write carefully; Claude runs it.
- **Acceptance:** `npm run typecheck` clean; `npm test` green with a final count. Claude runs e2e and db.

#### Codex report
- Files changed: `tests/e2e/kid-shots.spec.ts`, `DESIGN.md`, `docs/codex/HANDOFF.md`.
- Test results:
  - `npm run typecheck`: `> tsc --noEmit` — exit 0, no errors.
  - `npm test`: `Test Files  87 passed (87)`; `Tests  1425 passed (1425)` — exit 0.
  - `git diff --check`: clean. E2E and DB tests not run, as instructed; screenshot rendering/clipping awaits Claude's run.
- Choices I made:
  - Preserved all existing screenshot flows and assertions. Added partial/all-learned picker maps and new-flag/all-done end cards at all six sizes; the landscape case also checks reduced motion for both map and Nova and saves a screenshot.
  - Added cases after existing play screenshots. Reset only Theo/Alexandrina's synthetic skill rows for exact fixtures, let the mastery trigger set `mastered_at`, set placed flags explicitly, and put recall checks in year 9999. Finished real engine session states with seeded `mastered` lists.
  - Reused map-height/name guards and added SLACK ancestor-clipping and end-card-area fit checks to shared screenshots. Picker vertical scrolling remains allowed.
  - Rewrote kid design guidance with the spec's Pocket Planet values, preserving grown-up exercise-book tokens and treatments. No app code, git writes, network, port 3000 activity, or edits to `.impeccable/config.json` / `.superpowers/`.
- Open questions:
  - `GrownupFrame.tsx` still renders its local robot `NovaMark` (antenna/visor), not the planet Nova. CSS sizes are 32 px / 96 px, and sign-in uses the 96 px bare frame. Existing `grownup-shots.spec.ts` covers sign-in, check-email and strip pages at four sizes, but only guards page horizontal overflow; it does not assert planet artwork or Nova clipping. Left app code unchanged per T21's check-only restriction; a follow-up is needed for planet Nova on grown-up pages. Browser clipping remains unverified here.

#### Fix round 1 (Claude, after e2e)
Your new shots found a real bug: at `landscape` (1024 × 768) the end card with **three new stickers** overflows its
area (`11-end-card-new-flags`, `11a-end-card-reduced-motion` → "end card scrolls inside its area"). See
`test-results/kid/landscape-11-end-card-new-flags.png`: sticker labels wrap to two lines ("Count to / 10") and the
map's sea box is much wider than its art. You may change app CSS for this (only `src/app/play/play.module.css`,
`src/app/rewards/rewards.module.css`, and markup in `EndCard.tsx` / `RewardsStrip.tsx` if needed):
1. On wide screens, sticker labels stay on one line (sticker width follows its label; ≥ 22 px text).
2. The full map's frame follows the art's 400:160 aspect — no extra sea left and right; keep the height floors.
3. If it still overflows, tighten vertical gaps in the end-card body on wide screens (not the 88 px buttons, not
   the map floor, not text sizes).
Every existing guard must stay. Also: Claude swapped the grown-up `NovaMark` to the planet Nova and removed the
now-dead antenna CSS + its one assertion — don't touch `GrownupFrame.tsx`.

#### Codex report — fix round 1
- Files changed: `src/app/rewards/rewards.module.css`, `docs/codex/HANDOFF.md`.
- Test results:
  - `npm run typecheck`: `> tsc --noEmit` — exit 0, no errors.
  - `npm test`: `Test Files  87 passed (87)`; `Tests  1425 passed (1425)` — exit 0.
  - `git diff --check`: clean. DB/e2e not run; port 3000 untouched.
- Choices I made:
  - Above 600 px, end-card sticker widths follow their labels with no text wrapping; the sticker list can wrap whole stickers. Kept the existing ≥ 22 px label size and phone styling.
  - Sized the full map frame to 350 × 140 px, or 225 × 90 px at the existing ≤ 700 px breakpoint, matching the art's 400:160 aspect and preserving both height floors.
  - Did not tighten vertical gaps: removing the extra sticker-label line saves one 28.6 px line in the supplied landscape case. Button heights and all text sizes stay unchanged. Browser fit still needs Claude's e2e rerun.
  - No markup or test changes. Kept all existing guards, kid-shots/DESIGN.md work and Claude's grown-up Nova changes; protected paths untouched.
- Open questions: None about implementation. Claude must rerun the existing screenshot guards to confirm landscape fit and other sizes; I could not verify browser layout under the no-e2e/no-network restriction.

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
| T18 — Pocket Planet: tokens, Nova, play screen | `codex/pocket-planet` | (this commit) | First try. Claude fix: ink casing on the number-line jump (yellow on sand too faint). unit 1408, e2e 66 |
| T19 — Pocket Planet: map rules, data, IslandMap | `codex/pocket-planet` | (this commit) | First try. Claude fixes: "1 island" label, flags grow from their foot, db test for placed rows. unit 1419, db 136 |
| T20 — Pocket Planet: picker and end card | `codex/pocket-planet` | (this commit) | 1 fix round: end-card map collapsed to a line → height floors (140/90 px) + e2e guards; names broke mid-word → ellipsis; level line kept whole. Claude moved e2e wording Lv→Level, cubes→shells. unit 1425, e2e 66 |
| T21 — Pocket Planet: kid-shots, DESIGN.md | `codex/pocket-planet` | (this commit) | 1 fix round: 3 stickers overflowed landscape end card → one-line labels, map frame fits art. Claude fixes: grown-up NovaMark → planet (dead antenna CSS + its assertion removed), phone stickers/week stacked (overlapped). unit 1425, db 136, e2e 66 |
