# Fill the frame: an interactive ten-frame for "Make 10"

Date: 2026-10-20. From `docs/improvements/learning-experience-roadmap.md` §8 ("start with one skill and one
interaction; making ten is a useful candidate").
Built by Codex task by task through `docs/codex/HANDOFF.md`; Claude reviews and runs db/e2e.

## Problem

On "Make 10" (`add-within-10.make-ten`, template `make-ten-frame`) the child sees a ten-frame with some dots and
is asked "How many more make 10?". The frame is a picture only; the child cannot act on it.

## Decisions (owner, 2026-10-20)

1. **The frame is a helping tool, not the answer.** The child may tap empty cells to add counters, then answers
   with the number tiles as today. Grading is unchanged.
2. **No number is shown** for added counters; the child counts them.
3. Design (scope, a11y, reload, build order) approved in chat.

## Server and domain

- `Visual` `ten-frames` gains optional `fill?: true`. Only the `make-ten-frame` template sets it (all levels).
- Nothing else changes: engine, grading, mistakes, attempts, database, tutor lines.
- Retry: `make-ten-frame` has no `sum`, so `boardView` keeps the original visual on try 2; the frame stays
  interactive on the retry and after Help 1 / Help 2.

## Child experience (`src/app/play/visuals/TenFrames.tsx`)

When `v.fill` is set and the frame has one frame (`first + second ≤ 10`):

- Each empty cell is a real `<button>` (inside the SVG via `foreignObject` or an HTML overlay positioned over the
  cells; implementer's choice, the tests pin behaviour). Tapping **any** empty cell adds a counter in the **next
  empty cell in order** (left to right, top row first).
- Added counters use a third colour token (new `--counter-added` in `src/app/play/tokens.css`, distinct from
  red and yellow, calm per `DESIGN.md`).
- Tapping an added counter removes the **last** added counter (undo).
- A small **"Start over"** button under the frame clears all added counters; it shows only when at least one
  counter was added.
- No count, no "full" message, no sound. Filling all 10 is allowed.
- Hit area of each cell ≥ 48 × 48 CSS px at the tablet viewport used by `tests/e2e/kid-shots.spec.ts`.
- While an answer/help request is in flight (`locked`), cell buttons and "Start over" are disabled.
- Tap only; there is no drag.

## Keyboard and screen readers

- Cells are reachable by Tab; Enter/Space activate them.
- Accessible names: empty cell `Empty space, add a counter`; added counter `Your counter, take it back`;
  `Start over`. The frame's existing description (`describeVisual`) is unchanged.
- Focus after adding stays on a usable control (the next empty cell, or the last added counter when full).

## State, reload, network

- Added counters are local React state in the browser only. They reset to none on a new turn, a new try, a
  reload, or after reconnecting.
- Nothing about the taps is saved, logged or sent (COPPA). No API or database change.

## Out of scope

Other skills and templates, two-frame (`> 10`) fill, recording tool use, parent reporting of it, voice, drag.

## Playtest (owner, after build)

Watch 2–3 children use it with no adult instruction: do they find the cells, undo, and still answer with a
tile? Record findings in the roadmap §8.

## Testing

- Unit (`visuals.test.tsx` or a new `TenFrames.test.tsx`): no buttons without `fill`; with `fill` the empty
  cells are buttons with the names above; tap adds in order; tap added removes last; Start over clears and hides;
  locked disables; new `v` (turn) resets; `make-ten-frame` template sets `fill`, other templates don't.
- e2e: on a Make 10 frame problem, tap 4 cells → 4 added counters; undo one → 3; Start over → 0; answer with a
  tile as usual. kid-shots: cell hit areas ≥ 48 px at tablet size; the frame and "Start over" are not clipped.

## Build order (Codex tasks)

- **T16** `fill` flag, interactive frame, unit tests. **T17** e2e and kid-shots checks.
