# Fill the Frame Implementation Plan

> **For agentic workers:** executed by Codex one task at a time through `docs/codex/HANDOFF.md`
> (Claude writes each task there, owns git, runs db/e2e, reviews). Steps use checkbox (`- [ ]`) syntax.

**Goal:** on "Make 10" frame problems the child can tap empty cells to add counters (undo, start over) as a
counting tool, then answers with tiles as today.

**Architecture:** one optional flag `fill?: true` on the `ten-frames` visual, set by the `make-ten-frame`
template; `TenFrames` renders tappable cells with local state when the flag is set; `Board` passes `locked` and
is keyed by turn version so state resets.

**Tech Stack:** Next.js 16 / React, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-fill-the-frame-design.md`

## Global Constraints

- Accessible names exactly: `Empty space, add a counter`, `Your counter, take it back`, `Start over`.
- No number of added counters is shown anywhere; nothing about taps is saved, logged or sent.
- Tap any empty cell → counter goes in the next empty cell in order; tap any added counter → the last added is
  removed.
- Interactive only when `v.fill === true` and `first + second ≤ 10`.
- New colour token `--counter-added` in `src/app/play/tokens.css` (calm, distinct from red/yellow, per `DESIGN.md`).
- Cell hit area ≥ 48 × 48 CSS px at the `tablet` Playwright project.
- No engine, grading, API, database or tutor change.

## Review Focus

1. **Answer while counters are added, then retry** (wrong first answer) → try 2 starts with no added counters
   (new version re-keys `Board`). Task 1 render test + Task 2 e2e.
2. **Locked during an in-flight answer** → cells and Start over disabled; no state change from taps. Task 1.
3. **Full frame** (start 9, add 1) → no empty buttons left; focus moves to the last added counter, not lost to
   `body`. Task 1.
4. **Phone width (390 px)** → frame and Start over not clipped; Start over doesn't push the answer tiles off
   screen. Task 2 kid-shots.
5. **Old/other visuals** (`ten-frames` without `fill`, two frames, other kinds) → render exactly as before
   (no buttons). Task 1.

---

### Task 1 (T16): Flag and interactive frame

**Files:**
- Modify: `src/domain/types.ts` (`ten-frames` gains `fill?: true`)
- Modify: `src/domain/curriculum/add-within-10.ts` (`make-ten-frame` sets `fill: true`)
- Modify: `src/app/play/visuals/TenFrames.tsx`, `src/app/play/visuals/Visual.tsx` (pass `locked`),
  `src/app/play/Board.tsx` (take `locked`, pass to `Visual`), `src/app/play/PlayScreen.tsx` (`<Board key={state.version} locked={state.phase !== "problem"} …>`),
  `src/app/play/tokens.css`, `src/app/play/play.module.css` (Start over button)
- Test: `src/domain/curriculum/add-within-10.test.ts`, create `src/app/play/visuals/TenFrames.test.tsx`

**Interfaces:**
- Produces: `Visual({ v, locked }: { v: VisualT; locked?: boolean })`; `TenFrames({ v, locked })`;
  `Board({ problem, locked }: { problem: Problem; locked?: boolean })`.
  DOM: added counters carry `data-counter="added"`; empty cell buttons keep `data-empty="true"`.

- [ ] **Step 1: Failing tests:**
  - `add-within-10.test.ts`: every `make-ten-frame` problem (all levels, several seeds) has
    `show.fill === true`; `make-ten-bond` and other templates' visuals have no `fill`.
  - `TenFrames.test.tsx`: no `fill` → no buttons (Review Focus 5, also a two-frame `fill` visual → no buttons);
    `{first: 6, second: 0, fill: true}` → 4 buttons named `Empty space, add a counter`; click the last empty
    button → one `data-counter="added"` in cell 7 (the next in order), 3 empty buttons left, one button named
    `Your counter, take it back`; add 2 more then click the first added → 2 added remain (last removed);
    `Start over` hidden at 0, visible after adding, clears to 0; `locked` → all buttons disabled and clicks
    change nothing (Review Focus 2); start 9, add 1 → no empty buttons, focus is on `Your counter, take it back`
    (Review Focus 3); no text node with a digit is rendered besides existing description.
  - Board/PlayScreen render test (existing `screen.test.tsx` style): after a wrong answer moves to try 2, the
    frame has 0 added counters (Review Focus 1).
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement. Cells as HTML `<button>`s in an overlay absolutely positioned over the SVG cells
  (percent positions from the SVG geometry) is the suggested route — it keeps native focus/keyboard; any route
  passing the tests is fine. Hit area from the button box, ≥ 48 px at tablet width.
- [ ] **Step 4:** `npm run typecheck`, `npm test` green.

### Task 2 (T17): e2e and kid-shots

**Files:**
- Create: `tests/e2e/fill-frame.spec.ts`
- Modify: `tests/e2e/kid-shots.spec.ts`

- [ ] **Step 1 (Codex writes, Claude runs):** `fill-frame.spec.ts`: placed kid seeded so `add-within-10.make-ten`
  is the frontier (seed everything before it mastered, pattern from `tests/e2e/play.spec.ts` ~line 157); play
  until the pending problem's `templateId` is `make-ten-frame` (read `state.pending` with `admin()`); tap 4
  `Empty space, add a counter` → 4 `[data-counter="added"]`; tap `Your counter, take it back` → 3; `Start over`
  → 0; keyboard: focus an empty cell, press Enter → 1 added; answer wrong with a tile → on try 2, 0 added
  (Review Focus 1); answer right → next problem.
- [ ] **Step 2:** kid-shots: add a Make 10 frame screen with 3 added counters at every size the spec already
  checks; assert each empty-cell button box ≥ 48 × 48 at tablet; frame, `Start over` and tiles inside the
  viewport with no clipping (same guard pattern as the bubble/end-card checks; Review Focus 4).
- [ ] **Step 3:** `npm run typecheck`, `npm test` green; Claude runs `npm run test:e2e`.
