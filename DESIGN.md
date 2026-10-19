---
name: Brightling AI
description: A patient early-math tutor. Kids play at a felt board, and grown-ups read a squared exercise book.
colors:
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
    backgroundColor: "{colors.tray}"
    textColor: "{colors.ink}"
    typography: "{typography.kid-headline}"
    rounded: "{rounded.tile}"
    size: "88px"
  kid-button-primary:
    backgroundColor: "{colors.felt}"
    textColor: "{colors.chalk}"
    typography: "{typography.kid-title}"
    rounded: "{rounded.kid-button}"
    padding: "0 32px"
    height: "88px"
  kid-button-secondary:
    backgroundColor: "{colors.tray}"
    textColor: "{colors.ink}"
    typography: "{typography.kid-title}"
    rounded: "{rounded.kid-button}"
    padding: "0 32px"
    height: "88px"
  mic:
    backgroundColor: "{colors.felt}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.round}"
    size: "88px"
  mic-listening:
    backgroundColor: "{colors.counter-red}"
  picker-kid-card:
    backgroundColor: "{colors.tray}"
    textColor: "{colors.ink}"
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
---

# Design System: Brightling AI

## Overview

**Creative North Star: "The Math Classroom"**

Brightling is one real early-years classroom drawn as two rooms. The child stands at the **felt board**: deep green felt with a faint nap, chalk-white type, and the same counters, cubes and ten-frames a teacher would stick on it. The grown-up sits at the teacher's desk with the **squared exercise book**: grid paper, index cards with coloured tabs, a sticky note for drafts, and a row of maths cubes as the one bold element. Both rooms use the same felt green, ink and counter colours, so the product feels like a single place.

The kid side is big, calm and tactile. There is one board, one tray of answers and one character (Nova), and nothing competes with the maths. The board is the most important thing on screen. Pieces are chunky, with thick ink borders, a solid drop edge and targets of 88 px or more, because small hands tap them on a tablet. The grown-up side is quiet and easy to read: a single column at most 560 px wide, Atkinson Hyperlegible body text, and plenty of white space, because parents read consent and privacy text here.

It deliberately avoids the **gamey arcade look** (glossy candy colours, coins, streak flames, confetti storms, loot-box rewards) and **cartoon clutter** (busy mascots or background scenes competing with the board).

**Key Characteristics:**
- Real classroom materials (felt, chalk, squared paper, index cards, counters, cubes) instead of digital chrome.
- Flat colour throughout. Depth comes from solid drop edges and one inset board shadow, never from soft floating shadows.
- Chunky, tactile controls: 3 px ink borders, 88 px kid targets, and buttons whose edge drops when pressed.
- Two type voices: Andika (built for early readers) for anything a child reads and for all headings, Atkinson Hyperlegible for grown-up body text.
- Restrained motion: a button press, Nova's hop and antenna blink, and the listening pulse on the mic. All of it is turned off under reduced motion.

## Colors

The palette is a classroom palette: one deep felt green, near-black ink, warm off-whites, and the primary colours of real maths counters, kept for the maths itself.

### Primary
- **Classroom Felt** (`felt`): the kid world's ground. It covers the picker, the play screen and the board itself. On the grown-up side it is used for the top strip and the main buttons. Chalk text on felt has a contrast ratio of 5.75:1.
- **Deep Felt** (`felt-deep`): the board's 8 px frame, the solid drop edge under buttons and cards, and the stroke around Nova. It is the colour of "pressable" and "framed".

### Secondary
- **Counter Yellow** (`counter-yellow`): the yellow counter. It is used for Nova's antenna light, the sticky draft note and the selected avatar tile, and as a still ring on the mic under reduced motion. It means "look here", sparingly.
- **Cube Blue** (`cube-blue`): maths cubes and Nova's chest light. Darkened, it becomes the grown-up link colour.

### Tertiary
- **Counter Red** (`counter-red`): the red counter in the maths pictures, and the mic while it is listening. It never means "wrong".
- **Cube Green** (`cube-green`): the second cube colour in the grown-up week strip. It is currently hard-coded in `grownup.module.css`, not a CSS variable.

### Neutral
- **Classroom Ink** (`ink`): all body text on light surfaces, input and tile borders, and the selected-tile drop edge. On tray it reaches 14:1.
- **Chalk** (`chalk`): type and line art on felt, and every line in the maths visuals.
- **Answer Tray** (`tray`): the warm off-white of the answer tray, the speech bubble, the end card, picker cards and answer tiles.
- **Exercise-Book Paper** (`paper`): the grown-up page ground.
- **Grid Line** (`grid`): 1 px lines on a 20 px square grid behind every grown-up page. It is also used for card borders and list dividers.
- **Quiet Ink** (`ink-quiet`): secondary grown-up text, at 15 px (6.6:1 on paper).
- **Link Blue** (`link`): grown-up links and the 3 px focus ring on grown-up pages (5.4:1 on paper).
- **Danger Red** (`danger`) / **Danger Edge** (`danger-deep`): only final delete buttons and delete links, with the deeper red as their drop edge.

### Named Rules
**The Counters Are for Counting Rule.** Red, yellow, blue and green are the colours of the physical maths pieces. On the kid side they belong to the maths pictures and to Nova's two small lights, with one exception: the mic turns red while it listens. They are never used for decoration or backgrounds, and red is never used for a wrong answer.

**The One Felt Rule.** There is a single green. A screen never adds a second brand hue. New states reuse felt, felt-deep, ink or a counter colour.

## Typography

**Display Font:** Andika (with system-ui, sans-serif)
**Body Font:** Atkinson Hyperlegible (grown-up pages only, with system-ui, sans-serif)

**Character:** Andika was designed for children learning to read. It has a single-storey "a", clear digits and generous counters, so it is the voice of the classroom and of every heading. Atkinson Hyperlegible keeps long grown-up reading (consent, privacy, reports) clear without feeling like a form.

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
**The Twenty-Two Floor Rule.** No text a child is meant to read is smaller than 22 px. Chrome meant for grown-ups on kid screens ("Done", "Grown-ups") sits at 18 px and is visibly quieter.

**The Andika Heads Rule.** Every heading in both worlds is set in Andika. Atkinson is only ever body text.

## Layout

**Kid play screen.** A full-height three-row grid with no scrolling (`100dvh`, overflow hidden):
1. **Top band** (at least 150 px): Nova at 120 px and the speech bubble, capped at 216 px with internal scroll.
2. **Board**, filling the rest of the space, with a 16 px margin. The maths picture is at most 820 px wide.
3. **Answer tray**: 210 px tall in landscape, 260 px in portrait.

Answer tiles sit in one centred row (88–160 px each, 16 px gaps). The number pad is 6 keys × 88 px. In portrait, the mic and the entry stack into a 112 px column beside the keys, so everything fits a 768 px iPad. The end card replaces the board and the tray.

**Picker.** A centred flex column on felt: Nova (120 px) above "Who's playing?", then the kid cards, all 216 px wide so a long name doesn't make its card the odd one out. There are 40 px between the greeting and the cards and 32 px between cards. The grown-ups link sits in the top-right corner.

**Narrow screens (600 px or less: a phone, or a tablet in split view).** Everything stays on one screen and nothing is cut off. On the play screen, "I'm done for now" takes its own row, Nova shrinks to 72 px, tiles share the tray width in one row (at least 72 px tall), and the number pad becomes six keys a row, at least 64 px, with the entry (and the mic) above. The tray grows to fit. The end card's buttons stack. On the picker, cards shrink to 156 px so two fit a row.

**Grown-up pages.** One left-aligned column, at most 560 px wide, with a 20 px side gutter, on the grid paper, plus a felt top strip at the same width. It works from 320 px to tablet landscape. Spacing steps are 8, 12, 16, 24, 28 and 48 px. Sections are separated by 28 px, and the page ends with 48 px of space.

### Named Rules
**The Fill the Board Rule.** A maths picture is cropped to what it draws (plus a 24-unit margin, never shorter than 200 units), so it fills the board instead of shrinking with an empty canvas. It is capped at 960 × 440 px so a big tablet doesn't blow three apples up past hand size.

**The Board Owns the Middle Rule.** On the play screen, nothing is placed over the board. Notices, "heard" strips and "Did you say 12?" sit at the board's foot, in the flow, so the prompt stays visible.

## Elevation & Depth

The system is flat, and depth is physical. Surfaces don't float. They sit on the table with a **solid, unblurred drop edge** in a darker shade (felt-deep or ink), the way a wooden tile or a plastic cube sits on a desk. There is one inset shadow, which sinks the felt board into its frame. Soft blurred shadows appear only twice: the mic's listening pulse, and the faint 1 px lip under index cards.

### Shadow Vocabulary
- **Tile edge** (`box-shadow: 0 6px 0 var(--felt-deep)` on picker cards, `0 8px 0` on the end card): kid surfaces that rest on the felt.
- **Button edge** (`box-shadow: 0 3px 0 var(--felt-deep)`, or `#8f2420` for danger): grown-up buttons. On `:active` the button moves down 3 px and loses the edge.
- **Selected edge** (`box-shadow: 0 3px 0 var(--ink)`): the selected avatar tile.
- **Board well** (`box-shadow: inset 0 4px 18px rgb(0 0 0 / 0.28)`): only on the felt board.
- **Card lip** (`box-shadow: 0 1px 0 rgba(30, 43, 40, 0.15)`): index cards.
- **Sticky lift** (`box-shadow: 2px 3px 0 rgba(30, 43, 40, 0.25)`, rotated −1.2°): only the sticky draft note.

### Named Rules
**The Solid Edge Rule.** If something can be pressed, it has a hard, unblurred bottom edge in a deeper shade, and pressing it removes that edge. Never use a blurred drop shadow as an affordance.

## Shapes

Shapes are rounded, like the corners of classroom objects, and the radius depends on size and purpose:
- **Kid surfaces** are generous: the board and bubble at 24 px, picker cards and the end card at 28 px, kid buttons at 20 px, tiles and keys at 16 px, the mic a full circle.
- **Grown-up surfaces** are tighter, like paper goods: buttons 12 px, inputs 8 px, index cards 6 px, cubes 3 px, the sticky note 2 px.
- **Borders:** 3 px ink on kid tiles, keys, the mic and secondary buttons. 2 px ink on grown-up inputs, avatar tiles and cubes. 8 px felt-deep frames the board.
- **The index-card tab:** a 10 px coloured strip down the left edge of every card (`--tab`, felt by default).

## Components

### Buttons
Chunky and tactile, like classroom pieces you can press.
- **Kid primary** ("Play again"): felt with chalk text, a 3 px felt-deep border, 20 px radius, at least 88 px tall, 0 32 px padding, 28 px Andika.
- **Kid secondary** ("All done"): transparent on tray with ink text and a 3 px ink border, same size.
- **Grown-up button:** felt with chalk 17 px bold text, 12 px radius, at least 44 px tall, 8 px × 20 px padding, with a 3 px felt-deep drop edge that disappears as the button moves down 3 px when pressed. The press movement is turned off under reduced motion.
- **Grown-up danger:** the same shape in danger red with a `#8f2420` edge. Only for final, destructive steps.
- **Link button:** a text-only underlined link in Link Blue, at least 44 px tall.
- **Disabled:** 0.6 opacity on grown-up pages, 0.45 on kid tiles.

### Answer Tiles and Number Keys
- **Style:** tray background, ink digits at 40 px, a 3 px ink border, 16 px radius, at least 88 × 88 px (72 px tall tiles and 64 px keys on narrow screens).
- **Delete key:** a drawn backspace outline in the same 3 px ink stroke, not a text glyph.
- **Press:** scales to 0.97. No colour change.
- **Focus:** a 3 px ink outline, offset 2 px.

### Mic
- **Rest:** an 88 px felt circle with a 3 px ink border and a chalk icon.
- **Listening:** counter red with a 1 s soft red pulse ring. Under reduced motion it gets a still 6 px counter-yellow ring instead.
- **Thinking:** felt-deep.

### Cards / Containers
- **Index card:** white on paper, 6 px radius, a 1 px grid border, the card lip, 12 px × 16 px padding (26 px on the left, to clear the 10 px coloured tab).
- **Picker kid card:** tray, 28 px radius, a 6 px felt-deep edge, a 112 px felt avatar circle with a 64 px emoji, scaling to 0.97 when pressed.
- **End card:** tray on felt, 28 px radius, an 8 px felt-deep edge, 64 px stat numbers.
- **Speech bubble:** tray, 24 px radius, 16 px × 24 px padding, 28 px text, with a tail (a 24 px tray diamond, half tucked under) pointing at Nova. The earlier line is shown at 0.8 em so the new one leads.
- **Sticky note:** counter yellow, 2 px radius, rotated −1.2°. Only for draft or provisional notices.
- **Note:** white with a 6 px Link Blue left rule and 6 px radius, for grown-up info callouts.

### Inputs / Fields
- **Style:** white, a 2 px ink border, 8 px radius, at least 44 px tall, 17 px text. The label sits above in bold.
- **Focus:** a 3 px Link Blue outline, offset 2 px. There is no glow or border-colour change.
- **PIN field:** a 4-cell white box with grid-line dividers and monospace 24 px digits, one per 48 px cell.
- **Avatar picker:** a 4-column grid of 72 px tiles with a 2 px ink border. When selected, the tile turns counter yellow with an ink drop edge.

### Navigation
- **Grown-up strip:** a felt band with small Nova (32 px), "For grown-ups" in bold Andika, and one chalk back link on the right (15 px, at least 44 px tall). Focus is a chalk outline.
- **Kid chrome:** only one quiet link, "Done" on play or "Grown-ups" on the picker. It is chalk at 18 px, underlined, at 0.85 opacity, top right, and never competes with the board.

### Nova (signature)
The one character: a rounded tray-coloured body with a felt-deep outline, an ink visor with chalk eyes, a counter-yellow antenna light and a cube-blue chest light. There are three expressions, all made by changing the eyes: cheer (happy arcs), calm (dots) and curious (one wide, one small eye). Nova hops 24 px with the antenna blinking once (400 ms) when it speaks. Nova is 120 px on play, 96 px on sign-in and 32 px in the grown-up strip. When speech is on, Nova is a button that replays its line.

### Maths Cubes (signature)
A row of 16 px squares with a 2 px ink border and a 3 px radius, filled cube blue or green for each day or session, with "+N" after them. They are the one bold element on grown-up pages.

### The Felt Board (signature)
Felt with a two-layer radial-dot nap, an 8 px felt-deep frame, a 24 px radius and the board-well inset shadow. It holds the chalk-line maths picture and the 28 px prompt underneath.

## Do's and Don'ts

### Do:
- **Do** build every new piece from classroom materials (felt, chalk, tray, squared paper, index cards, counters, cubes) and name its tokens after them.
- **Do** keep kid touch targets at 88 px or more on a tablet (64 px or more on a phone) and grown-up targets at 44 px or more.
- **Do** crop every new maths picture to its drawing with the `box` prop of `Svg`, so it fills the board.
- **Do** give anything pressable a hard drop edge in felt-deep or ink, and remove it on press.
- **Do** set kid-readable text at 22 px or larger in Andika, and keep grown-up body text at 17 px Atkinson Hyperlegible, with lines under 70 characters.
- **Do** show focus as a 3 px solid outline: chalk on felt, ink on tray, Link Blue on paper.
- **Do** wrap every animation in a `prefers-reduced-motion` fallback (a still state, not just "no animation" when the state carries meaning).
- **Do** keep text contrast at 4.5:1 or above. Check any new pairing; chalk on felt is 5.75:1.

### Don't:
- **Don't** add a gamey arcade look: no glossy candy colours, coins, streak flames, confetti storms or loot-box style rewards.
- **Don't** add cartoon clutter: no extra mascots, background scenes or decorative illustrations next to the board. Nova is the only character.
- **Don't** use counter red to mark a wrong answer, or use counter colours as decoration.
- **Don't** introduce a second green, gradients, glassmorphism, or soft blurred drop shadows as affordances.
- **Don't** put notices or overlays on top of the board. They sit at its foot, in the flow.
- **Don't** use Atkinson Hyperlegible for headings, or bring it into kid screens.
