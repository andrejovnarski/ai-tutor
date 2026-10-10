# Grown-up Screens (Plan 6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every parent-facing screen the "exercise book" design. Also add "played today" on Your kids and a cube-drawn "week" on a child's page.

**Architecture:**
- **Shared visual parts:** a small set in `src/app/parent/ui/`, styled by one CSS module that carries the grown-up tokens on the frame's root element, so nothing leaks into the kid screens.
- **Data:** two small server reads. A pure `lastPlayedLabel` with a last-played query, and a one-kid week split out of the weekly report's `collectWeek`.
- **Screens:** restyled one group per task. The e2e tests are updated in the same task as their screen.

**Tech Stack:** Next.js 16 app router (server components, server actions), CSS modules, `next/font/google`, Supabase JS, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-10-grownup-screens-design.md`

## Global Constraints

- **Out of bounds:** the kid screens (`src/app/page.tsx` picker look, `src/app/play/**`) and `src/app/play/tokens.css` keep their look. The only change allowed there is the picker importing the faces map from `src/app/avatars.ts`.
- **No changes to logic:** routes, server actions, guards, consent and PIN logic, `NOTICE_SECTIONS`/`NOTICE_SUMMARY`/`PRIVACY_NOTICE_VERSION`/`DRAFT_BANNER` text.
- **No new dependencies.** No CSS framework, no component library.
- **Tokens:** `--paper #f6f8f5`, `--grid #dbe6ee`, `--ink #1e2b28`, `--ink-quiet #4d5c58`, `--felt #2e6b5e`, `--felt-deep #23544a`, `--chalk #f4f7f2`, `--link #2a64b8`, `--sticky #f6c531`, `--danger #c3332d`.
- **Type:**
  - Andika for headings (already loaded as `--font-andika`); Atkinson Hyperlegible 400/700 for body.
  - Sizes: body 17 px / line-height 1.5, secondary 15 px, h1 32 px, h2 21 px, sign-in app name 48 px.
  - Lines under 70 characters.
- **Layout and shape:**
  - Grid: 1 px lines, 20 px squares.
  - Column: left-aligned, max 560 px, 20 px side gutter. Works from 320 px wide.
  - Buttons: radius 12 px, with a 3 px `--felt-deep` bottom edge that drops on `:active`.
  - Inputs: radius 8 px, 2 px `--ink` border.
  - Index cards: radius 6 px, 10 px left tab.
- **Accessibility:**
  - Tap targets ≥ 44 px.
  - Focus: 3 px `--link` outline on every link, button and input.
  - Every input keeps a `<label>`.
  - No new motion except the button press, and none at all under `prefers-reduced-motion: reduce`.
- **Avatar tab colours:** fox `#e4413b`, bear `#a0673a`, owl `#8a6bbf`, frog `#4c9a52`, duck `#f6c531`, rabbit `#e88fb0`, cat `#ef8a2f`, turtle `#3b7dd8`.
- **Dates:** in `America/New_York`.
- **Copy:** US spelling ("math"); sentence case; no "→" on links; no all-caps labels; no middle-dot separators.
- **Commits:** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never stage `vault/**` or `AGENTS.md`.
- **Docker:** db and e2e suites need local Supabase. Run Docker commands as `echo '<cmd>' | newgrp docker`. Only run the db suite against the local stack.

## Review Focus

1. **A long nickname** (40 characters, the max) on the index card, the h1 "…'s week" and the delete button: it must wrap, never overflow at 320 px. Pinned by the screenshot task at 390 px, with a 40-character kid.
2. **Last play near midnight New York time** (e.g. 04:30 UTC, which is still "yesterday" in NY): `lastPlayedLabel` must use the NY calendar day, not UTC. Pinned in Task 2's unit tests.
3. **A different family's kid id in the URL** of the child page: still 404, and the week query returns nothing for it. Pinned in Task 2's db test and kept by Task 6 (it calls `notFound()` before the week read).
4. **A kid with attempts but every one older than 7 days:** the empty-week sentence shows; no zero-cube row with "0 sessions, 0 minutes". Pinned in Task 6's unit test of the summary component.
5. **iOS Safari zoom on input focus:** every input, select and PIN field must be ≥ 16 px font-size or Safari zooms the page. Pinned in Task 1's CSS (`font-size: 17px` on inputs) and checked by the screenshot task.

---

### Task 1: Foundations: tokens, fonts, shared parts, avatars

**Files:**
- Create: `src/app/avatars.ts`
- Create: `src/app/parent/ui/grownup.module.css`, `src/app/parent/ui/fonts.ts`, `src/app/parent/ui/GrownupFrame.tsx`, `src/app/parent/ui/IndexCard.tsx`, `src/app/parent/ui/Cubes.tsx`, `src/app/parent/ui/StickyNote.tsx`, `src/app/parent/ui/PinField.tsx`
- Test: `src/app/parent/ui/ui.test.tsx`, `src/app/avatars.test.ts`
- Modify: `vitest.config.ts` (include `src/app/**/*.test.{ts,tsx}` instead of only the play folder), `src/app/page.tsx` (import `AVATAR_FACE` from `./avatars` instead of its local `FACES`)

**Interfaces:**
- Produces:
  - `AVATAR_FACE: Record<Avatar, string>` and `AVATAR_COLOR: Record<Avatar, string>`, plus `faceOf(avatar: string): string` and `colorOf(avatar: string): string`. An unknown avatar gives the avatar string itself and `--felt` `#2e6b5e` respectively.
  - `GrownupFrame({ back?: { href: string; label: string }; bare?: boolean; children })`. Renders `<main>` with the module's `frame` class (tokens live on it) plus the Atkinson font variable class. Unless `bare`, it also renders the felt strip with a small Nova SVG, the text "For grown-ups" and the back link. When `bare`, it renders a large Nova and the text "Math Friend" (the 48 px title, as a `<p>`, so pages keep their own h1).
  - `IndexCard({ color: string; href?: string; children })`. When `href` is given, the whole card is one `<Link>`.
  - `Cubes({ filled: number; total: number; color: "blue" | "green"; label: string; max?: number })`:
    - renders `role="img"` with `aria-label={label}`
    - draws `min(total, max ?? total)` squares, of which `min(filled, drawn)` are filled
    - when `filled > max`, adds a visible `+N` (N = filled − max)
  - `StickyNote({ children })`.
  - `PinField({ name: string; label: string })`. One `<input type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required autoComplete="off">` inside a `<label>` whose text is `label`. The four squares are drawn behind it with CSS.
  - CSS class names exported from `grownup.module.css` for later tasks: `frame`, `col`, `h1`, `lede`, `quiet`, `btn`, `btnDanger`, `linkBtn`, `field`, `input`, `select`, `note` (alert/status messages), `section`, `tableWrap`, `faces` (avatar grid), `faceTile`, `visuallyHidden`.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/app/avatars.test.ts
import { AVATARS } from "@/server/kidProfile";
import { AVATAR_COLOR, AVATAR_FACE, colorOf, faceOf } from "./avatars";
it("has a face and a tab colour for every avatar", () => {
  for (const a of AVATARS) { expect(AVATAR_FACE[a]).toBeTruthy(); expect(AVATAR_COLOR[a]).toMatch(/^#[0-9a-f]{6}$/); }
  expect(AVATAR_COLOR.fox).toBe("#e4413b"); expect(AVATAR_COLOR.turtle).toBe("#3b7dd8");
});
it("falls back for an unknown avatar", () => { expect(faceOf("yeti")).toBe("yeti"); expect(colorOf("yeti")).toBe("#2e6b5e"); });

// src/app/parent/ui/ui.test.tsx (renderToStaticMarkup, as in src/app/play/answer.test.tsx)
it("Cubes labels itself and fills the right count", () => {
  const html = renderToStaticMarkup(<Cubes filled={4} total={7} color="blue" label="Played 4 of the last 7 days" />);
  expect(html).toContain('role="img"'); expect(html).toContain('aria-label="Played 4 of the last 7 days"');
  expect(html.match(/data-filled="true"/g)).toHaveLength(4); expect(html.match(/data-cube/g)).toHaveLength(7);
});
it("Cubes caps at max and shows +N", () => {
  const html = renderToStaticMarkup(<Cubes filled={13} total={13} color="green" label="13 skills" max={10} />);
  expect(html.match(/data-cube/g)).toHaveLength(10); expect(html).toContain("+3");
});
it("GrownupFrame shows the strip and back link, or the big title when bare", () => {
  const strip = renderToStaticMarkup(<GrownupFrame back={{ href: "/", label: "Back to kids" }}><h1>X</h1></GrownupFrame>);
  expect(strip).toContain("For grown-ups"); expect(strip).toContain('href="/"'); expect(strip).toContain("Back to kids");
  const bare = renderToStaticMarkup(<GrownupFrame bare><h1>X</h1></GrownupFrame>);
  expect(bare).toContain("Math Friend"); expect(bare).not.toContain("For grown-ups");
});
it("PinField keeps a labelled 4-digit numeric input", () => {
  const html = renderToStaticMarkup(<PinField name="pin" label="New PIN" />);
  expect(html).toContain("New PIN"); expect(html).toMatch(/inputmode="numeric"/i); expect(html).toMatch(/maxlength="4"/i);
});
it("IndexCard with href is one link", () => {
  const html = renderToStaticMarkup(<IndexCard color="#e4413b" href="/parent/kids/1">Mia</IndexCard>);
  expect(html.match(/<a /g)).toHaveLength(1); expect(html).toContain("#e4413b");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/avatars.test.ts src/app/parent/ui/ui.test.tsx`
Expected: FAIL. The modules don't exist yet (and the ui test isn't collected until `vitest.config.ts` is widened, so widen it first).

- [ ] **Step 3: Implement**
  - **`fonts.ts`:**
    - `Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--font-atkinson" })` from `next/font/google`.
    - In Vitest, `next/font/google` is unavailable. Mock it in `ui.test.tsx` with `vi.mock("next/font/google", () => ({ Atkinson_Hyperlegible: () => ({ variable: "atk" }) }))`.
  - **`grownup.module.css`:**
    - `.frame` declares every token from Global Constraints as custom properties.
    - The paper grid: `background-image: linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px); background-size: 20px 20px`.
    - `min-height: 100dvh`.
    - Body font `var(--font-atkinson)`; headings `var(--font-andika)`.
    - `.input` and `.select` use `font-size: 17px` (Review Focus 5).
    - Focus: `:focus-visible { outline: 3px solid var(--link); outline-offset: 2px }`.
    - Inside `@media (prefers-reduced-motion: reduce)`, drop the button `:active` translate.
  - **Nova SVG:** copy the shapes from `src/app/play/Nova.tsx` (cheer eyes). Don't import the play component; its CSS module brings the hop animation.
  - **`.visuallyHidden`:** the standard clip pattern.
  - **`page.tsx` (picker):** replace the local `FACES` with `faceOf(k.avatar)`.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/app && npm run typecheck`
Expected: PASS, no type errors. All earlier play tests still pass under the widened include.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts src/app/avatars.ts src/app/avatars.test.ts src/app/page.tsx src/app/parent/ui
git commit -m "feat: grown-up design tokens and shared parts (exercise book)"
```

---

### Task 2: Data: last played and the one-kid week

**Files:**
- Create: `src/server/parentSummary.ts`, `src/server/parentSummary.test.ts`
- Modify: `src/server/report/collect.ts` (extract `collectKid`; `collectWeek` calls it)
- Test: `tests/db/parentSummary.db.test.ts`

**Interfaces:**
- Consumes: `KidWeek` from `src/server/report/build.ts` (unchanged).
- Produces:
  - `lastPlayedLabel(last: Date | null, now: Date): string`. Returns exactly one of:
    - `"hasn't played yet"`
    - `"played today"`
    - `"played yesterday"`
    - `"played on <Weekday>"` for 2–6 NY calendar days ago, weekday spelled out in full, e.g. `"played on Tuesday"`
    - `"played on <Mon> <D>"` for 7 or more days ago, e.g. `"played on Oct 3"`
  - `lastPlayed(db: SupabaseClient, kidIds: string[]): Promise<Map<string, Date>>`. Holds the newest `attempts.at` per kid; kids with no attempts are absent. One `limit(1)` query per kid, all run in parallel.
    - Ruling: the spec says "one query". PostgREST has no per-group limit without an RPC, and a family has a handful of kids, so parallel indexed queries (`attempts_kid_at`) are the cheaper choice than a migration.
  - `collectKid(db: SupabaseClient, kid: KidRow & { nickname: string }, from: Date, to: Date): Promise<{ week: KidWeek; playedDays: string[] }>`. `playedDays` holds the distinct NY calendar dates (`"YYYY-MM-DD"`) that have at least one attempt in `[from, to)`, ascending. `collectWeek` keeps its signature and returns `week` from `collectKid` for each kid.
  - `kidWeek(db: SupabaseClient, kidId: string, now: Date): Promise<{ week: KidWeek; playedDays: string[] } | null>`. Reads the kid row (`id, nickname, grade, age_band, placed`) via `db`. Returns `null` when the kid isn't visible to `db`; RLS hides other families' kids. Otherwise returns `collectKid(db, kid, now − 7 days, now)`.

- [ ] **Step 1: Write the failing unit tests (`src/server/parentSummary.test.ts`)**

```ts
const now = new Date("2026-10-10T18:00:00Z"); // Saturday, 14:00 in New York
it.each([
  [null, "hasn't played yet"],
  ["2026-10-10T13:00:00Z", "played today"],
  ["2026-10-10T04:30:00Z", "played today"],           // 00:30 EDT Oct 10
  ["2026-10-10T03:30:00Z", "played yesterday"],       // 23:30 EDT Oct 9 (already Oct 10 in UTC)
  ["2026-10-06T15:00:00Z", "played on Tuesday"],
  ["2026-10-04T15:00:00Z", "played on Sunday"],       // 6 days ago
  ["2026-10-03T15:00:00Z", "played on Oct 3"],        // 7 days ago
])("%s → %s", (iso, label) => expect(lastPlayedLabel(iso ? new Date(iso) : null, now)).toBe(label));
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/server/parentSummary.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lastPlayedLabel`**

Compare NY calendar dates. Use `Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" })` to get the `YYYY-MM-DD` of `last` and of `now`, then take the whole-day difference of those dates parsed as UTC midnight. Weekday names and `Oct 3` come from `Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long" })` and `{ month: "short", day: "numeric" }`.

- [ ] **Step 4: Run unit tests**

Run: `npx vitest run src/server/parentSummary.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing db test (`tests/db/parentSummary.db.test.ts`)**

Follow `tests/db/report.db.test.ts` setup (`makeParent`, admin inserts). Cases:
  - `lastPlayed`:
    - a kid with attempts at T1 < T2 maps to T2
    - a kid with no attempts is absent
  - `kidWeek` with the signed-in parent's own client:
    - attempts on two different NY days in the last 7 days, plus one 8 days ago: `playedDays` has length 2 and `week.sessions` counts only the in-range sessions
  - `kidWeek` for another family's kid id with parent A's client returns `null`
  - `collectWeek` output for a kid is still equal to `collectKid(...).week`, so the weekly report is unchanged. `report.db.test.ts` must still pass untouched.

- [ ] **Step 6: Implement `lastPlayed`, `collectKid`, `kidWeek`; run db tests**

Run: `npm run test:db -- parentSummary report`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/server/parentSummary.ts src/server/parentSummary.test.ts src/server/report/collect.ts tests/db/parentSummary.db.test.ts
git commit -m "feat: last-played label and one-kid week for the parent pages"
```

---

### Task 3: Sign in, check your email, PIN

**Files:**
- Modify: `src/app/sign-in/page.tsx`, `src/app/parent/pin/page.tsx`
- Modify: `tests/e2e/helpers.ts` (`requestLink`: label `"Your email"`, button `"Email me a sign-in link"`)

**Interfaces:**
- Consumes: `GrownupFrame`, `PinField`, the CSS module classes (Task 1).

- [ ] **Step 1: Update `helpers.ts` to the new labels and run the sign-in e2e to see it fail**

Run: `npx playwright test tests/e2e/sign-in.spec.ts`
Expected: FAIL (no "Email me a sign-in link" button)

- [ ] **Step 2: Restyle the pages**
  - **Sign in** (`<GrownupFrame bare>`):
    - h1 "Sign in".
    - Lede "Nova, a patient math tutor for kids aged 5 to 11. Grown-ups sign in here."
    - The `deleted` status and `error=link` alert keep their exact text, in `.note`.
    - Label "Your email", button "Email me a sign-in link", then quiet line "No password to remember."
  - **Sent state** (`bare`): h1 "Check your email", text "We sent a sign-in link to you. Open it on any device."
  - **PIN** (`back={{ href: "/", label: "Back to kids" }}`):
    - Set a PIN: h1 "Set a PIN", lede "This 4-digit PIN keeps the parent area for grown-ups." `PinField`s labelled "New PIN" and "Repeat PIN", button "Save PIN".
    - Unlock: h1 "Enter your PIN", lede "So little fingers stay on the kids' side." `PinField` labelled "PIN", button "Unlock". The "Forgot PIN" form button gets class `linkBtn`.
    - `MESSAGES` text unchanged, in `.note` with the same `role="alert"`.

- [ ] **Step 3: Run the affected e2e suites**

Run: `npx playwright test tests/e2e/sign-in.spec.ts tests/e2e/parent.spec.ts`
Expected: PASS. If a test looks for the old "Parent area" heading on the unlock page, update it to "Enter your PIN" in this step.

- [ ] **Step 4: Commit**

```bash
git add src/app/sign-in/page.tsx src/app/parent/pin/page.tsx tests/e2e
git commit -m "feat: exercise-book sign-in and PIN screens"
```

---

### Task 4: Consent, privacy notice, account

**Files:**
- Modify: `src/app/parent/consent/page.tsx`, `src/app/parent/consent/ConsentForm.tsx` (classes only), `src/app/parent/privacy/page.tsx`, `src/app/parent/account/page.tsx`

**Interfaces:**
- Consumes: `GrownupFrame`, `IndexCard`, `StickyNote`, CSS classes (Task 1).

- [ ] **Step 1: Restyle**
  - **Consent** (`back={{ href: "/parent", label: "Your kids" }}`):
    - `<StickyNote>{DRAFT_BANNER}</StickyNote>` (keep the `role="note"` wrapper).
    - h1 "One step before your child plays".
    - An `IndexCard color="var(--felt)"` holding `NOTICE_SUMMARY` and the link "Read the full privacy notice".
    - The card-check sentence, the error/cancelled messages (text unchanged), then `ConsentForm`: checkbox label and button text unchanged, button gets `btn`. The old bottom "Back" link goes; the strip's back link replaces it.
  - **Privacy** (`back={{ href: "/parent/consent", label: "Back to consent" }}`): `StickyNote`, h1 "Privacy notice", summary as lede, each section as h2 and list, version line in `.quiet`.
  - **Account** (`back={{ href: "/parent", label: "Your kids" }}`):
    - h1 "Account".
    - A link "Read the privacy notice" to `/parent/privacy`.
    - The h2 and paragraph unchanged; the confirm field in `.field`/`.input`.
    - The submit button gets `btnDanger`, text unchanged.

- [ ] **Step 2: Run the affected e2e suites**

Run: `npx playwright test tests/e2e/consent.spec.ts tests/e2e/rights.spec.ts`
Expected: PASS. "Draft — pending legal review" and the "Not a crisis service" heading are still found. Fix any "Back" link lookups to the strip's link name in this step.

- [ ] **Step 3: Commit**

```bash
git add src/app/parent/consent src/app/parent/privacy src/app/parent/account tests/e2e
git commit -m "feat: exercise-book consent, privacy and account screens"
```

---

### Task 5: Your kids and add a child

**Files:**
- Modify: `src/app/parent/page.tsx`, `src/app/parent/kids/new/page.tsx`
- Modify: `tests/e2e/helpers.ts` (`addKid`: link `"Add a child"`), `tests/e2e/parent.spec.ts`, `tests/e2e/consent.spec.ts` (`"Add kid"` → `"Add a child"`)

**Interfaces:**
- Consumes: `lastPlayed`, `lastPlayedLabel` (Task 2); `IndexCard`, `colorOf`, `faceOf`, `GrownupFrame` (Task 1).

- [ ] **Step 1: Update the e2e labels; run to see them fail**

Run: `npx playwright test tests/e2e/parent.spec.ts tests/e2e/consent.spec.ts`
Expected: FAIL (no "Add a child" link)

- [ ] **Step 2: Your kids** (`back={{ href: "/", label: "Back to kids" }}`)
  - h1 "Your kids".
  - **Without consent:** an `IndexCard color="var(--sticky)"` with the existing sentence "Before your kid can play, we need a parent's consent." and a `btn`-styled link "Give consent".
  - **Each kid:** an `IndexCard color={colorOf(k.avatar)} href={`/parent/kids/${k.id}`}`. It shows the face, the name in Andika, and a quiet line `${gradeName(k.grade)}, ${lastPlayedLabel(map.get(k.id) ?? null, new Date())}`.
    - `gradeName`: `"K"` gives `"Kindergarten"`, otherwise `` `Grade ${g}` ``. Put it in `src/app/avatars.ts`'s neighbour `src/app/grades.ts`, with a one-line unit test.
  - **With consent:** a `btn`-styled link "Add a child".
  - A link "Account and privacy" to `/parent/account`.
  - The old "Back" link goes.

- [ ] **Step 3: Add a child** (`back={{ href: "/parent", label: "Your kids" }}`)
  - h1 "Add a child"; error message text unchanged.
  - Label "First name only".
  - The grade `<select>` option labels come from `gradeName`; values are unchanged.
  - The avatar fieldset has legend "Avatar". It holds a 4×2 `.faces` grid. Each tile is a `<label className={faceTile}>` containing the radio (visually hidden but focusable, with the focus ring drawn on the tile via `:has(:focus-visible)`), the face emoji `aria-hidden`, and the avatar name as visible text. `getByLabel("fox")` must still work.
  - Button "Save".

- [ ] **Step 4: Run e2e**

Run: `npx playwright test tests/e2e/parent.spec.ts tests/e2e/consent.spec.ts tests/e2e/journey.spec.ts && npx vitest run src/app`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/parent/page.tsx src/app/parent/kids/new/page.tsx src/app/grades.ts src/app/grades.test.ts tests/e2e
git commit -m "feat: exercise-book Your kids (with last played) and Add a child"
```

---

### Task 6: A child's page

**Files:**
- Create: `src/app/parent/kids/[kidId]/WeekSummary.tsx`, `src/app/parent/kids/[kidId]/WeekSummary.test.tsx`
- Modify: `src/app/parent/kids/[kidId]/page.tsx`, `tests/e2e/rights.spec.ts`

**Interfaces:**
- Consumes: `kidWeek` (Task 2); `Cubes`, `GrownupFrame`, `faceOf` (Task 1).
- Produces: `WeekSummary({ nickname: string; week: KidWeek; playedDays: string[] })`.

- [ ] **Step 1: Write the failing component tests**

```tsx
const base = { nickname: "Mia", sessions: 4, minutes: 38, mastered: ["Counting to 20", "Adding within 5"], currentSkill: "Adding within 10", stuck: ["counting on from the bigger number"] };
it("shows sessions, minutes, day cubes, mastered cubes and the current skill", () => {
  const html = renderToStaticMarkup(<WeekSummary nickname="Mia" week={base} playedDays={["2026-10-05","2026-10-06","2026-10-08","2026-10-10"]} />);
  expect(html).toContain("4 sessions, 38 minutes");
  expect(html).toContain('aria-label="Played 4 of the last 7 days"');
  expect(html).toContain("Mastered: Counting to 20, Adding within 5");
  expect(html).toContain("Working on <b>Adding within 10</b>. Tricky part: counting on from the bigger number.");
});
it("uses singular forms", () => {
  const html = renderToStaticMarkup(<WeekSummary nickname="Mia" week={{ ...base, sessions: 1, minutes: 1 }} playedDays={["2026-10-10"]} />);
  expect(html).toContain("1 session, 1 minute"); expect(html).toContain('aria-label="Played 1 of the last 7 days"');
});
it("shows the empty week sentence and no cubes when nothing was played", () => {
  const html = renderToStaticMarkup(<WeekSummary nickname="Mia" week={{ ...base, sessions: 0, minutes: 0, mastered: [], stuck: [] }} playedDays={[]} />);
  expect(html).toContain("Mia hasn't played this week. Hand over the tablet and tap Mia to start.");
  expect(html).not.toContain("data-cube");
});
it("omits the mastered line when nothing new, and the tricky part when nothing is stuck", () => {
  const html = renderToStaticMarkup(<WeekSummary nickname="Mia" week={{ ...base, mastered: [], stuck: [] }} playedDays={["2026-10-10"]} />);
  expect(html).not.toContain("Mastered:"); expect(html).not.toContain("Tricky part");
  expect(html).toContain("Working on <b>Adding within 10</b>.");
});
it("says everything is mastered when currentSkill is null", () => {
  const html = renderToStaticMarkup(<WeekSummary nickname="Mia" week={{ ...base, currentSkill: null, stuck: [] }} playedDays={["2026-10-10"]} />);
  expect(html).toContain("Everything so far is mastered."); expect(html).not.toContain("Working on");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/app/parent/kids`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `WeekSummary`**
  - **Line order:**
    1. "N sessions, M minutes"
    2. day `Cubes` (blue, total 7, label `Played ${playedDays.length} of the last 7 days`)
    3. "Mastered: …" with green `Cubes` (filled = total = mastered.length, `max={10}`, label `${n} skills mastered`)
    4. the working-on sentence
  - **Escaping:** the skill name and stuck text are rendered as React text (escaped), not raw HTML.

- [ ] **Step 4: Restyle the page** (`back={{ href: "/parent", label: "Your kids" }}`)
  - **Order of work:** `notFound()` when `exportKid` returns null stays first (Review Focus 3). Then `kidWeek(supabase, kidId, new Date())`.
  - **Header:** h1 `` `${faceOf(kid.avatar)} ${kid.nickname}'s week` ``, with the face `aria-hidden` inside the h1 span. Quiet line `gradeName(kid.grade)`.
  - **Summary:** `<WeekSummary …/>`.
  - **Data links:**
    - `<details>` with `<summary>See everything we store about {nickname}</summary>`, holding the existing `Table`s (styled: `.tableWrap` scrolls sideways, header cells in Andika, zebra rows in `--paper`).
    - A link "Download {nickname}'s data" to the existing export route.
    - A link "Delete {nickname}" to `#delete`, in `--danger`.
  - **Delete section:** at the bottom, `id="delete"`. h2, paragraph, confirm field and the `btnDanger` button "Delete {nickname}", all with text unchanged.

- [ ] **Step 5: Update `tests/e2e/rights.spec.ts`**
  - The heading is `"Mia's week"` (use `{ name: /Mia's week/ }`).
  - Open the details via `page.getByText("See everything we store about Mia").click()` before asserting the "Attempts" heading and rows.
  - The download link name is `/Download Mia's data/`.
  - Delete keeps `getByRole("button", { name: "Delete Mia" })`.

Run: `npx playwright test tests/e2e/rights.spec.ts && npx vitest run src/app`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add "src/app/parent/kids/[kidId]" tests/e2e/rights.spec.ts
git commit -m "feat: child page with the week in cubes; stored data one tap down"
```

---

### Task 7: Screenshots and full verification

**Files:**
- Create: `tests/e2e/grownup-shots.spec.ts`

- [ ] **Step 1: Write the screenshot spec**
  - **Setup:** one test signs up a parent with the helpers (`requestLink`, `signIn`, `setPin`). Before giving consent, it captures sign-in, check-email, set-PIN, the consent page and privacy. Then it consents via the UI with the fake gateway (as in `consent.spec.ts`).
  - **Kids:** adds "Mia" and a kid with the 40-character nickname `"Alexandria Maximiliana Wolfeschlegelstei"` (Review Focus 1). It answers one problem as Mia (as in `play.spec.ts`).
  - **Screens:** captures Your kids, Add a child, Mia's page with the details open, and Account.
  - **Viewports:** runs the whole capture twice, at 1024×768 and 390×844, via `page.setViewportSize`. Files go to `test-results/grownup/<viewport>-<screen>.png` (git-ignored).
  - **Assertion:** `document.documentElement.scrollWidth <= window.innerWidth` on every screen at both sizes (no sideways scroll).

- [ ] **Step 2: Run it, then look at every image**

Run: `npx playwright test tests/e2e/grownup-shots.spec.ts`
Expected: PASS. Open each PNG and check:
- the grid paper and strip
- no clipped or overflowing text, including the long name
- PIN squares aligned
- the cubes visible
- the red only on the delete actions

Fix anything off in the owning file before continuing.

- [ ] **Step 3: Full suites**

Run: `npm run typecheck && npm test && npm run test:db && npm run test:e2e && npm run build`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/grownup-shots.spec.ts
git commit -m "test: grown-up screenshots at tablet and phone size, no sideways scroll"
```
