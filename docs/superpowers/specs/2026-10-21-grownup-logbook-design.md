# Grown-up Logbook: the grown-up side in the Pocket Planet world

Date: 2026-10-21. Follows `docs/superpowers/specs/2026-10-20-pocket-planet-design.md` (kid side, merged). Built by
Codex task by task through `docs/codex/HANDOFF.md`; Claude reviews and runs db/e2e. Mockup:
`.superpowers/brainstorm/1592744-1792531617/content/grownup-look.html` (option A).

## Problem

The kid side is now the Pocket Planet (sky, sand, ink, orange, planet Nova, island map). The grown-up side is
still the "exercise book" (felt green strip and buttons, squared paper, index cards with a coloured side tab,
maths cubes). The two halves no longer look like one product, and parents can't see the child's island journey.

## Decisions (owner, 2026-10-21)

1. **A calm version of the same world** ("Logbook"), not the playful kid look: grown-ups read consent and privacy
   text here.
2. **Look A (Logbook):** pale sky page, white top strip, white cards with a thin ink border and a small hard edge.
3. **All grown-up pages** change (list below). The child page gets the island map as its first card; the "Your
   kids" list gets a mini map per kid.
4. Rewards on the grown-up side match the kids: **shells** for the level rod, **sun dots** for days played.
5. **Weekly email is out of scope** (separate HTML template, later).

## Pages

`src/app/sign-in/page.tsx` (sign in, check your email), `src/app/parent/privacy/page.tsx`,
`src/app/parent/consent/page.tsx`, `src/app/parent/pin/page.tsx` (set PIN, unlock),
`src/app/parent/page.tsx` (your kids; also the home before consent), `src/app/parent/kids/new/page.tsx`,
`src/app/parent/kids/[kidId]/page.tsx` (child page), `src/app/parent/account/page.tsx`. Shared parts in
`src/app/parent/ui/` (`GrownupFrame`, `IndexCard`, `StickyNote`, `PinField`, `Cubes`, `RewardsSection`,
`grownup.module.css`) and `src/app/parent/kids/[kidId]/WeekSummary.tsx`.

## Look

New tokens in `src/app/play/tokens.css` (the `--pp-*` kid tokens are reused as they are):

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `--pp-page` | `#eef8fb` | grown-up page ground | ink 12.3 |
| `--pp-quiet` | `#3f5a6c` | secondary text (15 px) | 6.7 on page, 7.3 on white |
| `--pp-link` | `#1f5fa8` | links, focus ring on light | 6.0 on page, 6.4 on white |

- **Danger** keeps `--danger` `#c3332d` / `--danger-deep` `#8f2420` (white text 5.5), only for final delete.
- **Type:** headings Andika (sizes as today: 48 / 32 / 21), body Atkinson Hyperlegible 17 px / 1.5, labels 15 px.
  Lines < 70 characters.
- **Layout:** one column, max 560 px, 20 px gutter, works from 320 px; spacing steps as today.
- **No felt green, no squared-paper grid, no index-card side tab** anywhere on grown-up pages. The old felt /
  paper / grid tokens stay defined (stickers still use `--felt*`) but grown-up CSS no longer uses them.

Parts:
- **Top strip:** white, 2 px ink bottom border, planet Nova 32 px, "For grown-ups" in bold Andika ink, back link
  in ink (15 px, ≥ 44 px tall). Focus: 3 px `--pp-link` outline.
- **Bare head** (sign-in, check your email): planet Nova 96 px, "Brightling AI" 48 px Andika in ink, and a still sea
  wave (`--pp-sea`) along the bottom of the page.
- **Card** (`IndexCard`): white, 1.5 px ink border, 14 px radius, `box-shadow: 0 3px 0 var(--pp-ink)`, 12 × 16 px
  padding. The `color` prop no longer draws a tab (keep the prop so callers compile; it may be ignored).
- **Button** (`.btn`): `--pp-go` with ink text, 2 px ink border, 12 px radius, ≥ 44 px tall, hard ink edge 3 px that
  goes away as it moves down 3 px on press (no move under reduced motion). **Danger** (`.btnDanger`): `--danger`
  with white text, `--danger-deep` edge. **Link button:** `--pp-link`, underlined, ≥ 44 px.
- **Inputs, select, PIN box:** white, 2 px ink border, 8 px radius, ≥ 44 px; focus 3 px `--pp-link` outline.
- **Avatar tiles** (add child): white, 2 px ink; selected = `--pp-sun` with ink hard edge.
- **Sticky note** (`StickyNote`, drafts): `--pp-sun`, ink text, 2 px radius, rotated −1.2°, small hard ink edge.
- **Info note** (`.note`): white, 6 px `--pp-link` left rule, 6 px radius.
- **Record lists:** 1 px `#cfe3ea` dividers.

## Child page and your kids

- **Child page:** first card "{nickname}'s islands" with `IslandMap` (`size="full"`, `animate` false) from
  `progress.map`, and below it the map's caption. No new data: `kidProgress` already returns `map`. If rewards are
  off or fail, the card is not shown.
- **Rewards section** (`RewardsSection`): `Rod look="shell"`; label text unchanged otherwise.
- **Week summary** (`WeekSummary`, `Cubes`): each cube mark becomes a round sun dot (filled = `--pp-sun` with an
  ink border, empty = white with an ink border), same count, same "+N", same image label as today. Only the
  drawing changes.
- **Your kids** (`src/app/parent/page.tsx`): each kid card shows a mini `IslandMap` (aria-hidden, as on the
  picker). This adds a `kidProgress` call per kid on that page — the same rows, the same RLS client and timeout
  as the kid picker; nothing new stored, logged or sent. If it fails the card shows without a map.

## Privacy

No new data. The your-kids page reads the same reward rows the picker already reads, for the parent's own kids.

## Out of scope

Weekly email, distress email, sticker art, copy changes, page structure or flow changes, new features.

## Testing

- Unit: tokens test extended (`--pp-page`, `--pp-quiet`, `--pp-link` values, contrast pairs above ≥ 4.5);
  `ui.test.tsx` updated to the new look (strip, buttons, focus colour) without dropping any behaviour check;
  child page renders the map card only when progress exists; your-kids renders a mini map per kid and still
  renders when progress is null.
- `tests/e2e/grownup-shots.spec.ts`: every existing screen at every size, plus a child page with flags up; no
  horizontal scroll at 320 px; no text clipped (same guards as kid-shots); targets ≥ 44 px.
- All existing unit, db and e2e tests stay green; none removed or weakened (rule 9).
- Owner reviews screenshots after T22 and T23.

## Build order (Codex tasks)

- **T22** tokens, strip, bare head, card, buttons, inputs, PIN, notes, avatar tiles — all pages restyled.
- **T23** map card on the child page, mini maps on your kids, shells and sun dots.
- **T24** grown-up shots at all sizes with guards, DESIGN.md grown-up half rewritten as "The Logbook".
