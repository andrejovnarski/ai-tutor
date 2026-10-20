# Pocket Planet: a new world for the kid side

Date: 2026-10-20. From the owner's brief `docs/improvements/complete-frontend-redesign-brief.md` (kid side
first). Built by Codex task by task through `docs/codex/HANDOFF.md`; Claude reviews and runs db/e2e.
Mockups from the brainstorm: `.superpowers/brainstorm/1592744-1792531617/content/` (`screens.html`, `nova.html`,
`map-shape.html`).

## Problem

The kid side (picker, play screen, end card) is a calm "felt board". It works, but it feels plain, and nothing
shows a child how far they have come across the whole curriculum. The owner wants a new world that children are
excited to open, while keeping the product rules (`PRODUCT.md`): code owns the truth, usable without reading,
collect less, always end on a win.

## Decisions (owner, 2026-10-20)

1. **World: Pocket Planet.** A bright, sunny little planet of islands in the sea.
2. **Kid side first.** The grown-up side keeps the "exercise book" look; it only gets the new Nova.
3. **Look-only island map.** One island per skill group, one flag per skill. The child never chooses where to
   go; the code still picks every problem.
4. **Map on the end card and small on each picker card.** No new screen.
5. **Island chain** shape (8 islands joined by a boat route, one screen, no scrolling).
6. **Keep all rewards** (XP, levels, stickers, week dots) with the same rules and data; only their look changes.
   Cubes are drawn as shells on the kid side.
7. **Nova is a little planet** with a yellow ring (moods cheer, calm, curious).
8. **Motion only at the right moments**: during a problem only Nova moves; a short burst on a right answer; the
   flags-and-boat moment on the end card. No moving background.
9. **Restyle in place**: no change to game logic, server routes, the database schema or Nova's lines.
10. **Island names** (approved):

| Cluster id | Island |
|---|---|
| `count-to-20` | Counting Cove |
| `compare-numbers` | Compare Cliffs |
| `add-within-10` | Adding Island |
| `subtract-within-10` | Take-Away Bay |
| `add-subtract-within-20` | Twenty Reef |
| `place-value` | Tens Town |
| `add-subtract-within-100` | Hundred Harbor |
| `word-problems` | Story Shore |

## Look (design tokens)

New kid tokens in `src/app/play/tokens.css`. The existing `--felt*`, `--chalk`, `--tray` tokens stay (the
grown-up pages use them). The counter colours stay and stay for maths only.

| Token | Hex | Use |
|---|---|---|
| `--pp-sky` | `#bfe9f5` | page ground (top of the sky gradient is `--pp-sky-deep`) |
| `--pp-sky-deep` | `#7fd3f0` | top of the sky |
| `--pp-sea` | `#4fb6c9` | the map's sea, picker sea strip |
| `--pp-sea-deep` | `#2f8aa0` | answer tray (the sea under the island) |
| `--pp-sand` | `#f6e3a8` | the board (island) and map islands |
| `--pp-grass` | `#7cc36a` | grass rim of the board, island tops |
| `--pp-ink` | `#12324a` | all text, lines in maths pictures, borders, hard edges, focus ring |
| `--pp-white` | `#ffffff` | tiles, keys, bubble, cards, Help me |
| `--pp-go` | `#ff8a3d` | "go": the mic at rest, Play again, map flags, the boat |
| `--pp-sun` | `#ffcf3d` | Nova's ring, played week dots, the selected avatar |
| `--pp-nova` | `#7a6cf0` | Nova's body only |

Contrast (checked): ink on sky 10.2, sky-deep 7.9, sand 10.4, white 13.3, go 5.7, sun 9.0, grass 6.2, sea 5.6.
**Text is always ink on a light ground; never white text, and no text directly on `--pp-sea-deep`** (3.3). Ink
outlines on `--pp-sea-deep` pass the 3:1 non-text rule.

- **Type:** Andika as today. Kid text ≥ 22 px (`--text-s`); sizes `--text-s/m/l/xl` unchanged.
- **Shapes:** kid tiles, keys, buttons, bubble and cards are white with a 3 px ink border, radius 22 px (cards 28
  px), and a hard unblurred ink bottom edge (`0 5px 0 var(--pp-ink)`) that goes away on press (press moves down
  the same amount; no move under reduced motion). No soft shadows, no gradients except the sky, no glow.
- **Focus:** 3 px solid ink outline, offset 3 px, on every kid control.
- **Maths pictures** (`src/app/play/visuals/*`): line art changes from `--chalk` to `--pp-ink` (the board is now
  light). Counter colours, the fill frame and all geometry stay. Story icons keep their fills.
- **Red never means wrong.** The mic turns counter red only while listening, as today.

## Nova (`src/app/play/Nova.tsx`)

A purple planet body (`--pp-nova`), a yellow ring (`--pp-sun`) tilted about −12°, front half of the ring drawn over
the body, an ink outline, a small light highlight. Moods change only the eyes and mouth (as in `nova.html`):
cheer (happy arcs + smile), calm (dots + small smile), curious (one big eye, one small, "o" mouth). Same props,
sizes and roles as today (120 px play, 96 px sign-in, 32 px grown-up strip; a button that replays the line when
speech is on). Talking: the existing hop, and the ring tips once (400 ms). Right answer: the ring spins one turn
and 3–5 small sun-yellow stars pop beside Nova for about 600 ms, never over the board. Reduced motion: no hop, no
spin, no stars; the cheer face carries the meaning.

## Screens

### Picker (`src/app/page.tsx`, `src/app/picker.module.css`, `src/app/MiniRewards.tsx`)

Sky ground with a still sea strip at the bottom. Nova (120 px, cheer) above "Who's playing?". Kid cards: white,
ink border, hard edge, avatar in a sky circle, nickname (28 px), then the **mini map** (the island chain, about
200 px wide, no text) and one line "Level N · *shells* K of 10" (the rod becomes a count with a small shell icon; the
line is kid chrome at ≥ 18 px). Week dots leave the picker. Cards keep one width per row. "Grown-ups" stays a
quiet top-right link. Empty state ("Add your first kid") restyled as a white button.

### Play (`src/app/play/PlayScreen.tsx`, `play.module.css`, `LineBubble.tsx`, `AnswerTray.tsx`, `NumberPad.tsx`, `ConnectionNotice.tsx`, `Board.tsx`)

Same grid, sizes and rules as today (no scroll, board owns the middle, notices at the board's foot):
- Top band on sky: Nova, white bubble with an ink tail, "Help me" white button, "I'm done for now" quiet link.
- **Board = a sandy island**: `--pp-sand` with a 4 px ink outline, a grass rim at its foot, 28 px radius. No inset
  shadow, no dot texture. Prompt below the picture in ink, 28 px.
- **Tray = the sea**: `--pp-sea-deep` with a gentle still wave on its top edge. White answer tiles, number keys and
  entry; mic is `--pp-go` with an ink icon at rest, counter red while listening, `--pp-sea` while thinking.
- Every state restyled: after-correct, after-wrong / retry picture, Help 1 / Help 2, "Did you say 12?", heard
  strip, offline notice, number pad (landscape, portrait, phone), fill frame, placement.

### End card (`src/app/play/EndCard.tsx`, `RewardsStrip.tsx`, `src/app/rewards/*`)

White card on sky, title "Great work today!", then **the island map as the hero** (full card width), then the
progress lines, numbers, rewards and buttons as today. Rewards: "+75" and a shell rod (10 shells; earned ones
filled, same drop-in timing and level-up rules as the cube rod today), stickers unchanged, week dots in `--pp-sun`.
"Play again" is `--pp-go` with ink text; "Back to kids" is white. On a phone the map shrinks first so the card
still fits with no clipping. If rewards are off or fail to load, there is no map (as rewards today).

**The map moment:** flags for skills learned this session start down and rise one after another (about 250 ms
each), then the boat sails along the route to its spot (about 600 ms); the whole run is ≤ 2 s. It plays when the
rod's drop-in plays today (same trigger), not again on its own. Reduced motion: everything is already in place.

## Island map

### Rules (pure, `src/domain/rewards/map.ts`)

```ts
export type IslandMap = {
  islands: { clusterId: string; name: string; flags: { skillId: string; up: boolean; isNew: boolean }[] }[];
  boat: { island: number; flag: number } | { done: true };
};
export function islandMap(masteredAt: MasteredAt, placed: ReadonlySet<string>, learnedNow: readonly string[]): IslandMap;
export const ISLAND_NAMES: Record<string, string>; // the table above
```

- Islands are `CLUSTERS` in order; flags are each cluster's `skills` in order.
- A flag is **up** when the skill has a `mastered_at` or its row is `placed`. Both only ever turn on, so a flag
  never comes down (even when a recall sends the skill back to practice).
- `isNew` = up and the skill is in `learnedNow` (the ended session's `mastered` list; empty on the picker).
- The **boat** sits at the first flag (curriculum order) that is not up; `{ done: true }` when all are up.
- Unknown skill ids in the inputs are ignored.

### Data

- `loadRewardRows` (`src/server/rewards.ts`) also reads `placed` and returns rows where `mastered_at` is set **or**
  `placed` is true: `RewardRows` gains `placed: string[]`. Same client, same RLS, same timeout, same "rewards
  are extra" fallback. No new column, nothing new stored, logged or sent (COPPA).
- `progress(...)` and `endRewards(...)` take `placed` and return a `map: IslandMap` (picker: `learnedNow = []`;
  end card: the ended session's `mastered`). The play API passes it through with the existing rewards payload.

### Part (`src/app/rewards/IslandMap.tsx`)

`IslandMap({ map, size, animate })` with `size: "mini" | "full"`. One SVG drawn from fixed island positions
(viewBox 400 × 160, as in `map-shape.html` A): islands with flags up are sand and grass; islands with no flag up
are pale with a dashed outline; flags up are `--pp-go`, flags down a short ink stick. The mini map has no text;
the full map names the island the boat is on (22 px).
- `role="img"` with a label: `Map: N islands done. Now on {Island}, K of M flags.` / `Map: all islands done!`
  (an island is "done" when all its flags are up).
- `animate` runs the map moment; it is false on the picker and under reduced motion.

## Grown-up side

Only Nova changes (strip, sign-in, check-your-email). Nothing else on the grown-up side changes in this work; the
child page keeps its cubes and stickers.

## Privacy

No new data. One more column (`placed`) is read from the child's own `skill_state` rows through the parent's
RLS-scoped client, for display only.

## Out of scope

Grown-up redesign; new Nova lines or tutor changes; choosing islands; per-island badges; moving backgrounds;
sounds; new fonts; changing reward rules or wording; the parent page's rewards look.

## Testing

- Unit: `islandMap` (empty kid → boat at first flag; mastered + placed flags up; recall-dropped skill keeps its
  flag; `isNew` only for learned-now; all up → done; unknown ids ignored); `loadRewardRows` returns `placed`
  rows; `IslandMap` label for each case and no animation under reduced motion; Nova moods still distinct
  (existing `Nova.test.tsx`); end card shows the map only when rewards exist.
- All existing unit, db and e2e tests stay green; none are removed or weakened (HANDOFF rule 9). Selectors stay
  role/test-id based.
- kid-shots (`tests/e2e/kid-shots.spec.ts`): every existing screen at every size, plus picker with maps and the
  end card with new flags; targets ≥ 88 px at tablet (≥ 72 px tiles, ≥ 64 px keys on phone); nothing clipped
  (existing SLACK guard); end card fits on phone.
- Contrast: a unit check that every text pairing in the token table is ≥ 4.5:1.
- Owner reviews screenshots after T18 and after T20; playtest with 2–3 kids later.

## Build order (Codex tasks)

- **T18** tokens, Nova, play screen restyle (board, tray, tiles, pad, mic, bubble, notices, maths in ink), contrast
  check.
- **T19** `islandMap` + `ISLAND_NAMES`, `placed` read, `progress`/`endRewards` map, `IslandMap` part, unit tests.
- **T20** picker and end card: mini map, map moment, shell rod, stickers, week dots, phone fit.
- **T21** kid-shots for all screens and sizes, DESIGN.md kid half rewritten as "The Pocket Planet", Nova in the
  grown-up strip checked, e2e green.
