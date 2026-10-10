# Grown-up screens (Plan 6) — design

Date: 2026-10-10. Gives the parent-facing screens a real visual design before the pilot. The kid screens (the "Who's playing?" picker and play) are unchanged.

## Owner decisions (2026-10-10)

| Question | Decision |
|---|---|
| Scope | Parent side and sign-in. No landing page; kid screens untouched |
| Direction | "Exercise book" (chosen over "Daylight" and "Felt all the way") |
| Child's page | Add a "this week" summary; the raw data moves one tap down |

Mockups: `.superpowers/brainstorm/*/content/exercise-book-v2.html` (git-ignored).

## Idea

The kid side is the felt board. The grown-up side is the squared math exercise book from the same classroom: grid paper, index cards, and the maths cubes kids already count with. The cubes are the one bold element. Everything else stays quiet, and the text is easy to read, because parents read the privacy notice and the consent text here.

## Tokens

Grown-up tokens live in their own file, `src/app/parent/grownup.css`, imported only by grown-up pages. The kid tokens in `src/app/play/tokens.css` stay as they are; shared values are reused, not copied.

| Token | Value | Use |
|---|---|---|
| `--paper` | `#f6f8f5` | Page background |
| `--grid` | `#dbe6ee` | 1 px grid lines, 20 px squares |
| `--ink` | `#1e2b28` (kid token) | Text, input borders |
| `--ink-quiet` | `#4d5c58` | Secondary text (≥ 4.5:1 on paper) |
| `--felt` / `--felt-deep` | kid tokens | Top strip, main buttons, button edge |
| `--link` | `#2a64b8` | Links: cube blue darkened to meet 4.5:1 on paper |
| `--sticky` | `#f6c531` (counter yellow) | Draft notice |
| `--danger` | `#c3332d` | Final delete buttons and links only (≥ 4.5:1) |

**Type:**
- Headings use Andika, the kid font, which is already loaded.
- Body text uses Atkinson Hyperlegible 400 and 700, loaded via `next/font/google` on grown-up pages only.
- Sizes:
  - body 17 px, line-height 1.5
  - secondary text 15 px
  - h1 32 px
  - h2 21 px
  - the sign-in page's app name 48 px
- Lines stay under 70 characters.

**Shape:**
- Buttons: radius 12 px, with a 3 px `--felt-deep` bottom edge that drops on press.
- Inputs: radius 8 px, with a 2 px `--ink` border.
- Index cards: radius 6 px.

## Layout

- **Frame:** one left-aligned column, at most 560 px wide, with a 20 px side gutter, on the grid paper.
- **Top strip:** a felt strip runs across the top: Nova (small), the words "For grown-ups", and on the right one back link ("Back to kids", or "Your kids" on inner pages).
- **Sign-in and "check your email":** these have no strip. Instead they show Nova large and "Math Friend" at 48 px.
- **Sizes:** works from 320 px (phone, where parents open the sign-in email) to tablet landscape.
- **Basics:**
  - tap targets of 44 px or more
  - visible focus: a 3 px `--link` outline
  - no new motion apart from the button press

## Shared parts (`src/app/parent/ui/`)

| Part | Does |
|---|---|
| `GrownupFrame` | The page frame: paper, strip with back link, column. A `bare` variant for sign-in has no strip and shows the big title |
| `IndexCard` | A white card with a 10 px coloured tab on the left. Used for each child, and for the consent summary |
| `Cubes` | A row of squares: `filled` of `total`, in one colour, with an accessible label (e.g. "Played 4 of the last 7 days") |
| `StickyNote` | The draft banner as a yellow note tilted −1.2°. The text stays exactly `DRAFT_BANNER` |
| `PinField` | One real `<input>` (numeric, 4 digits, same label) drawn as four joined grid squares |
| Avatar faces and colours | `src/app/avatars.ts`: the emoji map that is now inside the picker page, plus one tab colour per avatar (fox `#e4413b`, bear `#a0673a`, owl `#8a6bbf`, frog `#4c9a52`, duck `#f6c531`, rabbit `#e88fb0`, cat `#ef8a2f`, turtle `#3b7dd8`). The picker imports it too |

## Screens

| Screen | Changes |
|---|---|
| Sign in | Bare frame. Line under the title: "Nova, a patient math tutor for kids aged 5 to 11. Grown-ups sign in here." Field "Your email". Button "Email me a sign-in link". Small print "No password to remember." The deleted and expired-link messages show as notes above the field |
| Check your email | Bare frame. "Check your email". "We sent a sign-in link to you. Open it on any device." |
| Set a PIN / Enter PIN | Strip, back link "Back to kids". `PinField`. "Forgot PIN" becomes a link-styled button |
| Consent | Strip. `StickyNote`. Heading "One step before your child plays". The notice summary sits in an `IndexCard` with a link to the full notice, followed by the card-check sentence, the checkbox and the button (both unchanged). Error and cancelled messages are kept |
| Privacy notice | Strip. `StickyNote`. Sections as h2 and lists; the version line in small print |
| Your kids (`/parent`) | Heading "Your kids". One `IndexCard` per child, with the avatar face, the name, and "Kindergarten, played today". The whole card links to the child's page. Then "Add a child" (button) and "Account and privacy" (link). The no-consent prompt stays, as an `IndexCard` with a "Give consent" button |
| Add a child | Heading "Add a child". Name field "First name only". The grade select shows "Kindergarten", "Grade 1"…"Grade 5" (values unchanged). The avatar choice is a 4×2 grid of face tiles (radio inputs whose label is the avatar name, shown under the face). Button "Save" |
| A child's page | Heading "🦊 Mia's week", then the summary (below). Links: "See everything we store about Mia" (opens the existing tables, styled), "Download Mia's data", and "Delete Mia" (in `--danger`; the type-the-name step is unchanged) |
| Account | Strip. Delete-account section with the type-DELETE step unchanged; red only on the final button. A link to the privacy notice |

**Wording rule:** the meaning of every action stays the same, and only labels change. The e2e tests that select by old labels ("Send link", "Add kid", "Parent area", "Back") are updated in the same task as the screen.

## New data (two small features)

1. **"Played today" on Your kids.** `lastPlayedLabel(last: Date | null, now: Date)` is pure and lives in `src/server/parentSummary.ts`. Dates are in `America/New_York`, the same zone as the weekly report, for the pilot. It returns:
   - "played today"
   - "played yesterday"
   - "played on Tuesday" (2–6 days ago)
   - "played on Oct 3" (older)
   - "hasn't played yet"

   The last-played time is the newest `attempts.at` for the kid. One query for all kids on the page.
2. **The week on a child's page:**
   - **Range:** the last 7 days, ending now. This is not the report's Sunday week; a page should always show recent play.
   - **Content:**
     - "4 sessions, 38 minutes"
     - `Cubes` of 7: days with at least one attempt, filled blue
     - "Mastered: …", with one green cube per skill (at most 10 drawn, then "+N")
     - "Working on adding within 10. Tricky part: …"
   - **Source:** sessions, minutes, mastered, current skill and stuck points come from the existing `collectWeek` logic, refactored so it can run for one kid and any range without copying code. Days played is computed from the same attempts.
   - **Empty state:** "Mia hasn't played this week. Hand over the tablet and tap Mia to start."

## Not changing

- Kid screens and their tokens.
- Routes, server actions, guards, consent and PIN logic, the privacy notice text and version.
- No CSS framework and no component library. CSS modules plus one tokens file, as on the kid side.

## Testing

- **Unit:**
  - `lastPlayedLabel`: every branch, including just after midnight New York time and day-boundary cases.
  - The one-kid week: days-played count; the empty week.
  - `Cubes`: its label and the "+N" overflow.
- **DB:** the one-kid week and last-played query against local Supabase, including a different family's kid (no data).
- **E2E:**
  - The existing suites pass with updated labels.
  - Add-a-child picks an avatar by its label.
  - The child page shows "Mia's week" after one answered problem.
- **Screenshots:** every grown-up screen at 1024×768 and 390×844 (written to `test-results/`, not committed), checked by eye and shown to the owner before merge.
- **Accessibility:** every input keeps a label; contrast is as stated in the tokens table; focus is visible on every link and button.
