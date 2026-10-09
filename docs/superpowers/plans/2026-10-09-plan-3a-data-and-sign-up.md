# Plan 3a — Data, Sign-up and Kid Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Next.js app in which a parent signs in with an email link, sets a parent PIN, and adds kid profiles (once consent exists). A kid taps their avatar and plays problems served by the Plan 2 engine. Every answer is saved to Supabase under row-level security, and a reload resumes the same problem.

**Architecture:** Next.js 16 App Router at the repo root (`src/app`), with the engine running **server-side** in route handlers. Orchestration (`src/server/play.ts`) talks to a `Repo` interface. An in-memory repo backs unit tests and a Supabase repo backs the app. Each answer is saved in **one Postgres function call**: the attempt rows, skill states, style stats and session state go in one transaction with an optimistic version check. Plan 3b adds Stripe consent, the weekly report (sent with Resend), the distress email, data rights and retention.

**Tech Stack:** Next.js 16.4, React 19.3, `@supabase/supabase-js` 2.117, `@supabase/ssr` 0.12, Supabase CLI 2.120 (via `npx supabase`, local stack in Docker), Playwright 1.64, Vitest. Email: Resend, used as Supabase Auth's SMTP in production. Locally, Supabase's built-in Mailpit catches email.

**Spec:** `docs/superpowers/specs/2026-10-08-adaptive-tutor-design.md` (§3 stack, §8 flow and data, §9 network loss, §10 privacy + end-to-end). Plans 1–2 under `docs/superpowers/plans/`.

## Plan series update

The spec's Plan 3 is split in two, and each half ships working software.

| Plan | Builds |
|---|---|
| **3a (this)** | App shell, schema + RLS, email-link sign-in, parent PIN, kid profiles, consent gate (enforced by RLS, set in 3b), server-side play API, resume |
| 3b | Stripe card-verification consent, weekly report email (Resend), distress flag + immediate email, data rights (view, delete, revoke), retention job |

## Prerequisites (owner)

- **Docker must be running** for the local Supabase stack. On this machine the daemon was not reachable. Run `sudo systemctl start docker`. Every task from Task 2 on needs it.
- Nothing in this plan creates a hosted Supabase project, a Resend account, a domain or a Vercel deploy. Those steps are outward-facing. Task 8 writes them up in `docs/setup.md` for the owner to do.

## Decisions this plan makes

- **Age band comes from the grade**, since birthdays are never kept (spec §8). Grades K, 1 and 2 → `"5-7"`. Grades 3, 4 and 5 → `"8-11"`.
- **Sign-in link** uses a `token_hash` and `verifyOtp` at `/auth/confirm`, not a PKCE code. The parent often opens the email on a phone while the app runs on a tablet, and a PKCE code only works in the browser that asked for it.
- **Consent gate in the database:** an RLS insert policy on `kids` requires `parents.consent_at is not null`. Plan 3b's Stripe flow is the only writer of `consent_at`. Tests set it with the secret key.
- **Parent PIN:** 4 digits, hashed with Node `crypto.scrypt` plus a per-parent salt. After 5 wrong tries it locks for 10 minutes. A correct PIN sets an HMAC-signed, httpOnly `parent_ok` cookie for 15 minutes. **Forgot PIN:** the PIN can be reset only within 10 minutes of an email-link sign-in.
- **Avatars** are a fixed list: `fox, bear, owl, frog, duck, rabbit, cat, turtle`. There are no photos (spec §8).
- **Nickname:** 1–20 characters after trimming, made of letters (any language), spaces, `'` and `-`. The form asks for a first name or nickname only.
- **One open session per kid**, enforced by a partial unique index. Every turn or answer call carries the session `version`. A mismatch returns 409 with the current turn, and the client re-syncs. That covers double taps, network retries and two tablets.
- **Server clock only.** `now` in the engine is `Date.now()` on the server, and the client never sends time.

## Global Constraints

- RLS is on for **every** table. No table is readable by `anon`. Each parent reaches only their own rows (spec §8).
- Kid rows can be created only after consent: "Consent before any kid data is collected" (spec §8).
- Per kid, store only: nickname, grade, avatar, `attempts`, `skill_state`, `style_stats`, `sessions`. Never store a last name, photo, school, birthday, location, audio or free text (spec §8).
- The Supabase **secret key** (`SUPABASE_SECRET_KEY`) is never imported by code reachable from the browser. Only test helpers and server-only modules (`import "server-only"`) use it.
- No third-party trackers, analytics SDKs or ads, anywhere (spec §8).
- `src/domain` stays unchanged and pure. Plan 3a only adds `src/server`, `src/app`, `supabase/` and `tests/`.
- The engine runs only on the server. The browser receives a `PublicTurn`: the prompt, the input mode and the choices, but never `answer` or `mistakes`.
- Tablet viewport for end-to-end tests: 1024 × 768 (spec §10).
- Test first. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Email link opened on another device.** A parent asks on the tablet, then opens the email on a phone. The link must sign in that browser and land on the app. Pinned in Task 5: the e2e test opens the link in a new browser context.
2. **The same answer sent twice** (network retry or double tap) or **two tablets on one kid.** Only one is saved, the other gets 409 plus the current turn, and no attempt row is duplicated. Pinned in Task 3 (unit) and Task 4 (database).
3. **A kid id from another family** in the URL or API. The result must be 404, never another child's data and never a 500. Pinned in Task 4 (RLS) and Task 7 (API).
4. **Messy nicknames:** emoji, 40 characters, `<script>`, only spaces, "Sam Smith". Bad input gets a clear message, and anything stored renders as plain text. "Sam Smith" is allowed but the form says "first name only". Pinned in Task 6.
5. **PIN guessing by a kid:** 5 wrong tries lock for 10 minutes, and a reset is impossible without a fresh email-link sign-in. Pinned in Task 6.

---

## File structure

```
next.config.ts, playwright.config.ts, vitest.config.ts (unit), vitest.db.config.ts (db), .env.example
supabase/config.toml                      local stack, site_url, magic-link template path
supabase/templates/magic_link.html        link → /auth/confirm?token_hash=…&type=email
supabase/migrations/0001_init.sql         tables, indexes, RLS, save_step()
src/server/env.ts                         typed env access (server-only)
src/server/supabase.ts                    createServerSupabase() for route handlers / server components
src/server/kidProfile.ts                  nickname/grade/avatar validation, ageBandFor
src/server/pin.ts                         hashPin, verifyPin, lockout, parent cookie sign/verify
src/server/persist/rows.ts                pure row ↔ domain mappers
src/server/persist/repo.ts                Repo interface + MemoryRepo
src/server/persist/supabaseRepo.ts        Repo over Supabase (RLS as the parent)
src/server/play.ts                        playTurn, playAnswer (engine + repo + versioning)
src/server/publicTurn.ts                  strip answers from a Turn before it reaches the browser
src/proxy.ts                              Supabase session refresh (Next.js 16 proxy)
src/app/layout.tsx, page.tsx              kid picker (signed in) / sign-in prompt
src/app/sign-in/page.tsx + actions.ts     email-link request
src/app/auth/confirm/route.ts             verifyOtp(token_hash)
src/app/parent/…                          PIN gate, kid list, add kid, consent-needed notice
src/app/play/[kidId]/page.tsx             minimal play screen (Plan 5 replaces the UI)
src/app/api/kids/[kidId]/turn/route.ts    POST → current turn
src/app/api/kids/[kidId]/answer/route.ts  POST {version, given} → feedback + next state
tests/db/*.db.test.ts                     RLS + save_step against local Supabase
tests/e2e/*.spec.ts                       Playwright, tablet viewport
tests/helpers/admin.ts                    secret-key client, Mailpit reader, user factory
docs/setup.md                             hosted Supabase, Resend SMTP, env vars, Vercel
```

---

### Task 1: Next.js app shell

**Files:** Modify `package.json`, `tsconfig.json` and `vitest.config.ts`. Create `next.config.ts`, `playwright.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `.env.example`, and test `tests/e2e/smoke.spec.ts`.

**Interfaces — Produces:** these scripts:
- `dev` → `next dev`
- `build` → `next build`
- `start` → `next start`
- `test` → `vitest run`, unit tests only (the existing suite plus `src/server/**/*.test.ts`)
- `test:db` → `vitest run -c vitest.db.config.ts`
- `test:e2e` → `playwright test`
- `typecheck` → `tsc --noEmit`

- [ ] **Step 1: Write the failing smoke test.** `tests/e2e/smoke.spec.ts`: on the iPad-sized project (1024 × 768), `GET /` returns 200, the page title is "Math Friend", and there are no console errors.
- [ ] **Step 2: Run it.** `npx playwright install chromium && npm run test:e2e` → FAIL (no app).
- [ ] **Step 3: Implement.**
  - Install `next@16 react@19 react-dom@19` and `-D @playwright/test @types/react @types/react-dom`.
  - Update `tsconfig.json` for Next: `jsx: "preserve"`, `lib` adds `"DOM"` and `"DOM.Iterable"`, the `next` plugin, `@/*` → `src/*`, and include `next-env.d.ts`, `src` and `tests`. Keep `strict` and `noUncheckedIndexedAccess`.
  - `vitest.config.ts` excludes `tests/**` and `src/app/**`.
  - `playwright.config.ts` sets `webServer: npm run build && npm run start` on port 3000, with one project at viewport 1024 × 768 and `hasTouch: true`.
  - `layout.tsx` sets `<title>Math Friend</title>`. `page.tsx` is a placeholder that says "Sign in to start". `.env.example` lists `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` and `PARENT_COOKIE_SECRET`.
- [ ] **Step 4: Run it.** `npm test && npm run typecheck && npm run test:e2e` → PASS. The existing 617 unit tests still pass.
- [ ] **Step 5: Commit.** `feat: Next.js app shell with tablet smoke test`

---

### Task 2: Local Supabase, schema and RLS

**Files:** Create `supabase/config.toml` (via `npx supabase init`, then edited), `supabase/migrations/0001_init.sql`, `vitest.db.config.ts`, `tests/helpers/admin.ts` and `tests/db/rls.db.test.ts`.

**Interfaces — Produces:** the schema below, and `tests/helpers/admin.ts` with:
- `admin()`: a secret-key client
- `makeParent(email, { consent?: boolean })`: returns `{ userId, client }`, where `client` is signed in as that parent through the admin API (it generates a link, then calls `verifyOtp`)
- `latestEmailLink(email)`: reads Mailpit at `http://127.0.0.1:54324/api/v1/messages` and returns the `/auth/confirm…` URL

**Schema** (`0001_init.sql`). These are decisions, written out in full:

```sql
create type kid_grade as enum ('K','1','2','3','4','5');
create type age_band as enum ('5-7','8-11');
create type avatar as enum ('fox','bear','owl','frog','duck','rabbit','cat','turtle');

create table parents (
  id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  consent_at timestamptz,                -- set only by Plan 3b's consent flow
  pin_hash text, pin_salt text,
  pin_failed int not null default 0, pin_locked_until timestamptz,
  last_active_at timestamptz not null default now()
);
create table kids (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  grade kid_grade not null, age_band age_band not null, avatar avatar not null,
  placed boolean not null default false,
  created_at timestamptz not null default now()
);
create table skill_state (
  kid_id uuid references kids on delete cascade, skill_id text,
  p_known double precision not null, attempts int not null, level smallint not null check (level between 1 and 3),
  correct_streak int not null, wrong_streak int not null, last_seen timestamptz,
  placed boolean not null, recent_tags text[] not null,
  primary key (kid_id, skill_id)
);
create table style_stats (
  kid_id uuid references kids on delete cascade, style text,
  tries int not null, wins int not null, primary key (kid_id, style)
);
create table attempts (
  id bigint generated always as identity primary key,
  kid_id uuid not null references kids on delete cascade,
  session_id uuid not null, skill_id text not null, template_id text not null, seed bigint not null,
  level smallint not null, answer int not null, result text not null, mistake_tag text, style text,
  time_ms int not null, at timestamptz not null, try smallint not null, mode text not null,
  unique (session_id, at, try, skill_id)
);
create table sessions (
  id uuid primary key default gen_random_uuid(),
  kid_id uuid not null references kids on delete cascade,
  version int not null default 0, state jsonb not null,
  started_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index one_open_session on sessions (kid_id) where ended_at is null;
create index attempts_kid_at on attempts (kid_id, at);
```

**RLS policies:**
- Enable RLS on all 6 tables. Grant nothing to `anon`.
- `parents`: select and update where `id = auth.uid()`. Insert happens through a trigger on `auth.users` (a `security definer` function creates the row). `consent_at` and the `pin_*` columns are **not** updatable by the user: revoke `update` on those columns from `authenticated`. The PIN is written only through the server routes in Task 6, which use the secret key after checking the session.
- `kids`: select, update and delete where `parent_id = auth.uid()`. Insert is allowed with check `parent_id = auth.uid() and exists (select 1 from parents p where p.id = auth.uid() and p.consent_at is not null)`.
- `skill_state`, `style_stats`, `attempts` and `sessions`: all operations where `kid_id in (select id from kids where parent_id = auth.uid())`. `attempts` gets select and insert only, with no update or delete by the user.

**`save_step` function** (in the same migration, `security invoker`, so RLS applies):

```sql
create function save_step(p_session uuid, p_version int, p_state jsonb, p_ended boolean,
  p_attempts jsonb, p_skill_states jsonb, p_style_stats jsonb, p_kid_placed boolean)
returns int   -- the new version, or -1 on a version mismatch
```

It updates `sessions` where `id = p_session and version = p_version`. If no row updates, it returns -1 and writes nothing else. Otherwise it inserts `p_attempts`, upserts `p_skill_states` and `p_style_stats`, sets `kids.placed` when `p_kid_placed`, and sets `ended_at = now()` when `p_ended`, all in the same transaction. It returns `p_version + 1`.

- [ ] **Step 1: Write the failing database tests** in `tests/db/rls.db.test.ts`. Create parents A and B with consent, and C without:
  - A inserts a kid → ok. C inserts a kid → rejected by RLS.
  - B selects A's kids, skill states, attempts and sessions → 0 rows. B updates or deletes A's kid → 0 rows affected.
  - The `anon` client selects from each table → 0 rows or a permission error.
  - A updates own `consent_at` or `pin_hash` → permission error.
  - Deleting A's kid cascades: no skill_state, attempts or sessions rows remain for it.
  - A new `auth.users` row creates a `parents` row.
- [ ] **Step 2: Run them.** `npx supabase start && npm run test:db` → FAIL (no tables).
- [ ] **Step 3: Implement.** Write the migration and the trigger. In `config.toml`, set `site_url = "http://localhost:3000"` and `[auth.email.template.magic_link] content_path = "./supabase/templates/magic_link.html"`. The template links to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`. Then run `npx supabase db reset`.
- [ ] **Step 4: Run them.** `npm run test:db` → PASS.
- [ ] **Step 5: Commit.** `feat: Supabase schema with row-level security and save_step`

---

### Task 3: Row mappers, Repo, and play orchestration (no database)

**Files:** Create `src/server/persist/rows.ts`, `src/server/persist/repo.ts`, `src/server/play.ts` and `src/server/publicTurn.ts`, with a test file next to each.

**Interfaces — Produces:**

```ts
// rows.ts — pure
export function kidStateFromRows(kid: KidRow, skills: SkillRow[], styles: StyleRow[]): KidState; // missing skills/styles → newKidState defaults
export function skillRow(kidId: string, s: SkillState): SkillRow;   // lastSeen ms ↔ ISO timestamptz
export function styleRow(kidId: string, s: StyleStat): StyleRow;
export function attemptRow(sessionId: string, a: Attempt): AttemptRow;
// KidRow/SkillRow/StyleRow/AttemptRow mirror the SQL columns in snake_case.

// repo.ts
export type OpenSession = { id: string; version: number; state: Session };
export interface Repo {
  loadKid(kidId: string): Promise<KidState | null>;                // null = not found or not yours
  openSession(kidId: string): Promise<OpenSession | null>;
  createSession(kidId: string, state: Session): Promise<OpenSession>;
  saveStep(s: OpenSession, next: Session, ended: boolean, writes: Writes | null): Promise<number>; // new version or -1
}
export class MemoryRepo implements Repo { /* for tests; also models one-open-session and version checks */ }

// play.ts
export type PublicTurn = /* Turn with problem reduced to { prompt, input, choices } */;
export type TurnResult = { status: 200; version: number; turn: PublicTurn } | { status: 404 };
export type AnswerResult =
  | { status: 200; version: number; feedback: Feedback; next: PublicTurn }
  | { status: 409; version: number; turn: PublicTurn }
  | { status: 404 };
export function playTurn(repo: Repo, kidId: string, now: number, seed: () => number): Promise<TurnResult>;
export function playAnswer(repo: Repo, kidId: string, version: number, given: number, now: number, seed: () => number): Promise<AnswerResult>;
```

**Rules:**
- `playTurn` loads the open session, or creates one (`startSession(loadKid, seed(), now)`) if none exists. It calls `nextTurn` and saves with `saveStep`. If the turn is `end`, it saves with `ended: true`, then starts a new session and takes its first turn in the same call. A kid who comes back always gets a problem, unless every template fails.
- `playAnswer`: if `version` differs from the open session's version, it returns 409 with the current turn and writes nothing. Otherwise it calls `answer`, returning 409 with the current turn on a `null` result. Then `nextTurn`, then `saveStep(…, writes)`. On -1 from the save (lost race), it returns 409 with the reloaded turn. If the following turn is `end`, it applies the same rule as `playTurn`: it ends that session and starts a new one.
- `publicTurn` drops `answer` and `mistakes` and keeps `prompt`, `input` and `choices`, plus `mode`, `try` and `kind`. Problem metadata (`templateId`, `seed`) stays on the server.

- [ ] **Step 1: Write the failing tests:**
  - **Round trip:** `kidStateFromRows(rows(kid))` deep-equals `kid` for a kid after a played session. `lastSeen` survives ms → ISO → ms.
  - **Defaults:** a kid with no `skill_state` rows maps to `newKidState` values.
  - **Play:** a MemoryRepo with one consented kid. `playTurn` → 200 with version 1. `playAnswer(version 1, right)` → 200 with version 2 and one attempt stored.
  - **Review Focus 2:** sending the same `playAnswer(version 1, …)` again → 409 with the current turn, still one attempt. Two `playAnswer` calls racing on the same version → exactly one 200.
  - **Resume:** `playTurn` twice in a row returns the same problem (same `prompt.say` and `choices`) and does not bump past a pending problem.
  - **Ended session:** after the engine ends a session, the next `playTurn` returns a problem from a new session, and the old one is marked ended.
  - **Unknown kid** → 404.
  - **No answers leak:** a `PublicTurn` serialized to JSON contains no `"answer"` and no `"mistakes"` keys.
- [ ] **Step 2: Run them.** FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them.** `npm test && npm run typecheck` → PASS.
- [ ] **Step 5: Commit.** `feat: row mappers, repo interface and server-side play orchestration`

---

### Task 4: Supabase repo

**Files:** Create `src/server/persist/supabaseRepo.ts` and `tests/db/repo.db.test.ts`.

**Interfaces:** `class SupabaseRepo implements Repo { constructor(db: SupabaseClient) }`. It uses the caller's client, so RLS applies. `saveStep` calls `db.rpc("save_step", …)`.

- [ ] **Step 1: Write the failing database tests.** Use `makeParent` with consent and a kid inserted by A:
  - Run the Task 3 "Play" and "Review Focus 2" scenarios against `SupabaseRepo`, with the same expectations. Count `attempts` rows by kid: exactly 1 after a duplicate answer.
  - A `SupabaseRepo` built with B's client: `loadKid(A's kid)` → null, `playTurn` → 404, and nothing is written (Review Focus 3).
  - `saveStep` with a stale version → -1, and no attempt rows are added.
  - After placement finishes, `kids.placed` is true and `skill_state` rows exist for each placed skill.
- [ ] **Step 2: Run them.** FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them.** `npm run test:db && npm test && npm run typecheck` → PASS.
- [ ] **Step 5: Commit.** `feat: Supabase repo saving each step in one transaction`

---

### Task 5: Email-link sign-in

**Files:** Create `src/server/env.ts`, `src/server/supabase.ts`, `src/proxy.ts`, `src/app/sign-in/page.tsx`, `src/app/sign-in/actions.ts` and `src/app/auth/confirm/route.ts`. Modify `src/app/page.tsx`. Test: `tests/e2e/sign-in.spec.ts`.

**Interfaces — Produces:**
- `createServerSupabase(): Promise<SupabaseClient>`, built with `createServerClient` from `@supabase/ssr` using `cookies()` `getAll`/`setAll`.
- `proxy.ts` refreshes the session on every request except static assets.
- Sign-in action: `requestLink(formData)` calls `auth.signInWithOtp({ email, options: { emailRedirectTo: <origin>/auth/confirm } })`. It always shows "Check your email", whether or not the address has an account.
- `/auth/confirm` runs `verifyOtp({ type, token_hash })`, then redirects to `/`. On an error it redirects to `/sign-in?error=link`, which shows "That link expired. Send a new one."
- `/`: a signed-out visitor is sent to `/sign-in`. A signed-in parent sees the kid picker (Task 7) or, with no kids, "Add your first kid" linking to `/parent`.

- [ ] **Step 1: Write the failing e2e tests:**
  - Enter an email, see "Check your email", get the link with `latestEmailLink`, open it in the **same** context, and land on `/` signed in.
  - **Review Focus 1:** ask for the link in context 1, open it in a **new** browser context, and that context is signed in.
  - A used or garbage `token_hash` → `/sign-in?error=link` showing the message.
  - The sign-in page shows the same message for an unknown email as for a known one.
- [ ] **Step 2: Run them.** FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them.** `npm run test:e2e && npm test && npm run typecheck` → PASS.
- [ ] **Step 5: Commit.** `feat: email-link sign-in that works across devices`

---

### Task 6: Parent PIN, consent gate and kid profiles

**Files:** Create `src/server/pin.ts`, `src/server/kidProfile.ts` and `src/app/parent/` (with `page.tsx`, `pin/page.tsx`, `kids/new/page.tsx` and `actions.ts`). Tests: `src/server/pin.test.ts`, `src/server/kidProfile.test.ts` and `tests/e2e/parent.spec.ts`.

**Interfaces — Produces:**
- `kidProfile.ts`:
  - `parseKidProfile(input: unknown)` returns `{ ok: true; value: { nickname; grade; avatar } } | { ok: false; errors: Record<"nickname" | "grade" | "avatar", string> }`.
  - `ageBandFor(grade: KidGrade): AgeBand`.
  - `AVATARS`.
- `pin.ts`:
  - `hashPin(pin): Promise<{ hash; salt }>` and `verifyPin(pin, hash, salt): Promise<boolean>`, which uses a timing-safe compare.
  - `isValidPin(pin)`: exactly 4 digits.
  - `nextLockState(failed: number, now: number): { failed; lockedUntil: number | null }`: 5 failures set the lock to now + 10 minutes.
  - `signParentCookie(parentId, now)` and `verifyParentCookie(value, parentId, now)`: HMAC-SHA256 with `PARENT_COOKIE_SECRET`, valid 15 minutes.
  - `canResetPin(lastSignInAt: number, now: number)`: true within 10 minutes of sign-in.
- The `/parent` pages need a valid `parent_ok` cookie, and redirect to `/parent/pin` without one. The first visit sets a PIN.
- With no consent, `/parent` shows "Before your kid can play, we need a parent's consent." That is a placeholder until Plan 3b. "Add kid" is hidden, and the server action refuses as well (RLS backs this up).
- Adding a kid inserts `{ parent_id, nickname, grade, age_band: ageBandFor(grade), avatar }` through the parent's own client.

- [ ] **Step 1: Write the failing tests:**
  - **Unit, `kidProfile` (Review Focus 4):**
    - `"  Mia "` → `"Mia"`, and `"José"`, `"Anne-Marie"` and `"O'Neil"` are accepted.
    - These are rejected: `""`, `"   "`, a 21-character name, `"<script>"`, `"Mia😀"` and `"Mia2"`. Each gives a nickname error in plain words.
    - `"Sam Smith"` is accepted.
    - A bad grade or avatar is rejected.
    - `ageBandFor`: K, 1, 2 → `"5-7"`; 3, 4, 5 → `"8-11"`.
  - **Unit, `pin` (Review Focus 5):**
    - hash/verify works, and the wrong PIN is rejected. Two hashes of the same PIN differ (salt).
    - `isValidPin` rejects `"123"`, `"12a4"` and `"12345"`.
    - The lock comes on at the 5th failure. A cookie is valid at 14:59, invalid at 15:01, and invalid for another parent or when tampered with.
    - `canResetPin` is true at 9 minutes and false at 11.
  - **e2e:**
    - A signed-in parent without consent: `/parent` asks to set a PIN, then shows the consent notice and no "Add kid".
    - The same parent after the admin helper sets consent: add kid "Mia", K, fox. Mia appears in the parent list and on `/`.
    - A nickname of `<b>x</b>` shows the error and nothing is saved.
    - Five wrong PINs → "Locked for 10 minutes".
    - Visiting `/parent` without the cookie redirects to the PIN page.
- [ ] **Step 2: Run them.** FAIL.
- [ ] **Step 3: Implement.** The PIN columns are written with the secret-key client in a server-only module, after `auth.getUser()` confirms the parent. Users cannot update these columns (Task 2).
- [ ] **Step 4: Run them.** `npm test && npm run test:db && npm run test:e2e && npm run typecheck` → PASS.
- [ ] **Step 5: Commit.** `feat: parent PIN, consent gate and kid profiles`

---

### Task 7: Kid picker, play API and minimal play screen

**Files:**
- Create `src/app/api/kids/[kidId]/turn/route.ts`, `src/app/api/kids/[kidId]/answer/route.ts` and `src/app/play/[kidId]/page.tsx` (a client component).
- Modify `src/app/page.tsx`, which becomes the kid picker.
- Test: `tests/e2e/play.spec.ts` and `tests/db/api.db.test.ts`.

**Interfaces — Produces:**
- `POST /api/kids/:kidId/turn` → `{ version, turn: PublicTurn }`, or 404.
- `POST /api/kids/:kidId/answer`, with body `{ version: number, given: number }` → `{ version, feedback, next }`. It returns 409 with `{ version, turn }`, or 404. A body that fails validation gets 400. Both routes call `play.ts` with `new SupabaseRepo(await createServerSupabase())`, `Date.now()`, and a `crypto.getRandomValues` seed.
- The kid picker shows each kid's avatar and nickname as a big button linking to `/play/:kidId`, plus a small "Grown-ups" link to `/parent`.
- The minimal play screen shows `prompt.say` as text, the choices as big buttons (or a number pad for `input: "number-pad"`), and the feedback text. It shows "Try again" for a retry and the revealed answer otherwise. On 409 it adopts the returned turn. Plan 5 replaces this UI. It exists to prove the loop end to end.

- [ ] **Step 1: Write the failing tests:**
  - **Database / API (Review Focus 3):**
    - Signed in as B, `POST /api/kids/<A's kid>/turn` → 404, and the answer route → 404.
    - A malformed body (`given: "7"`, or a missing version) → 400.
  - **e2e, tablet viewport:**
    - Sign in, consent via admin, set PIN, add Mia, return to `/`, tap Mia, and answer 3 problems by tapping. The database then has at least 3 attempt rows for Mia.
    - **Resume:** reload the page mid-problem. The same `prompt.say` and the same choice labels come back.
    - **Double tap:** two fast taps on one choice → the database has one attempt row for that turn.
    - The HTML of `/play/:id` and every API response contain no `"answer"` or `"mistakes"` fields (search the network responses).
- [ ] **Step 2: Run them.** FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them.** `npm test && npm run test:db && npm run test:e2e && npm run typecheck` → PASS.
- [ ] **Step 5: Commit.** `feat: kid picker, server-side play API and minimal play screen`

---

### Task 8: Setup guide and roadmap

**Files:** Create `docs/setup.md`. Modify `vault/05 Roadmap/Roadmap.md` and `vault/02 Decisions/Decision - Stack.md`.

- [ ] **Step 1: Write `docs/setup.md`,** covering these owner steps. These are outward-facing, so the doc describes them and nothing is executed:
  - Creating a hosted Supabase project and running `npx supabase link` and `db push`.
  - Setting Auth's Site URL, Redirect URLs and the magic-link template, which is the same as the local file.
  - Configuring **Resend as custom SMTP**: host `smtp.resend.com`, port 465, user `resend`, password = the Resend API key, with a verified sending domain. Signing Resend's data processing agreement.
  - Setting the env vars on Vercel and generating `PARENT_COOKIE_SECRET` with `openssl rand -hex 32`.
  - Noting that the COPPA lawyer review (spec §8) must happen before the first family signs up.
- [ ] **Step 2: Update the vault.**
  - **Roadmap:** split "Parent sign-up + report" into "3a Sign-up + data (done)" and "3b Consent + report".
  - **Decision - Stack:** email vendor = Resend (owner's choice, 2026-10-09).
- [ ] **Step 3: Run the full check.** `npm test && npm run typecheck && npm run test:db && npm run test:e2e` → all PASS.
- [ ] **Step 4: Commit.** `docs: setup guide for hosted Supabase and Resend; roadmap split`
