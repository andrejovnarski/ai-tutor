---
name: Brightling AI
description: A patient early-math tutor. Kids explore the Pocket Planet, and grown-ups read a squared exercise book.
colors:
  pp-sky: "#bfe9f5"
  pp-sky-deep: "#7fd3f0"
  pp-sea: "#4fb6c9"
  pp-sea-deep: "#2f8aa0"
  pp-sand: "#f6e3a8"
  pp-grass: "#7cc36a"
  pp-ink: "#12324a"
  pp-white: "#ffffff"
  pp-go: "#ff8a3d"
  pp-sun: "#ffcf3d"
  pp-nova: "#7a6cf0"
  felt: "#2e6b5e"
  felt-deep: "#23544a"
  chalk: "#f4f7f2"
  tray: "#fbfaf5"
  ink: "#1e2b28"
  counter-red: "#e4413b"
  counter-yellow: "#f6c531"
  cube-blue: "#3b7dd8"
  cube-green: "#4c9a52"
  paper: "#f6f8f5"
  grid: "#dbe6ee"
  ink-quiet: "#4d5c58"
  link: "#2a64b8"
  danger: "#c3332d"
  danger-deep: "#8f2420"
typography:
  kid-display:
    fontFamily: "Andika, system-ui, sans-serif"
    fontSize: "64px"
    fontWeight: 700
    lineHeight: 1.1
  kid-headline:
    fontFamily: "Andika, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1.2
  kid-title:
    fontFamily: "Andika, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 400
    lineHeight: 1.25
  kid-body:
    fontFamily: "Andika, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.3
  grownup-display:
    fontFamily: "Andika, sans-serif"
    fontSize: "48px"
    fontWeight: 700
    lineHeight: 1.1
  grownup-headline:
    fontFamily: "Andika, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.2
  grownup-title:
    fontFamily: "Andika, sans-serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.3
  grownup-body:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.5
  grownup-label:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  pp-control: "22px"
  sticky: "2px"
  cube: "3px"
  card: "6px"
  input: "8px"
  button: "12px"
  tile: "16px"
  kid-button: "20px"
  board: "24px"
  tray-card: "28px"
  round: "50%"
spacing:
  xs: "8px"
  sm: "16px"
  gutter: "20px"
  md: "24px"
  lg: "32px"
  xl: "48px"
  column: "560px"
components:
  answer-tile:
    backgroundColor: "{colors.pp-white}"
    textColor: "{colors.pp-ink}"
    typography: "{typography.kid-headline}"
    rounded: "{rounded.pp-control}"
    size: "88px"
  kid-button-primary:
    backgroundColor: "{colors.pp-go}"
    textColor: "{colors.pp-ink}"
    typography: "{typography.kid-title}"
    rounded: "{rounded.pp-control}"
    padding: "0 32px"
    height: "88px"
  kid-button-secondary:
    backgroundColor: "{colors.pp-white}"
    textColor: "{colors.pp-ink}"
    typography: "{typography.kid-title}"
    rounded: "{rounded.pp-control}"
    padding: "0 32px"
    height: "88px"
  mic:
    backgroundColor: "{colors.pp-go}"
    textColor: "{colors.pp-ink}"
    rounded: "{rounded.round}"
    size: "88px"
  mic-listening:
    backgroundColor: "{colors.counter-red}"
  picker-kid-card:
    backgroundColor: "{colors.pp-white}"
    textColor: "{colors.pp-ink}"
    typography: "{typography.kid-title}"
    rounded: "{rounded.tray-card}"
    padding: "24px 24px 20px"
  grownup-button:
    backgroundColor: "{colors.felt}"
    textColor: "{colors.chalk}"
    typography: "{typography.grownup-body}"
    rounded: "{rounded.button}"
    padding: "8px 20px"
    height: "44px"
  grownup-button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.chalk}"
    typography: "{typography.grownup-body}"
    rounded: "{rounded.button}"
    padding: "8px 20px"
    height: "44px"
  grownup-input:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    typography: "{typography.grownup-body}"
    rounded: "{rounded.input}"
    padding: "8px 12px"
    height: "44px"
  index-card:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "12px 16px 12px 26px"
  island-map:
    backgroundColor: "{colors.pp-sea}"
    textColor: "{colors.pp-ink}"
  nova:
    backgroundColor: "{colors.pp-nova}"
    textColor: "{colors.pp-sun}"
  rewards-rod:
    backgroundColor: "{colors.pp-white}"
    textColor: "{colors.pp-sun}"
    rounded: "{rounded.cube}"
    size: "30px"
  sticker:
    backgroundColor: "{colors.pp-white}"
    textColor: "{colors.pp-ink}"
    typography: "{typography.kid-body}"
    rounded: "{rounded.round}"
    size: "72px"
  week-dots:
    backgroundColor: "{colors.pp-white}"
    textColor: "{colors.pp-sun}"
    rounded: "{rounded.round}"
    size: "28px"
---

# Design System: Brightling AI

## Overview

**Creative North Star: "The Pocket Planet"**

The kid side is a bright, sunny little planet of islands in the sea. Nova is a purple planet with a yellow ring. A sandy island holds the maths, white tiles offer answers, and a look-only island chain shows lasting progress. Code chooses every problem; the child never chooses an island. The board remains the most important thing on screen.

The grown-up side still uses the **squared exercise book**: grid paper, index cards with coloured tabs, a sticky note for drafts, and maths cubes. Its palette, typography, spacing and components stay as they are. The planet Nova is intended to be the shared character at 120 px on play, 96 px on sign-in and 32 px in the grown-up strip.

Kid controls are chunky: 3 px ink borders, hard bottom edges and tablet targets of at least 88 px. Motion is reserved for Nova during a problem, a short right-answer burst and the end-card map moment. Backgrounds stay still. No glossy candy surfaces, coins, streak flames, confetti storms or loot-box rewards.

## Colors

### Pocket Planet kid tokens

These variables live in `src/app/play/tokens.css`; frontmatter `pp-*` names map to CSS `--pp-*` tokens.

| Token | Hex | Use |
|---|---|---|
| `--pp-sky` | `#bfe9f5` | Page ground |
| `--pp-sky-deep` | `#7fd3f0` | Sky gradient top |
| `--pp-sea` | `#4fb6c9` | Map sea and still picker sea strip |
| `--pp-sea-deep` | `#2f8aa0` | Answer tray sea; never a text ground |
| `--pp-sand` | `#f6e3a8` | Sandy board and islands |
| `--pp-grass` | `#7cc36a` | Board grass rim and island tops |
| `--pp-ink` | `#12324a` | All text, maths lines, borders, hard edges and focus |
| `--pp-white` | `#ffffff` | Tiles, keys, bubble, cards and Help me |
| `--pp-go` | `#ff8a3d` | Resting mic, Play again, flags and boat |
| `--pp-sun` | `#ffcf3d` | Nova ring, played week dots and selected avatar |
| `--pp-nova` | `#7a6cf0` | Nova body only |

Kid text is always ink on light: contrast on sky 10.2:1, sky-deep 7.9:1, sand 10.4:1, white 13.3:1, go 5.7:1, sun 9.0:1, grass 6.2:1 and sea 5.6:1. No white text and no text directly on `--pp-sea-deep` (3.3:1). Ink outlines on deep sea meet the 3:1 non-text requirement. Counter colours remain for maths; counter red also marks a listening mic, never a wrong answer.

### Exercise-book grown-up tokens

- **Classroom Felt** (`felt`) and **Deep Felt** (`felt-deep`): top strip, main buttons and their solid edges. Chalk on felt is 5.75:1.
- **Chalk** (`chalk`), **Answer Tray** (`tray`) and **Classroom Ink** (`ink`): the existing light surfaces, strip text and dark reading text.
- **Counter Yellow** (`counter-yellow`): sticky drafts and selected avatar tiles.
- **Cube Blue** (`cube-blue`) and **Cube Green** (`cube-green`): maths cubes; green remains hard-coded in `grownup.module.css`.
- **Counter Red** (`counter-red`): maths counters, never wrong-answer feedback.
- **Exercise-Book Paper** (`paper`): page ground.
- **Grid Line** (`grid`): 1 px lines on a 20 px square grid, card borders and dividers.
- **Quiet Ink** (`ink-quiet`): secondary 15 px text, 6.6:1 on paper.
- **Link Blue** (`link`): links and 3 px focus rings, 5.4:1 on paper.
- **Danger Red** (`danger`) / **Danger Edge** (`danger-deep`): final delete actions only.

## Typography

**Display Font:** Andika (with system-ui, sans-serif)
**Body Font:** Atkinson Hyperlegible (grown-up pages only, with system-ui, sans-serif)

**Character:** Andika was designed for children learning to read. It has a single-storey "a", clear digits and generous counters, so it is the voice of the Pocket Planet and of every heading. Atkinson Hyperlegible keeps long grown-up reading (consent, privacy, reports) clear without feeling like a form.

### Hierarchy
- **Kid display** (700, 64 px, 1.1): numbers that have to be read across a room, such as the end-card totals and the number-pad entry.
- **Kid headline** (700, 40 px, 1.2): "Who's playing?", the end-card title, and the digits on answer tiles and keys.
- **Kid title** (400, 28 px, 1.25): the problem prompt, Nova's speech bubble, and kid buttons and cards.
- **Kid body** (400, 22 px, 1.3): notices, "heard" strips, end-card labels. This is the smallest text a child ever has to read.
- **Grown-up display** (700, 48 px, 1.1): the app name on sign-in and "check your email", in felt green.
- **Grown-up headline** (700, 32 px, 1.2): page h1.
- **Grown-up title** (700, 21 px, 1.3): section h2 and kid names on cards.
- **Grown-up body** (400 / 700, 17 px, 1.5): all reading text. Lines stay under 65–70 characters.
- **Grown-up label** (400, 15 px): secondary text in Quiet Ink, strip links, the "+N" after cubes.

### Named Rules
**The Twenty-Two Floor Rule.** No text a child is meant to read is smaller than 22 px. Kid chrome (the picker level/shell line and quiet grown-up links) may sit at 18 px; instructional text stays at least 22 px. The full map names its current island at 22 px. Long picker names stay within two lines and use ellipsis rather than breaking mid-word.

**The Andika Heads Rule.** Every heading in both worlds is set in Andika. Atkinson is only ever body text.

## Layout

**Kid play screen.** A full-height three-row grid (`100dvh`, overflow hidden): sky top band with Nova at 120 px, white ink-tailed speech bubble, white Help me and a quiet "I'm done for now" link; a sandy island board filling the middle; and a deep-sea answer tray with a still wave edge. The board has a 4 px ink outline, a grass rim, 28 px radius and a 28 px ink prompt below the picture. No inset shadow or dot texture. Notices stay at its foot in the flow.

Answer tiles share one centred row, at least 88 px on tablets. The number pad has six keys per row. In portrait the entry and mic sit beside the keys. Maths pictures retain their geometry and counter fills, with ink replacing chalk line art.

**Picker.** Sky ground with a still sea strip, cheer Nova (120 px) above "Who's playing?". Equal-width white kid cards have an ink edge, avatar in a sky circle, 28 px nickname, a roughly 200 px wide mini island map without text, and one line "Level N · shells K of 10" at least 18 px. No picker week dots. "Grown-ups" stays top right. The empty-state action is white.

**End card.** White on sky: "Great work today!", full-width hero map, progress lines, numbers, rewards and buttons. Play again is orange with ink text; Back to kids is white. The map is absent when rewards are unavailable. Keep the map at least 140 px tall on tablets and 90 px on smaller sizes; the card and all its text must fit. All-islands-done keeps the same layout.

**Narrow screens (600 px or less).** Nova shrinks to 72 px and the done link gets its own row. Tiles are at least 72 px tall; number keys at least 64 px, with entry and mic above. End-card buttons stack and the map shrinks first. Picker cards shrink to 156 px with two per row; names and the level/shell line must stay contained. Picker content may scroll vertically.

**Grown-up pages.** One left-aligned column, at most 560 px wide, with a 20 px side gutter, on the grid paper, plus a felt top strip at the same width. It works from 320 px to tablet landscape. Spacing steps are 8, 12, 16, 24, 28 and 48 px. Sections are separated by 28 px, and the page ends with 48 px of space.

### Named Rules
**The Fill the Board Rule.** A maths picture is cropped to what it draws (plus a 24-unit margin, never shorter than 200 units), so it fills the board instead of shrinking with an empty canvas. It is capped at 960 × 440 px so a big tablet doesn't blow three apples up past hand size.

**The Board Owns the Middle Rule.** On the play screen, nothing is placed over the board. Notices, "heard" strips and "Did you say 12?" sit at the board's foot, in the flow, so the prompt stays visible.

## Elevation & Depth

Kid depth is a **hard ink edge**: `0 5px 0 var(--pp-ink)`, without blur. Pressing moves the control down the same amount and removes its edge; under reduced motion there is no movement. The sandy board has no inset shadow. No glow or gradients except the sky.

Grown-up surfaces keep their existing physical paper and button treatments.

### Shadow Vocabulary
- **Kid edge** (`box-shadow: 0 5px 0 var(--pp-ink)`): white tiles, buttons and cards.
- **Button edge** (`box-shadow: 0 3px 0 var(--felt-deep)`, or `#8f2420` for danger): grown-up buttons. On `:active` the button moves down 3 px and loses the edge.
- **Selected edge** (`box-shadow: 0 3px 0 var(--ink)`): the selected avatar tile.
- **Card lip** (`box-shadow: 0 1px 0 rgba(30, 43, 40, 0.15)`): index cards.
- **Sticky lift** (`box-shadow: 2px 3px 0 rgba(30, 43, 40, 0.25)`, rotated −1.2°): only the sticky draft note.

### Named Rules
**The Solid Edge Rule.** If something can be pressed, it has a hard, unblurred bottom edge in a deeper shade, and pressing it removes that edge. Never use a blurred drop shadow as an affordance.

## Shapes

Shapes are rounded, like the corners of classroom objects, and the radius depends on size and purpose:
- **Kid surfaces** are generous: the board and cards at 28 px, bubble, kid buttons, tiles and keys at 22 px, the mic a full circle.
- **Grown-up surfaces** are tighter, like paper goods: buttons 12 px, inputs 8 px, index cards 6 px, cubes 3 px, the sticky note 2 px.
- **Borders:** 3 px ink on kid tiles, keys, the mic and secondary buttons. 2 px ink on grown-up inputs, avatar tiles and cubes. 4 px Pocket Planet ink frames the sandy board.
- **The index-card tab:** a 10 px coloured strip down the left edge of every card (`--tab`, felt by default).

## Components

### Buttons
Chunky and tactile, like classroom pieces you can press.
- **Kid primary** ("Play again"): orange go with ink text, a 3 px ink border, 22 px radius, hard ink edge, at least 88 px tall, 0 32 px padding, 28 px Andika.
- **Kid secondary**: white with ink text and a 3 px ink border, same size.
- **Grown-up button:** felt with chalk 17 px bold text, 12 px radius, at least 44 px tall, 8 px × 20 px padding, with a 3 px felt-deep drop edge that disappears as the button moves down 3 px when pressed. The press movement is turned off under reduced motion.
- **Grown-up danger:** the same shape in danger red with a `#8f2420` edge. Only for final, destructive steps.
- **Link button:** a text-only underlined link in Link Blue, at least 44 px tall.
- **Disabled:** 0.6 opacity on grown-up pages, 0.45 on kid tiles.

### Answer Tiles and Number Keys
- **Style:** white background, Pocket Planet ink digits at 40 px, a 3 px ink border, 22 px radius, at least 88 × 88 px (72 px tall tiles and 64 px keys on narrow screens).
- **Delete key:** a drawn backspace outline in the same 3 px ink stroke, not a text glyph.
- **Press:** hard ink edge disappears as the tile moves down 5 px; no movement under reduced motion.
- **Focus:** a 3 px Pocket Planet ink outline, offset 3 px.

### Mic
- **Rest:** an 88 px orange go circle with a 3 px ink border and an ink icon.
- **Listening:** counter red with a 1 s soft red pulse ring. Under reduced motion it gets a still 6 px counter-yellow ring instead.
- **Thinking:** Pocket Planet sea.

### Cards / Containers
- **Index card:** white on paper, 6 px radius, a 1 px grid border, the card lip, 12 px × 16 px padding (26 px on the left, to clear the 10 px coloured tab).
- **Picker kid card:** white, 28 px radius, ink border and hard edge, sky avatar circle, mini map and level/shell line.
- **End card:** white on sky, 28 px radius, hard ink edge, hero map and 64 px stat numbers.
- **Speech bubble:** white, 22 px radius, 16 px × 24 px padding, 28 px ink text, with an ink-bordered white tail pointing at Nova. The earlier line is shown at 0.8 em so the new one leads.
- **Sticky note:** counter yellow, 2 px radius, rotated −1.2°. Only for draft or provisional notices.
- **Note:** white with a 6 px Link Blue left rule and 6 px radius, for grown-up info callouts.

### Inputs / Fields
- **Style:** white, a 2 px ink border, 8 px radius, at least 44 px tall, 17 px text. The label sits above in bold.
- **Focus:** a 3 px Link Blue outline, offset 2 px. There is no glow or border-colour change.
- **PIN field:** a 4-cell white box with grid-line dividers and monospace 24 px digits, one per 48 px cell.
- **Avatar picker:** a 4-column grid of 72 px tiles with a 2 px ink border. When selected, the tile turns counter yellow with an ink drop edge.

### Navigation
- **Grown-up strip:** a felt band with small Nova (32 px), "For grown-ups" in bold Andika, and one chalk back link on the right (15 px, at least 44 px tall). Focus is a chalk outline.
- **Kid chrome:** only one quiet link, "Done" on play or "Grown-ups" on the picker. It is Pocket Planet ink at 18 px, underlined, at 0.85 opacity, top right, and never competes with the board.

### Nova (signature)
A purple planet (`--pp-nova`) with a yellow ring (`--pp-sun`) tilted about −12°, front half over the body, an ink outline and a small light highlight. Moods change eyes and mouth: cheer (happy arcs and smile), calm (dots and small smile), curious (one big eye, one small and an "o" mouth). Talking gives a hop and one ring tip (400 ms). A right answer spins the ring once and pops four small yellow stars beside Nova for about 600 ms, never over the board. Reduced motion removes hop, spin and stars; cheer carries the meaning. Sizes: 120 px play, 96 px sign-in, 32 px grown-up strip. When speech is on, Nova is a button that replays its line.

### Island Map
Eight islands follow curriculum order: Counting Cove, Compare Cliffs, Adding Island, Take-Away Bay, Twenty Reef, Tens Town, Hundred Harbor and Story Shore. One flag per skill: up when `mastered_at` exists or the row is placed. Flags never come down, even after a recall returns a skill to practice. New flags are up skills in the finished session's `mastered` list. The boat marks the first flag still down, or all done. This is a look-only map; code chooses the next problem.

The fixed 400 × 160 SVG shows sand/grass islands with up flags and pale dashed islands without them. Up flags and boat are orange. Mini maps have no text; full maps name the current island at 22 px. Image labels say "Map: N islands done. Now on {Island}, K of M flags." (singular for one) or "Map: all islands done!".

At the end-card map moment, new flags rise in sequence (about 250 ms each), then the boat sails (about 600 ms), all within two seconds. It follows the existing rewards drop trigger. Reduced motion shows flags up and boat in place immediately, with no animation.

### Maths Cubes (signature)
A row of 16 px squares with a 2 px ink border and a 3 px radius, filled cube blue or green for each day or session, with "+N" after them. They are the one bold element on grown-up pages.

### Shell Rod / Grown-up Rewards Rod
Kid rewards keep their XP, levels and timing; ten shells replace the cubes visually. Earned shells are filled, and new ones drop into place with the existing reward timing. Under reduced motion they are already in place. The kid rod is labelled "N of 10 shells"; the picker uses a small shell and count instead of a rod. A level-up keeps the full rod above the new one.

The grown-up child page retains ten maths cubes, 16 px each, 2 px ink borders, 3 px radius and 3 px gaps. Earned cubes are cube blue and the rest tray, with the label "N of 10 cubes".

### Stickers
Round tray discs with an ink outline, drawn in the maths-picture family: counters, cubes, ten-frames and number lines for maths stickers, and a cube-blue star for the first game. Counter red and yellow are only for maths stickers. They are 72 px on the end card (at most three, then "+N more") with the label underneath at 22 px, and 36 px on the child page, followed by the label, the reason and the date.

### Week Dots
Seven counters for Sunday to Saturday: 28 px on the end card; none on the picker. A played day is Pocket Planet sun with an ink border, and a day not played yet is tray with a faint ink border. The row is an image labelled "Played N days this week". On the end card the week line ("2 more days for your week goal", "Week goal done!") sits underneath.

## Do's and Don'ts

### Do:
- **Do** use Pocket Planet `--pp-*` tokens on kid screens; keep exercise-book materials and tokens on grown-up pages.
- **Do** keep kid touch targets at 88 px or more on a tablet (64 px or more on a phone) and grown-up targets at 44 px or more.
- **Do** crop every new maths picture to its drawing with the `box` prop of `Svg`, so it fills the board.
- **Do** give anything pressable a hard drop edge in Pocket Planet ink on kid screens and felt-deep or ink on grown-up screens, and remove it on press.
- **Do** set kid-readable text at 22 px or larger in Andika, and keep grown-up body text at 17 px Atkinson Hyperlegible, with lines under 70 characters.
- **Do** show focus as a 3 px solid outline: Pocket Planet ink on kid surfaces, chalk on the grown-up strip, Link Blue on paper.
- **Do** wrap every animation in a `prefers-reduced-motion` fallback (a still state, not just "no animation" when the state carries meaning).
- **Do** keep text contrast at 4.5:1 or above. Kid text is always ink on a light ground; no text on `--pp-sea-deep`.
- **Do** word rewards as what was earned or what comes next ("+75", "Level 2!", "2 more days for your week goal"). Rewards copy never says "lose", "lost", "miss", "break" or "broke", never urges playing more right now, and uses the nickname instead of a gendered pronoun.

### Don't:
- **Don't** add a gamey arcade look: no glossy candy colours, coins, streak flames, confetti storms or loot-box style rewards.
- **Don't** take a reward away or show one shrinking: stickers stay, map flags never come down, levels and shells/cubes only go up, and a quiet week shows empty dots, not a broken streak.
- **Don't** add cartoon clutter: no extra mascots, background scenes or decorative illustrations next to the board. Nova is the only character.
- **Don't** use counter red to mark a wrong answer, or use counter colours as decoration.
- **Don't** use felt on the kid side, white kid text, text on `--pp-sea-deep`, glassmorphism or soft blurred drop shadows as affordances. The sky is the only kid gradient.
- **Don't** put notices or overlays on top of the board. They sit at its foot, in the flow.
- **Don't** use Atkinson Hyperlegible for headings, or bring it into kid screens.
