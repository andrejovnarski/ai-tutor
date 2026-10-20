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

### T22 — Grown-up Logbook: tokens and all pages restyled
- **Branch:** `codex/grownup-logbook` (you are on it)
- **Goal:** every grown-up page (sign-in, check email, privacy, consent, PIN set/unlock, your kids, add child,
  child page, account) uses the calm Logbook look: pale sky page, white strip, white cards with thin ink border
  and hard ink edge, orange buttons with ink text, blue links and focus rings. No felt green, no squared paper.
- **Context:** plan `docs/superpowers/plans/2026-10-21-grownup-logbook.md` **Task 1** (read Global Constraints and
  Review Focus); spec `docs/superpowers/specs/2026-10-21-grownup-logbook-design.md` "Look". Mockup option A in
  `.superpowers/brainstorm/1592744-1792531617/content/grownup-look.html` (read as text). Parts:
  `src/app/parent/ui/*`. Kid tokens already exist in `src/app/play/tokens.css`.
- **Do:**
  1. Failing tests first (plan Task 1 Step 1).
  2. Add the three tokens; restyle `grownup.module.css` and the parts; drop the felt tab on the consent page's card.
  3. Every press move / transition gets a still `prefers-reduced-motion` state.
- **Don't:** no map, shells or sun dots yet (T23); no copy or flow changes; don't touch the weekly email or
  sticker art; no new dependencies. Rule 9 — replacing an assertion's old token with the new one is fine, list it.
- **Acceptance:** `npm run typecheck` clean; `npm test` green with a final count. Claude runs e2e + grown-up shots.

#### Codex report
- Files changed: `src/app/play/tokens.css`, `src/app/play/tokens.test.ts`; `src/app/parent/ui/grownup.module.css`, `GrownupFrame.tsx`, `IndexCard.tsx`, `ui.test.tsx`; `src/app/parent/consent/page.tsx`, `src/app/parent/page.tsx`; this handoff.
- Test results:
  - Tests first: `npm test -- tokens ui` → `Tests 13 failed | 45 passed (58)`; after implementation → `Test Files 4 passed (4)`, `Tests 58 passed (58)`.
  - `npm run typecheck` → `tsc --noEmit`, exit 0 (no errors).
  - `npm test` → `Test Files 87 passed (87)`, `Tests 1436 passed (1436)`.
  - `git diff --check` → clean. No db/e2e runs, network, git writes or port 3000 access. Existing `.impeccable/config.json` and `.superpowers/` changes left alone.
- Choices I made: kept `IndexCard.color` accepted but ignored; replaced its old colour-presence assertion with no-tab/no-colour assertions, and updated old PIN/link and strip/chalk focus assertions to `--pp-link` as authorized. Used a still decorative SVG sea wave on bare pages, and hard-line PIN dividers instead of a gradient. Linked cards share the button press treatment and reduced-motion still state. Shared CSS restyles every listed page; maps, shells and sun dots remain for T23.
- Open questions: none. Claude still needs to run e2e and grown-up screenshots for visual review.

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
| T22 — Grown-up Logbook: tokens and pages | `codex/grownup-logbook` | (this commit) | First try. Old colour assertions moved to new tokens (allowed). unit 1436, e2e 66, grown-up shots 4 |
