# Pocket Planet Implementation Plan

> **For agentic workers:** executed by Codex one task at a time through `docs/codex/HANDOFF.md`
> (Claude writes each task there, owns git, runs db/e2e, reviews). Steps use checkbox (`- [ ]`) syntax.

**Goal:** restyle the kid side (picker, play, end card) as the Pocket Planet world with a new Nova and a
look-only island map, without changing game logic, routes, schema or Nova's lines.

**Architecture:** new `--pp-*` tokens beside the old ones; kid CSS modules and `Nova` switch to them; a pure
`islandMap()` in the rewards domain feeds one `IslandMap` SVG part used small on picker cards and large on the
end card. The reward rows read gains `placed`.

**Tech Stack:** Next.js 16 / React, CSS modules, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-pocket-planet-design.md` (token table, Nova, screens, map rules,
label wording). Mockups: `.superpowers/brainstorm/1592744-1792531617/content/screens.html`, `nova.html`,
`map-shape.html` (option A) — read them before T18 and T20.

## Global Constraints

- Hex values, token names and island names exactly as in the spec tables.
- Text is always `--pp-ink` on a light ground; no white text; no text directly on `--pp-sea-deep`.
- Kid text ≥ 22 px; kid chrome ("Grown-ups", "I'm done for now", picker level line) ≥ 18 px.
- Targets: ≥ 88 px at tablet; phone (≤ 600 px) tiles ≥ 72 px tall, keys ≥ 64 px.
- Pressable = 3 px ink border + hard unblurred ink bottom edge removed on press. No soft shadows, glow,
  glassmorphism or gradients except the sky.
- Counter red/yellow/blue/green only inside maths pictures (plus the mic's red while listening). Red never marks
  wrong.
- Every animation has a `prefers-reduced-motion: reduce` still state.
- No change to: game engine, grading, server routes' behaviour, DB schema, Nova's lines, reward rules or
  wording, grown-up pages other than Nova.
- COPPA: nothing new stored, logged or sent. Only the `placed` column is newly read, through the existing
  RLS-scoped client.
- Never remove or weaken a test (HANDOFF rule 9). Existing exact-object expectations of `progress()` /
  `endRewards()` may add the new `map` field — that is allowed, not weakening.

## Review Focus

1. **Kid placed past everything / mastered everything** → boat `{ done: true }`, label `Map: all islands done!`,
   end card still fits on phone. T19 unit + T21 kid-shot.
2. **Skill sent back to practice by a recall** (row has `mastered_at`, `p_known` now low) → its flag stays up.
   T19 unit.
3. **Rewards off or the rewards read times out** → picker cards and end card render with no map and no gap or
   crash. T20 render tests.
4. **Reduced motion** → end card shows all flags up and the boat in place at first paint; Nova shows no stars or
   spin. T21 kid-shot with `page.emulateMedia({ reducedMotion: "reduce" })`.
5. **Long nickname + map on a 156 px phone picker card** → nothing clipped (SLACK guard). T21 kid-shots
   (Alexandrina at `phone`).

---

### Task 1 (T18): Tokens, Nova, play screen

**Files:**
- Modify: `src/app/play/tokens.css` (add `--pp-*`; keep all existing tokens)
- Modify: `src/app/play/Nova.tsx`, `src/app/play/play.module.css`, `LineBubble.tsx`, `AnswerTray.tsx`,
  `NumberPad.tsx`, `ConnectionNotice.tsx`, `Board.tsx`, `PlayScreen.tsx` (class names / props only)
- Modify: `src/app/play/visuals/*.tsx` (line colour `var(--chalk)` → `var(--pp-ink)` on the board)
- Create: `src/app/play/tokens.test.ts`
- Test: `src/app/play/Nova.test.tsx`, `src/app/play/screen.test.tsx`

**Interfaces:**
- Produces: `Nova({ tone, hop, burst }: { tone: NovaTone; hop?: boolean; burst?: boolean })` — `burst` renders the
  ring spin + 3–5 stars (`data-burst="true"` on the root); PlayScreen sets it for the turn right after a correct
  first or second try. `NovaTone` unchanged. Tokens `--pp-sky`, `--pp-sky-deep`, `--pp-sea`, `--pp-sea-deep`,
  `--pp-sand`, `--pp-grass`, `--pp-ink`, `--pp-white`, `--pp-go`, `--pp-sun`, `--pp-nova`.

- [ ] **Step 1: Failing tests**
  - `tokens.test.ts`: read `tokens.css` as text, parse the `--pp-*` hex values, assert each equals the spec table,
    and assert WCAG contrast ≥ 4.5 for `--pp-ink` on each of `sky, sky-deep, sand, white, go, sun, grass, sea`
    (compute relative luminance in the test).
  - `Nova.test.tsx`: keep existing mood tests; add: root has `role="img"` name `Nova`; `burst` → `data-burst="true"`
    and stars present; no `burst` → no stars; the body uses `var(--pp-nova)`.
  - `screen.test.tsx`: after a correct answer the Nova in the top band has `data-burst="true"`; after a wrong one
    it does not.
- [ ] **Step 2:** run `npm test -- tokens Nova screen` → FAIL.
- [ ] **Step 3:** implement per spec "Look", "Nova", "Play". Draw Nova from `nova.html` option A (viewBox may
  change; keep `data-eye="l|r"`). Board: sand, 4 px ink outline, grass rim, no inset shadow or dot nap. Tray:
  `--pp-sea-deep` with a still wave edge. Mic rest `--pp-go`, listening counter red, thinking `--pp-sea`.
  Reduced motion: no hop/spin/stars.
- [ ] **Step 4:** `npm run typecheck`, `npm test` green. Claude runs `npm run test:e2e` (kid-shots must stay green
  for the play screens) and sends screenshots to the owner.

### Task 2 (T19): Map rules, data, IslandMap part

**Files:**
- Create: `src/domain/rewards/map.ts`, `src/domain/rewards/map.test.ts`
- Modify: `src/domain/rewards/progress.ts` (`progress`, `endRewards` gain `placed`, return `map`)
- Modify: `src/server/rewards.ts` (`loadRewardRows` reads `placed`)
- Create: `src/app/rewards/IslandMap.tsx`, `src/app/rewards/IslandMap.test.tsx`; Modify `rewards.module.css`
- Test: `src/domain/rewards/progress.test.ts`, the existing `loadRewardRows` test file (db test if that is where it
  lives — Claude runs it)

**Interfaces:**
- Produces:
  - `type IslandMap` and `islandMap(masteredAt: MasteredAt, placed: ReadonlySet<string>, learnedNow: readonly string[]): IslandMap` and `ISLAND_NAMES: Record<string, string>` exactly as in the spec.
  - `progress(sessions, masteredAt, now, placed: ReadonlySet<string> = new Set()): Progress` with `Progress.map: IslandMap` (`learnedNow = []`).
  - `endRewards(sessions, masteredAt, now, placed = new Set()): EndRewards | null` with `EndRewards.map` (`learnedNow` = the latest finished session's `mastered`).
  - `RewardRows.placed: string[]`; `kidProgress` / `kidEndRewards` pass `new Set(r.placed)`.
  - `IslandMap({ map, size, animate }: { map: IslandMap; size: "mini" | "full"; animate?: boolean })` (component
    name `IslandMap`; import the type as `IslandMap as IslandMapData`). DOM: each flag `data-flag="up|down"`,
    new flags `data-new="true"`, the boat `data-boat`; animated new flags/boat carry `data-rise` / `data-sail`
    only when `animate`.

- [ ] **Step 1: Failing tests**
  - `map.test.ts`: no rows → 8 islands with names from the spec table, 33 flags all down, boat `{island:0, flag:0}`;
    `masteredAt` for all `count-to-20` skills + `placed` for `compare-numbers.*` → those up, boat at island 2 flag 0;
    a skill in `masteredAt` stays up whatever else (recall case, Review Focus 2); `isNew` true only for up skills in
    `learnedNow`, false for a `learnedNow` id that isn't up; all 33 up → `{ done: true }` (Review Focus 1);
    unknown ids in all three inputs ignored.
  - `progress.test.ts`: `progress(...).map` and `endRewards(...).map.islands[*].flags[*].isNew` match the latest
    session's `mastered`.
  - `loadRewardRows`: a `placed` row without `mastered_at` is returned in `placed`, not in `masteredAt`.
  - `IslandMap.test.tsx`: label `Map: 2 islands done. Now on Adding Island, 3 of 5 flags.` for that case;
    `Map: all islands done!`; mini has no visible text, full shows the boat's island name; `animate` false → no
    `data-rise` / `data-sail`.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement. Query: `.select("skill_id, mastered_at, placed").or("mastered_at.not.is.null,placed.eq.true")`.
  Island positions are fixed constants in `IslandMap.tsx` (viewBox 400 × 160, layout of `map-shape.html` A).
  Flag rise / boat sail are CSS animations with delays (≤ 2 s total), still under reduced motion.
- [ ] **Step 4:** `npm run typecheck`, `npm test` green; Claude runs `npm run test:db`.

### Task 3 (T20): Picker and end card

**Files:**
- Modify: `src/app/page.tsx`, `src/app/picker.module.css`, `src/app/MiniRewards.tsx`
- Modify: `src/app/play/EndCard.tsx`, `src/app/play/RewardsStrip.tsx`, `src/app/rewards/Rod.tsx`,
  `src/app/rewards/WeekDots.tsx`, `src/app/rewards/rewards.module.css`, `src/app/play/play.module.css`
- Test: `src/app/rewards/rewards.test.tsx`, `src/app/play/screen.test.tsx` (or the existing end-card test file)

**Interfaces:**
- Consumes: `IslandMap` part, `Progress.map`, `EndRewards.map` (T19); tokens and `Nova` (T18).
- Produces: `Rod({ ..., look?: "cube" | "shell" })` — default `"cube"` (grown-up child page unchanged); `"shell"`
  draws shells and labels `N of 10 shells`.

- [ ] **Step 1: Failing tests**
  - `MiniRewards`: renders a mini `IslandMap` and the text `Level N`, no week dots; the card's accessible name still
    starts with the nickname.
  - `Rod` `look="shell"` → label `3 of 10 shells`; default label unchanged (`… cubes`).
  - End card with rewards → a full `IslandMap` with `animate` before the stats; without rewards → no map, stats and
    buttons still there (Review Focus 3). Picker with `progress` null → card renders with name only.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement per spec "Picker" and "End card" and `screens.html`. Picker level line:
  `Level N · ` + small shell icon + `K of 10` (≥ 18 px). Empty state "Add your first kid" becomes a white kid
  button. On phone the end-card map shrinks first so the card fits.
- [ ] **Step 4:** `npm run typecheck`, `npm test` green. Claude runs e2e and sends screenshots to the owner.

### Task 4 (T21): kid-shots, DESIGN.md, grown-up Nova

**Files:**
- Modify: `tests/e2e/kid-shots.spec.ts`
- Modify: `DESIGN.md` (frontmatter colours/components for the kid side; "Overview" and kid sections rewritten as
  "The Pocket Planet"; grown-up sections kept; Do's/Don'ts updated: no felt on kid side, island map rules)
- Check only: `src/app/parent/ui/GrownupFrame.tsx`, `src/app/sign-in/page.tsx` render the new Nova at 32 / 96 px

- [ ] **Step 1:** kid-shots: keep every existing screen and size; add picker with maps for all three kids, end
  card with ≥ 1 new flag (seed a session whose `mastered` lists a mastered skill), end card with every skill
  mastered (Review Focus 1), and the end card under `reducedMotion: "reduce"` asserting no element has a running
  animation and every `[data-new]` flag is `data-flag="up"` (Review Focus 4). Keep the SLACK clipping guard on all
  new screens (Review Focus 5) and the ≥ 88 / 72 / 64 px target checks.
- [ ] **Step 2:** DESIGN.md as above, values copied from the spec.
- [ ] **Step 3:** `npm run typecheck`, `npm test` green; Claude runs `npm run test:e2e` and `npm run test:db`.
