# Plan 5a — Kid Play Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the minimal play screen with the real kid app on a tablet. It has three parts:
- Nova, a friendly round robot who speaks the tutor line;
- a felt board that draws each problem's picture (objects, ten-frames, number line, blocks, equation, story);
- an answer tray with big tap tiles or a number pad.

It survives network loss by retrying and resuming at the same problem. It ends a session with a short, cheerful summary. Speech comes in Plan 5b.

**Architecture:**
- Pure SVG visual components under `src/app/play/visuals/`, one per `Visual` kind. Each is a pure function of the visual data, so it can be tested by rendering to static markup.
- A client hook `usePlay(kidId)` that owns the play state machine:
  - load → show → answer → feedback → next;
  - 409 adoption;
  - bounded retries with backoff;
  - a double-tap guard.
- Presentational components (Nova, LineBubble, FeltBoard, AnswerTray, NumberPad, EndCard) styled with CSS Modules and the design tokens below.
- No server changes, apart from a tiny optional `kidName` for the screen title, which is not needed and not planned.

**Tech Stack:** Next.js 16.4 App Router (client components), React 19, CSS Modules, `next/font/google` (Andika), Vitest with `react-dom/server` `renderToStaticMarkup` for component tests, Playwright (tablet 1024 × 768).

**Spec:** `docs/superpowers/specs/2026-10-08-adaptive-tutor-design.md`:
- §4 (Kid app: problem screen, visuals, tap/number-pad input);
- §5 ("Input by age: 5–7 get large tap choices and voice; 8–11 also get a number pad");
- §9 (Network loss: "client retries; resume at same problem"; "Kid quits mid-problem: no penalty"; "text always on screen");
- §10 (end-to-end on a tablet viewport).

Builds on Plans 3a, 3b and 4.

## Owner decisions (2026-10-10)

- **Plan 5 is split.** 5a is the screen. 5b is speech, using Azure AI Speech for both speech-to-text and text-to-speech, plus "Did you say 12?" and pre-made audio for canned lines.
- **Speech vendor for 5b:** Azure AI Speech. Recorded here so 5a leaves a slot for it, but 5a calls no vendor.

## Design direction (the felt board)

The subject is early-math practice for ages 5–11, so the look is taken from what kids actually use at a classroom table: a green felt board, two-colour counters (red on one side, yellow on the other), interlocking base-ten cubes, and a number line. It is not the default pastel kids'-app look. The board is the memorable part, and everything around it stays quiet.

- **Colour tokens** (CSS custom properties on `:root` in `src/app/play/play.module.css` or a `tokens.css` it imports):
  - `--felt: #2E6B5E` is the board and page background.
  - `--felt-deep: #23544A` is the board edge and shadows.
  - `--chalk: #F4F7F2` is text and line strokes on felt.
  - `--counter-red: #E4413B` is the first colour of the counters.
  - `--counter-yellow: #F6C531` is the second colour of the counters.
  - `--cube-blue: #3B7DD8` is the tens rods and ones cubes.
  - `--tray: #FBFAF5` is the answer tray and Nova's speech bubble.
  - `--ink: #1E2B28` is text on the tray and bubble.
  - Contrast: chalk on felt and ink on tray each exceed 7:1.
- **Type:** Andika (SIL, designed for early readers, single-storey "a" and "g") via `next/font/google`, for all text and numerals. The scale is 22 / 28 / 40 / 64 px:
  - bubble text 28 for ages 5–7 and 22 for ages 8–11;
  - tiles and pad keys 40;
  - the end-card number 64.
  - Sentence case everywhere and no all-caps labels.
- **Layout** at 1024 × 768 landscape. Content is centre-aligned on the board and tray; Nova's bubble is left-aligned text.

  ```
  ┌──────────────────────────────────────────────────────────┐
  │ (Nova)  ╭──────────────────────────────────────────────╮ │  ~150px
  │  robot  │ Nova's line, sentence case                    │ │
  │         ╰──────────────────────────────────────────────╯ │
  ├──────────────────────────────────────────────────────────┤
  │                                                          │
  │                 felt board: the problem's picture        │  ~380px
  │                 + the prompt text in chalk               │
  ├──────────────────────────────────────────────────────────┤
  │        answer tray: 3–4 big tiles  |  or number pad      │  ~210px
  └──────────────────────────────────────────────────────────┘
     small "I'm done for now" link, top-right, low emphasis
  ```

  Portrait (768 × 1024) stacks the same three bands. Nothing scrolls on either tablet orientation.
- **Nova** is an inline SVG robot with a round body, antenna, and two "screen" eyes. Its `tone` (`cheer` / `calm` / `curious`) changes the eye shapes (arcs, dots, one raised). There is no text inside Nova.
- **Motion:** one moment only. On a correct answer Nova makes a single 400 ms hop and the antenna light blinks. Nothing else animates on its own. `prefers-reduced-motion: reduce` turns the hop off. Pressing a tile gives a 1-frame press state (scale 0.97).
- **Tap targets:** at least 88 × 88 px for tiles and pad keys, with at least 16 px gaps. There is a visible focus ring (3 px chalk outline on the tray, ink on felt).
- **Copy:** Nova speaks. The UI chrome uses the fewest words possible:
  - "I'm done for now";
  - number-pad keys "⌫" and "OK", where the backspace key has `aria-label="Delete"`;
  - connection notice "Trying to reach Nova… your answer is saved when it gets through." (sentence case, no apology);
  - end card: "Great work today!" with "{n} problems" and "{m} right on the first try".

## Decisions this plan makes

- **Inputs:** templates only produce `tap-choice` and `number-pad` (`src/domain/problems/build.ts`). 5a renders those two. `voice` and `drag` render as tap tiles when `choices` exist, otherwise as the number pad. 5b adds voice. Drag is never produced, so it gets no UI (YAGNI).
- **Number pad:** keys 0–9, Delete, OK. Up to 3 digits. OK stays disabled while the entry is empty. The entry shows above the keys at 64 px.
- **Network:**
  - `usePlay` retries a failed `turn` or `answer` request (network error or 5xx/503) up to 4 times, with backoff 0.5, 1, 2 and 4 s. While it retries it shows the connection notice and keeps the problem on screen with input locked.
  - An answer retry re-sends the same `{ version, given }`. The server's version check makes this safe: a duplicate gets a 409 with the current turn, which is adopted.
  - After the last retry the hook shows "Nova can't connect right now. Try again", with a "Try again" button that reloads the turn. Resume lands at the same problem (Plan 3a).
- **Double tap:** input locks from the moment of the tap until the response is handled. A second tap is ignored on the client, and the server already rejects duplicates.
- **Feedback display:**
  - Nova's bubble shows `line.say` and `tone`.
  - A retry keeps the wrong line as Nova's line (Plan 4).
  - The reveal note (`revealNote`) shows under the bubble.
  - A correct answer shows the feedback line for 1.2 s before the next problem's line replaces it. The new problem appears immediately; only the bubble text waits, unless reduced motion is on.
- **End of session:** an `end` turn shows the end card built from `summary` (`problems`, `firstTryCorrect`), with "Play again" (loads a new turn) and "Back to kids" (`/`).
- **"I'm done for now":** goes to `/` with no request. Spec §9: no penalty, and the attempt is not counted.
- **Accessibility:**
  - Nova's bubble is `role="status"` with `aria-live="polite"`.
  - Each visual SVG has `role="img"` and an `aria-label` describing it in words (for example "3 red counters and 4 yellow counters in two ten-frames").
  - Tiles are `<button>`s labelled with their number.
- **Testing visuals:** components render to static markup in Vitest (`react-dom/server`), and tests count elements (circles, rects) and check `aria-label`s. Playwright takes screenshots at 1024 × 768 into `test-results/` for the owner to eyeball. There are no pixel-diff assertions.

## Global Constraints

- Tablet viewport 1024 × 768 for e2e (spec §10). Must also not scroll at 768 × 1024.
- "Text always on screen" (spec §9): every spoken line is visible as text.
- The browser never receives or displays the answer before the kid has tried. The screen shows only `PublicTurn` plus `line`/`nextLine`/`revealed` (Plans 3a, 4).
- No third-party trackers, analytics SDKs, ads or external assets at runtime. Fonts come through `next/font`, which self-hosts at build time. Nova and every visual are inline SVG.
- `src/domain` and the API routes stay unchanged, apart from a bug fix in a route if one is needed and recorded.
- Test first. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A flaky connection mid-answer**, where the request fails after the server saved it. The retry must not double-count (it adopts the 409 turn), and the kid sees the next problem, not an error. Pinned in Task 4 (hook test) and Task 5 (e2e with a failed first request).
2. **Visuals that don't match the numbers.** The ten-frames show exactly `first` red and `second` yellow, with the last N crossed out. Number-line marks and the jump arc land at the right ticks. Blocks show the right rods and cubes, with ones broken out of a ten when `crossedOut.ones > groups[0].ones`. Pinned in Task 2.
3. **Big numbers that don't fit.** For example a number line from 0 to 100, 20 objects, or 9 tens + 9 ones. They must fit the board with no overflow and stay countable. Pinned in Task 2, with a size test per kind.
4. **Fast double taps or a key mash on the number pad** (more than 3 digits, OK on empty). Pinned in Task 3.
5. **Portrait orientation or a smaller tablet.** No scrolling and no clipped tiles. Pinned in Task 5 (e2e at 768 × 1024).

---

## File structure

| Path | Responsibility |
|---|---|
| `src/app/play/play.module.css`, `src/app/play/tokens.css` | Design tokens and layout |
| `src/app/play/Nova.tsx` | Robot SVG with `tone` |
| `src/app/play/visuals/{Objects,TenFrames,NumberLine,Blocks,Equation,Story,Visual}.tsx`, `src/app/play/visuals/icons.tsx` | Problem pictures |
| `src/app/play/{AnswerTray,NumberPad,LineBubble,EndCard,ConnectionNotice}.tsx` | Interaction pieces |
| `src/app/play/usePlay.ts` | Play state machine (client) |
| `src/app/play/[kidId]/page.tsx` | Composes the screen |
| `src/app/page.tsx` | Kid picker restyled with the same tokens |
| `tests/e2e/play.spec.ts`, `tests/e2e/screen.spec.ts` | End-to-end |

---

### Task 1: Tokens, font, Nova and the screen shell

**Files:**
- Create: `src/app/play/tokens.css`, `src/app/play/play.module.css`, `src/app/play/Nova.tsx`, `src/app/play/LineBubble.tsx`, `src/app/play/Nova.test.tsx`.
- Modify: `src/app/layout.tsx` (Andika via `next/font/google`, weights 400 and 700, `display: "swap"`), `vitest.config.ts` (include `src/app/play/**/*.test.tsx` with the `jsdom`-free node environment; static markup only).

**Interfaces — Produces:**
- `Nova({ tone, hop }: { tone: "cheer" | "calm" | "curious"; hop?: boolean })` returns an SVG with `role="img"` and `aria-label="Nova"`.
- `LineBubble({ say, note, ageBand })` renders `role="status" aria-live="polite"`, with the font size from the age band.
- `.screen`, `.top`, `.board`, `.tray` layout classes per the wireframe.

- [ ] **Step 1: Write the failing tests.**
  - `renderToStaticMarkup(<Nova tone="cheer"/>)` contains `aria-label="Nova"`, and the eye paths differ between `cheer`, `calm` and `curious`.
  - `LineBubble` renders the text, `role="status"`, and the note when given; with no note it renders no note element.
- [ ] **Step 2: Run.** `npm test -- play` → FAIL.
- [ ] **Step 3: Implement** per "Design direction".
- [ ] **Step 4: Run.** `npm test && npm run typecheck` → PASS.
- [ ] **Step 5: Commit.** `feat: felt-board tokens, Andika, Nova and the line bubble`

---

### Task 2: Visual renderers

**Files:**
- Create: `src/app/play/visuals/icons.tsx`, `Objects.tsx`, `TenFrames.tsx`, `NumberLine.tsx`, `Blocks.tsx`, `Equation.tsx`, `Story.tsx`, `Visual.tsx`, and `visuals.test.tsx`.

**Interfaces:**
- **Consumes:** `Visual` and `Icon` from `src/domain/types.ts`. Read their comments for `crossedOut` semantics.
- **Produces:**
  - `Visual({ v }: { v: Visual })` dispatches on `v.kind`.
  - Each component returns one `<svg viewBox=…>` that scales to the board (width 100%, max height of the board band), with `role="img"` and a plain-words `aria-label` from `describeVisual(v): string`.
  - `ICONS: Record<Icon, (props) => JSX.Element>` gives simple flat shapes for the 8 icons: apple, star, fish, ball, duck, shell, block, cookie.

**Rendering rules:**
- **objects:** icons in groups. Groups are separated by a gap, and wrap to rows of up to 5. The last `crossedOut` icons of `groups[0]` carry a chalk "×" overlay.
- **ten-frames:** 2 × 5 frames, two of them when `first + second > 10`.
  - Filled in order: `first` red counters, then `second` yellow ones.
  - The last `crossedOut` dots get the "×".
  - Empty cells show as outlines.
- **number-line:**
  - Ticks from `from` to `to`, labelled every 1 when the span is 20 or less, else every 10, with minor ticks every 1 up to a span of 20 and every 5 above that.
  - `marks` are drawn as dots.
  - `jump` is drawn as an arc from `jump.from` to `jump.from + jump.by`, labelled "+by" (or "−by" when `by` is negative).
  - The landing tick is **not** labelled unless it is on the regular label grid. That keeps the answer off the line when it isn't already shown.
- **blocks:** per group, tens as tall rods of 10 stacked cubes and ones as single cubes.
  - `crossedOut.tens` crosses out whole rods.
  - When `crossedOut.ones > ones`, one rod is drawn "broken" into 10 loose cubes before the crossing.
- **equation:** the `text` in chalk at 64 px.
- **story:** the `text` at 28 px above an objects-style row of `icon` × `groups`, with `crossedOut` across groups.

- [ ] **Step 1: Write the failing tests (Review Focus 2, 3).**
  - **ten-frames** `{first:3, second:4}`: 3 red, 4 yellow and 3 empty cells, in one frame.
  - **ten-frames** `{first:8, second:5}`: 2 frames.
  - **ten-frames** `{crossedOut:2}`: 2 "×" marks.
  - **objects** `{groups:[3,4], icon:"apple"}`: 7 icons in 2 groups.
  - **objects** `crossedOut:2`: 2 "×".
  - **number-line** `{from:0,to:10,marks:[3],jump:{from:3,by:4}}`:
    - 11 ticks;
    - labels 0–10;
    - 1 dot;
    - 1 arc labelled "+4".
  - **number-line** `{from:0,to:100,marks:[],jump:{from:40,by:7}}`:
    - labels only at multiples of 10;
    - no "47" label anywhere;
    - viewBox width is fixed and nothing is placed outside the viewBox.
  - **blocks** `[{tens:3,ones:4}]`: 3 rods, 4 cubes.
  - **blocks** with `crossedOut {tens:0, ones:7}` and `{tens:4,ones:3}`: one rod broken into 10 cubes, and 7 crosses.
  - **equation:** the text is present.
  - **story:** the text and the icon count.
  - **Size:** 20 objects and `blocks [{tens:9,ones:9}]` fit within the viewBox. Every `x+width` and `y+height` is no larger than the viewBox, which the test parses.
  - `describeVisual` for each kind is non-empty and never contains the answer when the answer isn't one of the visible numbers. Use a 3+4 ten-frame: the label says "3 red counters and 4 yellow counters", not 7.
- [ ] **Step 2: Run.** FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** `npm test && npm run typecheck` → PASS.
- [ ] **Step 5: Commit.** `feat: felt-board pictures — counters, ten-frames, number line, blocks, equation, story`

---

### Task 3: Answer tray and number pad

**Files:**
- Create: `src/app/play/AnswerTray.tsx`, `src/app/play/NumberPad.tsx`, `src/app/play/numberPad.ts` (pure reducer), `src/app/play/answer.test.tsx`.

**Interfaces:**
- **`padReducer(state: string, key: "0".."9" | "del" | "ok"): { entry: string; submit?: number }`:**
  - At most 3 digits.
  - A leading zero is replaced, so "0" then "7" gives "7".
  - "del" on empty is a no-op.
  - "ok" on empty is a no-op.
  - "ok" otherwise gives `submit: Number(entry)` and resets the entry.
- `AnswerTray({ input, choices, locked, onAnswer })` renders tiles for `tap-choice` or for any input with `choices`, and the `NumberPad` otherwise. With `locked` set, every button is `disabled`.

- [ ] **Step 1: Write the failing tests (Review Focus 4).**
  - Reducer cases:
    - "1","2","3","4" → "123";
    - del → "12";
    - ok → submit 12, then entry "";
    - ok on empty → nothing;
    - "0","7" → "7".
  - Markup:
    - 4 choices → 4 `<button>`s labelled with their numbers;
    - `locked` → all `disabled`;
    - number-pad markup has 12 buttons, including Delete with `aria-label`;
    - OK is disabled with an empty entry;
    - `input: "voice"` with choices → tiles.
- [ ] **Step 2: Run.** FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** `npm test && npm run typecheck` → PASS.
- [ ] **Step 5: Commit.** `feat: answer tray with big tiles and a number pad`

---

### Task 4: The play state machine

**Files:**
- Create: `src/app/play/usePlay.ts`, `src/app/play/playMachine.ts` (pure reducer plus a request runner with an injectable `fetch` and `sleep`), `src/app/play/playMachine.test.ts`.

**Interfaces:**
- **`type PlayState`:**
  - `{ phase: "loading" | "problem" | "sending" | "retrying" | "offline" | "ended"; version?; turn?: PublicTurn; line?; note?; message?; summary?; attempt?: number }`.
- **`runRequest(fetchFn, sleep, req): Promise<Response | "offline">`:**
  - Retries on a network error or a status ≥ 500 at 500, 1000, 2000 and 4000 ms, so 4 retries.
  - Returns other statuses (200, 400, 404, 409) as they are.
- **`playReducer(state, event)`** handles:
  - `loaded`;
  - `answered` (200 body);
  - `conflict` (409 body: adopts `turn`, `version` and `line`);
  - `retrying(attempt)`;
  - `offline`;
  - `ended`.
- `usePlay(kidId)` returns `{ state, answer(given), retry() }`. It owns the lock: `answer` is ignored unless `phase === "problem"`.

- [ ] **Step 1: Write the failing tests (Review Focus 1).**
  - `runRequest` with fetch failing twice and then 200: 2 sleeps (500, 1000), then the 200 is returned.
  - Always failing: 4 sleeps, then `"offline"`.
  - A 409 is returned at once, with no retries.
  - A 503 is retried.
  - Reducer:
    - an answer that comes back 409 adopts the server's turn and version and clears the message;
    - a 200 with `nextLine` sets `line = nextLine` and `message = line.say`;
    - a 200 retry (no `nextLine`) keeps the problem and sets `line = feedback line`;
    - an `end` turn → `ended` with the summary;
    - `answer` while `sending` is ignored.
  - "Saved, then the response was lost": fetch throws once, the retry gets a 409 carrying the next turn, and the state shows the next problem with no error.
- [ ] **Step 2: Run.** FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** `npm test && npm run typecheck` → PASS.
- [ ] **Step 5: Commit.** `feat: play state machine with retries and conflict adoption`

---

### Task 5: Compose the screen, picker, end card and e2e

**Files:**
- Create: `src/app/play/EndCard.tsx`, `src/app/play/ConnectionNotice.tsx`, `tests/e2e/screen.spec.ts`.
- Modify: `src/app/play/[kidId]/page.tsx` (rebuilt from the pieces), `src/app/page.tsx` (picker restyled: big avatar tiles on felt, "Grown-ups" small link), `tests/e2e/play.spec.ts` (selectors updated; the existing no-leak, double-tap and resume tests must keep passing).

**Interfaces:**
- The page composes `Nova`, `LineBubble`, `Visual`, the prompt text, `AnswerTray`, `ConnectionNotice`, `EndCard` and the "I'm done for now" link from `usePlay` state.
- Nova hops when the last answer was correct and reduced motion is off.
- **Test ids:**
  - `data-testid="board"` on the board;
  - `data-testid="tray"` on the tray;
  - `data-testid="nova-line"` on the bubble;
  - `data-testid="end-card"` on the end card;
  - existing ids kept where tests rely on them.

- [ ] **Step 1: Write the failing e2e tests.** Tablet 1024 × 768, signed-in parent with consent, a kid at age band 5–7, then a kid at 8–11.
  - Tap answers on 5 problems: the board shows an SVG with `role="img"`, the bubble text changes, and there are no console errors.
  - **8–11 kid:** a number-pad problem can be answered by keys and OK.
  - **Review Focus 1:** abort the first `/answer` request (Playwright `route` → `abort` once). The connection notice appears, and then the next problem appears. The DB has exactly 1 attempt for that turn.
  - **Review Focus 5:** at 768 × 1024, the document doesn't scroll (`scrollHeight <= innerHeight`), and every tile is fully in view.
  - "I'm done for now" goes to `/`, and reopening the kid resumes the same problem.
  - The end card appears when the session ends. Drive it with an admin-seeded session state near its end, or play until the end with the minimum-time rule shortened through an existing test hook. If neither exists, cover the end card with a component test instead, and say so in the report.
  - Screenshots at 1024 × 768 of a ten-frame problem, a number-line problem, a blocks problem and the end card go to `test-results/screens/` for the owner.
  - The existing play specs (no-leak scan, double tap, resume) still pass.
- [ ] **Step 2: Run.** FAIL.
- [ ] **Step 3: Implement.** Follow "Design direction". Critique the screenshots against the direction (felt board as the memorable part, quiet chrome, at least 88 px targets) and fix anything off before committing.
- [ ] **Step 4: Run.** `npm test && npm run test:db && npm run test:e2e && npm run typecheck` → PASS.
- [ ] **Step 5: Update the vault Roadmap.** Mark "Kid app (5a screen)" done and leave "5b speech" open. Add a "Decision - Stack" row: Speech vendor = Azure AI Speech (owner's choice, 2026-10-10). Stage only these files.
- [ ] **Step 6: Commit.** `feat: the kid play screen — Nova, felt board, answer tray, end card`
