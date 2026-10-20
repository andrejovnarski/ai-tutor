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

### T20 — Pocket Planet: picker and end card
- **Branch:** `codex/pocket-planet` (T18, T19 committed; you are on it)
- **Goal:** the picker and end card are in the Pocket Planet look. Each picker card shows a mini island map and
  "Level N · shells K of 10"; the end card shows the full map as its hero (new flags rise, boat sails), then the
  numbers, +XP with a shell rod, stickers and week dots.
- **Context:** plan `docs/superpowers/plans/2026-10-20-pocket-planet.md` **Task 3** (Interfaces: `Rod` gains
  `look`); spec "Picker" and "End card"; mockup panels 1 and 3 in
  `.superpowers/brainstorm/1592744-1792531617/content/screens.html` (read as text). Parts from T19:
  `src/app/rewards/IslandMap.tsx` (`IslandMap({ map, size, animate })`), `Progress.map`, `EndRewards.map`.
  Tokens and `Nova` from T18 (`src/app/play/tokens.css`, `src/app/play/Nova.tsx`).
- **Do:**
  1. Failing tests first, per plan Task 3 Step 1.
  2. Picker (`src/app/page.tsx`, `picker.module.css`, `MiniRewards.tsx`): sky ground with a still sea strip, white
     cards with ink border + hard ink edge, avatar in a sky circle, mini map, level line (≥ 18 px), no week dots.
     Empty state "Add your first kid" as a white kid button. Phone: two cards a row as today, nothing clipped.
  3. End card (`EndCard.tsx`, `RewardsStrip.tsx`, `Rod.tsx` `look="shell"`, `WeekDots.tsx` played dots
     `--pp-sun`, `play.module.css`, `rewards.module.css`): white card on sky, full `IslandMap` with `animate`
     right under the title, "Play again" `--pp-go` with ink text, "Back to kids" white. On phone the map shrinks
     first so the card fits.
  4. **Claude ruling (T19 review):** the full map's island name must stay ≥ 22 px on a phone, so move it out of
     the SVG: `IslandMap` size `"full"` renders the SVG plus an HTML caption under it (the boat's island name; none
     when done). Keep the SVG's `role="img"` label as is. Adjust the T19 test that looks for the name only so it
     finds it in the caption — don't drop the check.
  5. Grown-up child page keeps cubes (`Rod` default look) — don't change it.
- **Don't:** no domain/server changes, no Nova line changes, no grown-up page changes. Rule 9 applies.
- **Acceptance:** `npm run typecheck` clean; `npm test` green with a final count. Claude runs e2e/kid-shots and
  shows the owner screenshots.


#### Codex report
- Files changed:
  - `src/app/MiniRewards.tsx`, `src/app/picker.module.css`, `src/app/page.test.tsx`: sky picker, still sea, white cards, mini maps, shell counts, nickname-first and null-progress tests.
  - `src/app/play/EndCard.tsx`, `RewardsStrip.tsx`, `play.module.css`, `screen.test.tsx`: animated hero map before progress/stats, shell rewards, orange/white actions, no-rewards fallback checks.
  - `src/app/rewards/IslandMap.tsx`, `IslandMap.test.tsx`, `Rod.tsx`, `rewards.module.css`, `rewards.test.tsx`: HTML island caption, shell look, sun week dots, responsive map sizing and tests.
- Test results:
  - Tests written first: targeted run failed (`6 failed | 62 passed`) before implementation.
  - `npm run typecheck`: `> tsc --noEmit` — exit 0, no errors.
  - `npm test`: `Test Files 87 passed (87)`; `Tests 1422 passed (1422)` — exit 0.
  - `git diff --check`: clean.
- Choices I made:
  - Picker shell counts use an accessible shell icon and 18 px text; long lines wrap within two phone columns.
  - Full maps use a 22 px HTML figcaption, preserving the SVG image label; completed maps omit the caption.
  - Map artwork can shrink before the rest of the end card; the caption keeps its reading size.
  - Rod defaults remain cubes; shell slots preserve the existing fill/drop timing and reduced-motion behavior.
  - Updated old picker/strip expectations for the explicitly requested appearance; kept default cube, fallback and layout checks.
- Open questions: None. Browser fit and screenshot verification remain for Claude's e2e/kid-shots run. No network, git writes, db/e2e runs, port 3000 access, or edits to `.impeccable/config.json` / `.superpowers/`.

#### Fix round 1 (Claude, after e2e + screenshots)
Claude updated two e2e specs to the new words only (`Lv` → `Level`, kid strip `cubes` → `shells`); e2e 66 green.
But the screenshots show real problems — look at `test-results/kid/*-6-end-card.png`, `*-6a-*`, `*-6b-*`:
1. **The end-card map is invisible** — it collapses to a 1 px line (`.mapHero .mapFull { min-height: 0; flex: 1 1 auto }`),
   only the caption shows. The map is the hero. Required rendered height of the map SVG: **≥ 140 px** at
   `landscape`, `portrait`, `pro`; **≥ 90 px** at `phone`, `small`, `mid`. To make room, re-lay the card body like
   the mockup panel 3: on wide screens put the two counts and "+75 + shell rod" in **one row**, then a second row
   with sticker(s) and week dots + week line; on phone keep stacking but tighten gaps. The card must still fit with
   no clipping (existing kid-shots guards). If it truly cannot fit, stop and ask — don't shrink the map below the floor.
2. **Picker name breaks mid-word** on phone ("Alexandrin / a"). Never break inside a word: on narrow cards the
   name may drop to 22 px (`--text-s`) and wrap only between words; if still too long it ellipsizes on one line.
3. **Picker level line wraps badly** ("0 of / 10"). Keep `Level N` and `🐚 K of 10` each unbroken
   (`white-space: nowrap` per part); they may sit on two lines.
4. **Guard it:** in `tests/e2e/kid-shots.spec.ts` add assertions for item 1 (map `svg[role=img][aria-label^="Map:"]`
   bounding box height per size above, on every end-card screen) and item 2 (each picker card name element:
   `scrollWidth <= clientWidth` and no line break inside a word — assert the name's rendered text has the same
   number of lines as words would allow, or simply that its height ≤ 2 × line-height at 22 px). Claude runs them.


#### Codex report — fix round 1
- Files changed:
  - `src/app/page.tsx`, `page.test.tsx`, `MiniRewards.tsx`, `picker.module.css`: dedicated nickname element with one-line ellipsis, plus unbroken level and shell-count phrases.
  - `src/app/play/EndCard.tsx`, `RewardsStrip.tsx`, `play.module.css`: counts/XP row above stickers/week, compact spacing and responsive actions.
  - `src/app/rewards/rewards.module.css`, `rewards.test.tsx`, `IslandMap.test.tsx`: explicit SVG height floors and layout regressions.
  - `tests/e2e/kid-shots.spec.ts`: map-height guards on every end-card capture and nickname width/height guards on picker captures.
  - `docs/codex/HANDOFF.md`: this report.
- Test results:
  - Tests first: `4 failed | 34 passed` before implementation.
  - `npm run typecheck`: `> tsc --noEmit` — exit 0, no errors.
  - `npm test`: `Test Files 87 passed (87)`; `Tests 1425 passed (1425)` — exit 0.
  - `git diff --check`: clean.
- Choices I made:
  - Map SVGs have explicit 140 px height/min-height above 700 px and 90 px below, preserving the 22 px caption.
  - Wide cards group counts and XP together, then stickers/week; phones stack body groups and share the action row to preserve map space and 72 px button heights.
  - Smaller sticker artwork, shell slots, week dots and gaps make room without reducing child text below its existing floors.
  - Names retain their complete accessible text while long visible names ellipsize; level/count phrases wrap only as whole parts.
  - Kept Claude's e2e wording updates and all existing clipping/fit checks.
- Open questions: None. Rendered fit still needs Claude's e2e/kid-shots run: an isolated local Chromium preview could not launch because the sandbox rejected it (`Operation not permitted`). No db/e2e suites, network, git writes or port 3000 access; protected paths left untouched.

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
