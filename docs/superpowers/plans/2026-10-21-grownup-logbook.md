# Grown-up Logbook Implementation Plan

> **For agentic workers:** executed by Codex one task at a time through `docs/codex/HANDOFF.md`
> (Claude writes each task there, owns git, runs db/e2e, reviews). Steps use checkbox (`- [ ]`) syntax.

**Goal:** restyle every grown-up page in the calm Pocket Planet "Logbook" look, add the island map to the child
page and mini maps to the your-kids list, and draw rewards as shells and sun dots.

**Architecture:** three new tokens beside the `--pp-*` set; `grownup.module.css` and the shared parts in
`src/app/parent/ui/` switch to them; the map reuses `IslandMap` from `src/app/rewards/` with `progress.map`.

**Tech Stack:** Next.js 16 / React, CSS modules, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-grownup-logbook-design.md`. Mockup (option A):
`.superpowers/brainstorm/1592744-1792531617/content/grownup-look.html`.

## Global Constraints

- Token values exactly: `--pp-page #eef8fb`, `--pp-quiet #3f5a6c`, `--pp-link #1f5fa8`; danger stays `#c3332d` /
  `#8f2420`.
- No `--felt`, `--felt-deep`, `--paper`, `--grid`, `--chalk`, `--sticky` use left in `grownup.module.css` or
  grown-up page files (old tokens stay defined in `tokens.css`; stickers still use felt).
- Body Atkinson 17 px / 1.5; headings Andika; secondary 15 px `--pp-quiet`; lines < 70 ch.
- Targets ≥ 44 px; focus 3 px `--pp-link` outline (offset 2 px) everywhere on grown-up pages.
- One column ≤ 560 px, 20 px gutter, no horizontal scroll at 320 px.
- Pressable = hard ink edge removed on press; no blurred shadows, no gradients.
- No copy, flow, route, API or schema change. Weekly email and sticker art untouched.
- COPPA: nothing new stored, logged or sent; the your-kids page's `kidProgress` uses the existing RLS client.
- Rule 9: no test removed or weakened. Updating an assertion that pins an old colour (e.g. `var(--chalk)`,
  `var(--link)`) to the new token is allowed — say so in the report.

## Review Focus

1. **Rewards off / `kidProgress` returns null** → child page has no map card and no empty gap; your-kids cards
   render without a map. T23 render tests.
2. **Kid with nothing learned / everything learned** → map card label and caption correct ("all islands done",
   no caption). T23 render test.
3. **Long nickname (Alexandrina) at 320 px** in the strip back link, the map card title and the your-kids card →
   no horizontal scroll or clipping. T24 shots.
4. **Keyboard focus on white strip and white cards** → visible `--pp-link` ring, not the old chalk ring that
   vanished on white. T22 CSS test.
5. **Consent page** (uses `IndexCard color="var(--felt)"`) → still renders with no felt anywhere. T22 test.

---

### Task 1 (T22): Tokens and all pages restyled

**Files:**
- Modify: `src/app/play/tokens.css`, `src/app/play/tokens.test.ts`
- Modify: `src/app/parent/ui/grownup.module.css`, `GrownupFrame.tsx`, `IndexCard.tsx`, `StickyNote.tsx`,
  `PinField.tsx`, `src/app/parent/consent/page.tsx` (drop the felt colour arg if needed), other grown-up pages only
  for class names
- Test: `src/app/parent/ui/ui.test.tsx`

**Interfaces:**
- Produces: tokens `--pp-page`, `--pp-quiet`, `--pp-link`. `IndexCard` keeps its props (a `color` prop may be
  ignored).

- [ ] **Step 1: Failing tests**
  - `tokens.test.ts`: the three values; contrast ≥ 4.5 for ink/`--pp-quiet`/`--pp-link` on `--pp-page` and on white.
  - `ui.test.tsx`: `.strip` uses `--pp-white` background and an ink bottom border; `.strip :focus-visible` and
    `.frame :focus-visible` outline colour `var(--pp-link)` (replaces the chalk check, Review Focus 4); `.btn`
    background `var(--pp-go)` and colour `var(--pp-ink)`; `.pinBox:focus-within` outline `var(--pp-link)`;
    `grownup.module.css` contains none of `--felt`, `--paper`, `--grid`, `--chalk`, `--sticky` (Review Focus 5
    via the consent page's `IndexCard` rendering with no felt in its HTML too). Keep the sticky tilt and record
    list wrap checks.
- [ ] **Step 2:** `npm test -- tokens ui` → FAIL.
- [ ] **Step 3:** implement per spec "Look" and the mockup.
- [ ] **Step 4:** `npm run typecheck`, `npm test` green. Claude runs e2e + grown-up shots and shows the owner.

### Task 2 (T23): Map, shells, sun dots

**Files:**
- Modify: `src/app/parent/kids/[kidId]/page.tsx`, `src/app/parent/ui/RewardsSection.tsx`,
  `src/app/parent/ui/Cubes.tsx` (dots look), `src/app/parent/page.tsx`, `grownup.module.css`
- Test: `src/app/parent/ui/ui.test.tsx` (or a new `src/app/parent/kids/[kidId]/page.test.tsx` /
  `src/app/parent/page.test.tsx` in the existing render-test style)

**Interfaces:**
- Consumes: `IslandMap({ map, size, animate })` from `src/app/rewards/IslandMap.tsx`; `Progress.map`;
  `Rod({ look: "shell" })`; `kidProgress(db, kidId, now)` from `src/server/rewards.ts`.
- Produces: `IslandsCard({ nickname, map }: { nickname: string; map: IslandMap })` in
  `src/app/parent/ui/IslandsCard.tsx` — a card titled `{nickname}'s islands` with the full map (no animation).

- [ ] **Step 1: Failing tests**
  - `IslandsCard`: title `Mia's islands`; contains `aria-label="Map: 2 islands done. Now on Adding Island, 3 of 5 flags."`
    for that map; no `data-rise` / `data-sail`; an all-done map shows `Map: all islands done!` and no caption
    (Review Focus 2).
  - Child page: map card rendered first when progress exists, absent when null (Review Focus 1).
  - `RewardsSection`: rod label `N of 10 shells`.
  - `Cubes`: still `role="img"` with the same label and the same filled count / "+N"; marks are round
    (`data-cube` kept so existing tests hold).
  - Your kids: each kid card has a mini map inside an `aria-hidden` wrapper; with `kidProgress` null the card
    still renders the name and link.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement; your-kids loads progress with `Promise.all` like `src/app/page.tsx`.
- [ ] **Step 4:** `npm run typecheck`, `npm test` green. Claude runs db + e2e and shows the owner.

### Task 3 (T24): Grown-up shots and DESIGN.md

**Files:**
- Modify: `tests/e2e/grownup-shots.spec.ts`, `DESIGN.md`

- [ ] **Step 1:** grown-up shots: keep every screen and size; add a child page with flags up (seed `skill_state`
  like `tests/e2e/kid-shots.spec.ts`, `check_due` year 9999) and a your-kids page with two kids incl.
  Alexandrina; at every size assert no horizontal scroll (`scrollWidth <= innerWidth`), no clipped text (SLACK
  guard as in kid-shots), every link/button/input ≥ 44 px tall (Review Focus 3).
- [ ] **Step 2:** DESIGN.md grown-up half rewritten as "The Logbook" (frontmatter tokens and components for the
  grown-up side, Overview line, Colors, Layout, Components: strip, card, button, input, PIN, notes, map card,
  shells, sun dots; Do's/Don'ts: no felt or grid on grown-up pages). Kid half unchanged.
- [ ] **Step 3:** `npm run typecheck`, `npm test` green; Claude runs e2e and db.
