# Plan 3b — Consent, Weekly Report, Distress Flag, Data Rights and Retention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the parent side of spec §8. This covers:
- the privacy notice;
- consent through a Stripe card check, with no charge;
- the Sunday weekly report email;
- the distress flag, which plays a fixed line to the kid and emails the parent immediately;
- the parent's data rights (view, delete a kid, delete the account, revoke consent);
- the retention job.

**Architecture:** Two narrow interfaces keep outside services swappable and testable:
- `ConsentGateway` is Stripe Checkout in setup mode in production, and a local fake in dev and tests.
- `Mailer` is Resend in production, and Mailpit's HTTP send API locally.

Scheduled work runs in protected route handlers that Vercel Cron calls. Each handler is idempotent, so a retry never double-sends. Report content is built by pure functions from rows. The only new tables are `consents`, `distress_flags` and `report_sends`; the only new column is `skill_state.mastered_at`.

**Tech Stack:** Next.js 16.4, Supabase (local via `npx supabase`), `stripe` 23.0, `resend` 6.32, Vitest, Playwright 1.64. Local email is caught by Mailpit (v1.31) at `http://127.0.0.1:54324`. Its `POST /api/v1/send` endpoint was checked and returns 200.

**Spec:** `docs/superpowers/specs/2026-10-08-adaptive-tutor-design.md` (§8 parent side and privacy, §9 errors, §10 privacy + e2e). Builds on Plan 3a (`docs/superpowers/plans/2026-10-09-plan-3a-data-and-sign-up.md`).

## Owner decisions (2026-10-09)

- **Stripe:** build it behind `ConsentGateway`. Tests use a fake; there are no Stripe keys yet. `docs/setup.md` explains how to add test-mode keys and run one real check.
- **Distress:** build the full pipeline now, with a short draft phrase list marked *pending lawyer review*. Speech input arrives in a later plan and calls the same entry point.
- **Weekly report:** Sundays at 5 pm US Eastern, triggered by Vercel Cron.

## Decisions this plan makes

- **Consent record.** A new table `consents(parent_id, at, notice_version, method, ref)` records each consent. `parents.consent_at` stays the gate that RLS checks. Both are written in one security-definer function, `grant_consent`, which only `service_role` may execute.
- **No card kept.** Checkout runs with `mode: "setup"`, with no `customer` and no charge. After the check succeeds, the payment method is detached if Stripe attached one. `ref` stores only the Checkout Session id.
- **The fake gateway cannot run in production.** `CONSENT_GATEWAY=fake` and `MAILER=mailpit` throw at startup when `VERCEL_ENV === "production"`.
- **Distress text is never stored unless it hits.** `POST /api/kids/:kidId/say` gets text, checks it, and stores the line only on a hit. Distress lines are deleted after 30 days.
- **Revoke consent means deleting the account** (spec §8). Deleting a kid or an account is immediate, which is within the spec's 30 days. An account is deleted with the admin API (`auth.admin.deleteUser`), and the deletion cascades through `parents`.
- **Retention:**
  - A parent counts as active when they sign in, or when any of their kids plays. Activity updates `parents.last_active_at`, at most once an hour.
  - After 12 months inactive, the parent gets a warning email and `retention_warned_at` is set.
  - 30 days after the warning, if still inactive, the account is deleted.
  - Any new activity clears `retention_warned_at`.
- **Report timing.** Vercel Cron runs hourly on Sundays (`0 * * * 0`, UTC). The route sends only when the hour in `America/New_York` is 17, so daylight saving time is handled. `report_sends(parent_id, week_start)` is unique, which makes every run idempotent.
  - **Report window:** the 7 days before the send moment.
  - **Who gets it:** consented parents who have at least one kid.
  - **Format:** one email per parent, with a section per kid.
- **"Mastered this week."** A trigger on `skill_state` sets `mastered_at = now()` when a row becomes mastered:
  - "Mastered" means `p_known >= 0.95` and (`attempts >= 5` or `placed`), mirroring `MASTERED_P` and `MASTERED_ATTEMPTS` in `src/domain/kid/bkt.ts`.
  - It fires on an UPDATE that crosses into mastered, or on an INSERT that is mastered and not `placed`. Skills mastered through placement are therefore not reported as learned this week.
  - A db test pins the SQL thresholds to the TS constants.
- **No AI summary** in the report for v1. The spec marks it optional.

## Global Constraints

- "Consent before any kid data is collected." (spec §8)
- Kid data kept is only: nickname, grade, avatar; `attempts`, `skill_state`, `style_stats`; distress-flag lines (30 days). Never: last name, photo, school, birthday, location, audio, other free-speech text. (spec §8)
- Distress: the kid hears exactly "That sounds hard. Please tell a grown-up you trust." The parent is emailed **immediately** with the line. The app states it is not a crisis service. (spec §8)
- Weekly report: "sessions, minutes, skills mastered, current skill, stuck points (from mistake tags), one tip for home. Built by code". (spec §8)
- Parent rights: "view all kid data; delete a kid or the account (all data removed within 30 days); revoke consent (= delete)". (spec §8)
- Retention: "while active; 12 months inactive → warning → delete". (spec §8)
- No ads, data sales, third-party trackers or analytics SDKs. (spec §8)
- RLS on every new table. Nothing is readable by `anon`. New security-definer functions use `search_path = ''`, revoke EXECUTE from `public, anon, authenticated` and grant it to `service_role` only.
- `SUPABASE_SECRET_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY` and `CRON_SECRET` are used only in `import "server-only"` modules.
- Parent-area pages and actions need the `parent_ok` PIN cookie (`requireParent` from `src/server/parentGate.ts`). Cron routes need `Authorization: Bearer ${CRON_SECRET}`.
- `src/domain` stays unchanged. Migrations are added as `0006_…` and later; existing migrations are never edited.
- Tablet viewport 1024 × 768 for e2e (spec §10).
- Test first. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Consent returns that are forged or replayed.** Opening `/parent/consent/return?session_id=…` for another parent's session, an unfinished session, or a reused one must not grant consent. Pinned in Task 2.
2. **Cron called twice, or by a stranger.** A second run in the same week sends nothing new. A missing or wrong bearer token gets 401 and sends nothing. Pinned in Tasks 4 and 6.
3. **Distress near-misses and evasions.** Mixed case, extra spaces, punctuation and a phrase inside a sentence must all trigger. A safe word that only contains a trigger (for example "skill" containing "kill") must not. Pinned in Task 3.
4. **Deleting while a kid is mid-session on another tablet.** After deletion the play API returns 404, never 500, and no row of that kid remains. Pinned in Task 5.
5. **A report week with nothing in it.** A kid with no sessions gets a friendly "no sessions this week" section, never NaN or `undefined`. Pinned in Task 4.

---

## File structure

| Path | Responsibility |
|---|---|
| `supabase/migrations/0006_consent_report_distress.sql` | `consents`, `distress_flags`, `report_sends`, `parents.retention_warned_at`, `skill_state.mastered_at` + trigger, `grant_consent`, RLS, grants |
| `src/server/email/mailer.ts` | `Mailer` interface, `resendMailer`, `mailpitMailer`, `getMailer()` |
| `src/server/consent/gateway.ts` | `ConsentGateway` interface, `stripeGateway`, `fakeGateway`, `getConsentGateway()` |
| `src/server/consent/notice.ts` | `PRIVACY_NOTICE_VERSION` and the notice text (draft, pending lawyer review) |
| `src/app/parent/privacy/page.tsx`, `src/app/parent/consent/{page.tsx,actions.ts,return/route.ts}` | Notice and consent flow |
| `src/server/distress/{phrases.ts,detect.ts,report.ts}` | Draft list, detector, store + email |
| `src/app/api/kids/[kidId]/say/route.ts` | Entry point for kid speech text |
| `src/server/report/{tips.ts,build.ts,collect.ts,send.ts}` | Tag labels and tips, pure report builder, row loader, weekly send |
| `src/app/api/cron/{weekly-report,retention}/route.ts` | Cron handlers |
| `src/server/cron.ts` | `requireCronAuth(req)` |
| `src/server/retention.ts` | Activity touch, warn and delete, distress purge |
| `src/server/rights.ts`, `src/app/parent/kids/[kidId]/{page.tsx,actions.ts}`, `src/app/parent/account/{page.tsx,actions.ts}` | View, export, delete a kid, delete the account |
| `vercel.json` | Cron schedules |

---

### Task 1: Migration and mailer

**Files:**
- Create: `supabase/migrations/0006_consent_report_distress.sql`, `src/server/email/mailer.ts`.
- Modify: `src/server/env.ts`, `scripts/env-local.mjs`, `.env.example`.
- Test: `tests/db/plan3b.db.test.ts`, `src/server/email/mailer.test.ts`.

**Interfaces — Produces:**
- **Tables:**
  - `consents(id bigint identity pk, parent_id uuid not null references parents on delete cascade, at timestamptz not null default now(), notice_version text not null, method text not null check (method in ('stripe','fake')), ref text not null)`
  - `distress_flags(id bigint identity pk, kid_id uuid not null references kids on delete cascade, line text not null check (char_length(line) <= 500), at timestamptz not null default now())`
  - `report_sends(parent_id uuid references parents on delete cascade, week_start date, sent_at timestamptz not null default now(), primary key (parent_id, week_start))`
- **Columns:**
  - `parents.retention_warned_at timestamptz`
  - `skill_state.mastered_at timestamptz`, with the trigger described in "Decisions"
- **RLS and grants:**
  - Parents may `select` their own `consents` and their kids' `distress_flags`.
  - Parents get no write on any of the three new tables. `report_sends` has no policies for users.
- **`grant_consent(p_parent uuid, p_notice text, p_method text, p_ref text) returns void`:**
  - security definer, `service_role` only;
  - inserts into `consents` and sets `parents.consent_at = now()` in the same call;
  - is a no-op if a `consents` row with the same `ref` already exists, which needs a unique index on `consents(ref)`.
- **Mailer:**
  - `type Mail = { to: string; subject: string; text: string; html: string }`
  - `interface Mailer { send(m: Mail): Promise<void> }`
  - `getMailer(): Mailer` picks by `MAILER` (`resend` | `mailpit`) and throws for `mailpit` when `VERCEL_ENV === "production"`.
  - `resendMailer` uses `new Resend(key).emails.send({ from: EMAIL_FROM, … })` and throws on `error`.
  - `mailpitMailer` posts `{ From: { Email }, To: [{ Email }], Subject, Text, HTML }` to `${MAILPIT_URL ?? "http://127.0.0.1:54324"}/api/v1/send`.
- **`env.ts`** adds `stripeSecretKey`, `consentGateway`, `mailer`, `resendApiKey`, `emailFrom`, `cronSecret` and `appOrigin`.
- **`env-local.mjs`** writes these local defaults, keeping any existing values the same way it keeps `PARENT_COOKIE_SECRET`:
  - `CONSENT_GATEWAY=fake`
  - `MAILER=mailpit`
  - `EMAIL_FROM=Math Friend <hello@localhost>`
  - `APP_ORIGIN=http://localhost:3000`
  - a random `CRON_SECRET`

- [ ] **Step 1: Write the failing tests.**
  - **db:**
    - A parent client cannot insert into `consents`, `distress_flags` or `report_sends`. Each attempt errors with code `42501` or returns 0 rows.
    - Parent B cannot select A's `distress_flags`.
    - `grant_consent` called with the parent's own client errors with `42501`. Called with `admin()`, it sets `consent_at` and inserts one `consents` row. Calling it again with the same `ref` leaves exactly one row.
    - `mastered_at` behaviour (insert rows with `admin()`):
      - updating a row from `p_known 0.9, attempts 5` to `0.96` sets `mastered_at`;
      - inserting `p_known 0.99, placed true` leaves it null;
      - an already-mastered row keeps its first `mastered_at` on later updates.
    - The thresholds in the trigger equal `MASTERED_P` (0.95) and `MASTERED_ATTEMPTS` (5). The test imports both from `src/domain/kid/bkt.ts` and checks the boundary cases 0.9499 and 0.95, and attempts 4 and 5.
  - **unit:**
    - `mailpitMailer.send` posts the expected JSON. Use a stubbed `fetch`, and assert the URL and the body keys.
    - `getMailer()` throws for `mailpit` when `VERCEL_ENV=production`.
- [ ] **Step 2: Run.** `npm run test:db -- plan3b` and `npm test -- mailer` → FAIL.
- [ ] **Step 3: Implement.**
  - Write the migration.
  - Apply it: `echo 'cd /home/andrej/Projects/adaptive-tutor && npx supabase migration up' | newgrp docker`.
  - Write `mailer.ts`.
  - Run `npm i stripe@23 resend@6`.
  - Add the new env keys to `.env.example`, then re-run `npm run env:local` through `newgrp docker`.
- [ ] **Step 4: Run.** `npm test && npm run test:db && npm run typecheck` → PASS. Also send one real mail with `mailpitMailer` and see it in Mailpit; a test can do this through `latestEmailLink`'s Mailpit polling.
- [ ] **Step 5: Commit.** `feat: plan 3b schema (consents, distress, report sends, mastered_at) and mailer`

---

### Task 2: Privacy notice and Stripe consent

**Files:**
- Create: `src/server/consent/gateway.ts`, `src/server/consent/notice.ts`, `src/app/parent/privacy/page.tsx`, `src/app/parent/consent/page.tsx`, `src/app/parent/consent/actions.ts`, `src/app/parent/consent/return/route.ts`.
- Modify: `src/app/parent/page.tsx`, where the consent notice becomes a link to `/parent/consent`.
- Test: `src/server/consent/gateway.test.ts`, `tests/e2e/consent.spec.ts`.

**Interfaces:**
- **Consumes:** `grant_consent` (Task 1), `requireParent`/`requireUser` (`src/server/parentGate.ts`), `env`.
- **Produces:**
  - `interface ConsentGateway { start(parentId: string, returnUrl: string): Promise<{ redirectUrl: string }>; verify(sessionId: string): Promise<{ ok: true; parentId: string; ref: string; method: "stripe" | "fake" } | { ok: false }> }`
  - `getConsentGateway(): ConsentGateway` throws for `fake` when `VERCEL_ENV === "production"`.
  - **`stripeGateway`:**
    - `start` creates a Checkout Session with `mode: "setup"`, `currency: "usd"`, `payment_method_types: ["card"]`, `metadata: { parent_id }`, `success_url: returnUrl + "?session_id={CHECKOUT_SESSION_ID}"` and `cancel_url: <origin>/parent/consent?cancelled=1`.
    - `verify` retrieves the session with `expand: ["setup_intent"]`. It returns ok only when `status === "complete"` and `setup_intent.status === "succeeded"`, and then detaches `setup_intent.payment_method` when it has a `customer`.
  - **`fakeGateway`:**
    - `start` returns `/parent/consent/return?session_id=fake_<parentId>_<hmac>`, where the HMAC is computed with `PARENT_COOKIE_SECRET` over the parent id.
    - `verify` checks the HMAC.
  - `PRIVACY_NOTICE_VERSION = "2026-10-09-draft"`. The notice text covers:
    - what is kept and what is never kept (copied from spec §8);
    - the vendors;
    - the parent's rights;
    - retention;
    - "not a crisis service";
    - a visible banner: "Draft — pending legal review."
- **Flow:**
  - `/parent/consent` shows the notice summary with a link to `/parent/privacy`, a required checkbox ("I have read the privacy notice and I am this child's parent or guardian") and a "Verify with a card (no charge)" button.
  - The action calls `start` and redirects.
  - The return route requires the signed-in user. It calls `verify`, requires `parentId === user.id`, then calls `grant_consent(user.id, PRIVACY_NOTICE_VERSION, method, ref)` with the secret-key client. It then redirects to `/parent?consented=1`. On failure it redirects to `/parent/consent?error=1` with the message "We couldn't verify that. No charge was made. Please try again."

- [ ] **Step 1: Write the failing tests.**
  - **unit:**
    - `fakeGateway.verify` accepts its own `start` id, and rejects a tampered HMAC and another parent's id.
    - `stripeGateway.verify`, against a stubbed Stripe client:
      - rejects `status: "open"`;
      - rejects `setup_intent.status: "requires_payment_method"`;
      - accepts the complete case and calls `paymentMethods.detach` once.
  - **e2e:**
    - A signed-in parent with a PIN and no consent:
      1. opens `/parent` and follows "Give consent";
      2. finds the button disabled until the checkbox is ticked;
      3. after verifying, lands on `/parent` with "Add kid" visible;
      4. `consents` has one row, with `notice_version` set to `2026-10-09-draft`.
    - **Review Focus 1:**
      - Parent B opening A's fake return URL gets `/parent/consent?error=1`, and A's consent stays null.
      - Replaying a used return URL leaves one `consents` row.
      - A garbage `session_id` leads to the error page.
    - `/parent/privacy` shows "Draft — pending legal review".
- [ ] **Step 2: Run.** FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** `npm test && npm run test:e2e && npm run typecheck` → PASS.
- [ ] **Step 5: Commit.** `feat: privacy notice and card-check consent (Stripe setup mode, fake for tests)`

---

### Task 3: Distress flag

**Files:**
- Create: `src/server/distress/phrases.ts`, `src/server/distress/detect.ts`, `src/server/distress/report.ts`, `src/app/api/kids/[kidId]/say/route.ts`.
- Test: `src/server/distress/detect.test.ts`, `tests/db/distress.db.test.ts`.

**Interfaces:**
- **Consumes:** `getMailer` (Task 1), `parentRepo`/`tryAgain` from `src/server/playApi.ts`, `createServerSupabase`, `admin` secret-key client pattern from `src/server/parentPinStore.ts`.
- **Produces:**
  - `DISTRESS_PHRASES: readonly string[]` holds the draft list, headed by the comment `// DRAFT — pending lawyer review (spec §11). Do not ship to families before review.` The list:
    - "hurt myself", "kill myself", "want to die", "nobody loves me", "hits me", "hit me", "touches me", "scared at home", "run away", "hate myself"
  - `detectDistress(text: string): { hit: false } | { hit: true; phrase: string }`:
    - lower-cases the text and replaces non-letters with spaces;
    - collapses whitespace;
    - matches each phrase on word boundaries.
  - `DISTRESS_REPLY = "That sounds hard. Please tell a grown-up you trust."`
  - `reportDistress(kidId: string, line: string, now: number): Promise<void>`:
    - inserts into `distress_flags`, with the line trimmed to 500 characters;
    - emails the parent immediately. The subject is `"<nickname> said something that worried us"`. The body includes the line and the time, and says: "Math Friend is not a crisis service. If your child may be in danger, call 911. For a mental health crisis, call or text 988."
  - **`POST /api/kids/:kidId/say`:**
    - body `{ text: string }`, 1–500 characters, otherwise 400;
    - another family's kid or a signed-out caller → 404;
    - response `{ reply: string | null }`;
    - the text is never stored or logged unless `hit`.

- [ ] **Step 1: Write the failing tests.**
  - **unit (Review Focus 3):** these each hit:
    - "I want to DIE"
    - "i  want   to die!!"
    - "sometimes I want to die."
    - "my brother hits me"

    These do not hit: "skill", "I killed it at math", "die roll", "a hit song".

    `DISTRESS_REPLY` equals the spec text exactly.
  - **db:**
    - A hit stores one `distress_flags` row and sends one email to the parent, found by polling Mailpit for the parent's address.
    - A non-hit stores nothing and sends nothing.
    - Another family's kid → 404, nothing stored.
    - A 501-character text → 400.
- [ ] **Step 2: Run.** FAIL.
- [ ] **Step 3: Implement.** Store and email with the secret-key client, after `parentRepo()` confirms that the caller's own client can load the kid. If the email fails, keep the row and rethrow, so the route returns 503 and the failure is logged.
- [ ] **Step 4: Run.** `npm test && npm run test:db && npm run typecheck` → PASS.
- [ ] **Step 5: Commit.** `feat: distress flag pipeline with immediate parent email (draft list pending legal review)`

---

### Task 4: Weekly report

**Files:**
- Create: `src/server/report/tips.ts`, `src/server/report/build.ts`, `src/server/report/collect.ts`, `src/server/report/send.ts`, `src/server/cron.ts`, `src/app/api/cron/weekly-report/route.ts`, `vercel.json`.
- Test: `src/server/report/build.test.ts`, `src/server/cron.test.ts`, `tests/db/report.db.test.ts`.

**Interfaces:**
- **Consumes:** `getMailer`, `SKILLS` (`src/domain/curriculum`), `MISTAKE_TAGS` (`src/domain/types.ts`), `frontier` (`src/domain/kid/next.ts`), `kidStateFromRows` (`src/server/persist/rows.ts`).
- **Produces:**
  - `TAG_LABEL: Record<MistakeTag, string>`, a plain-language label for each tag, and `TIP_FOR_TAG: Partial<Record<MistakeTag, string>>`, a home tip for each tag. Also `DEFAULT_TIP`.
  - `type KidWeek = { nickname: string; sessions: number; minutes: number; mastered: string[]; currentSkill: string | null; stuck: string[] }`
    - `mastered` and `currentSkill` hold skill names.
    - `stuck` holds tag labels: the top 2 tags seen at least twice this week.
  - `buildWeeklyReport(kids: KidWeek[], weekOf: string): Mail-without-to` → `{ subject, text, html }`:
    - The subject is `"Your week with Math Friend"`.
    - The tip comes from the most common stuck tag across all kids, otherwise `DEFAULT_TIP`.
    - The HTML escapes every value.
  - `collectWeek(db, parentId, from: Date, to: Date): Promise<KidWeek[]>`:
    - A session counts if it has at least one attempt in the window.
    - Session minutes = (last attempt `at` − first attempt `at`) + the last attempt's `time_ms`, rounded to whole minutes.
    - `mastered` = skills with `mastered_at` in the window.
  - `sendWeeklyReports(now: Date): Promise<{ sent: number }>`:
    - does nothing unless the hour in `America/New_York` is 17 and it is Sunday there;
    - `week_start` = that Sunday's date (America/New_York) minus 7 days;
    - for each consented parent with at least one kid, inserts `report_sends` first, and skips the parent on a conflict;
    - then sends to the auth user's email;
    - on a send error, deletes the `report_sends` row so the next hourly run retries.
  - `requireCronAuth(req: Request): Response | null` returns a 401 Response unless `authorization === "Bearer " + CRON_SECRET`, compared with `timingSafeEqual`.
  - `GET /api/cron/weekly-report` runs `requireCronAuth`, then `sendWeeklyReports(new Date(Number(searchParams.get("now") ?? Date.now())))`, then returns `{ sent }`. The `now` override is honoured only when `VERCEL_ENV !== "production"`.
  - `vercel.json` crons:
    - `{ "path": "/api/cron/weekly-report", "schedule": "0 * * * 0" }`
    - `{ "path": "/api/cron/retention", "schedule": "0 9 * * *" }`

- [ ] **Step 1: Write the failing tests.**
  - **unit:**
    - `buildWeeklyReport` shows the counts, the skill names and the tip.
    - **Review Focus 5:** a kid with 0 sessions shows "No sessions this week", and no output contains `undefined`, `NaN` or `null`.
    - A nickname `<b>` is escaped in the HTML.
    - Every `MISTAKE_TAGS` entry has a `TAG_LABEL`.
    - `requireCronAuth`: a missing header or a wrong secret gives 401; the right secret gives null.
  - **db:**
    - Seed a consented parent with one kid. Using `admin()`, add 2 sessions of attempts in the window, with tag `off-by-ten` twice, and one skill whose `mastered_at` is in the window.
    - `sendWeeklyReports(<a Sunday 17:00 America/New_York>)` sends 1 email, and the Mailpit body contains the skill name and the `off-by-ten` label.
    - **Review Focus 2:** a second run gives `sent: 0`. Sunday 16:00 ET gives `sent: 0`. A parent without consent gets nothing.
    - The route with no bearer token returns 401, and nothing is sent.
- [ ] **Step 2: Run.** FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** `npm test && npm run test:db && npm run typecheck` → PASS.
- [ ] **Step 5: Commit.** `feat: Sunday weekly report email, built by code, idempotent cron`

---

### Task 5: Data rights

**Files:**
- Create: `src/server/rights.ts`, `src/app/parent/kids/[kidId]/page.tsx`, `src/app/parent/kids/[kidId]/actions.ts`, `src/app/parent/account/page.tsx`, `src/app/parent/account/actions.ts`, `src/app/parent/kids/[kidId]/export/route.ts`.
- Modify: `src/app/parent/page.tsx`, where each kid links to its page and an "Account" link is added.
- Test: `tests/db/rights.db.test.ts`, `tests/e2e/rights.spec.ts`.

**Interfaces:**
- **Consumes:** `requireParent`, `createServerSupabase`, the secret-key admin client.
- **Produces:**
  - `exportKid(db, kidId): Promise<KidExport | null>` returns `{ kid, skill_state, style_stats, attempts, sessions, distress_flags }` read through the parent's own client, or null when the kid is not theirs.
  - `GET /parent/kids/:kidId/export` → `application/json` with `content-disposition: attachment; filename="<nickname>-data.json"`. It needs `parent_ok`.
  - `deleteKid(db, kidId): Promise<boolean>` deletes through the parent's own client; RLS and the cascades remove the rows.
  - `deleteAccount(userId): Promise<void>` calls `auth.admin.deleteUser(userId)`, which cascades through `parents` → `kids` → everything.
  - **Pages:**
    - The kid page shows all of the kid's data in readable tables, an export link, and "Delete <nickname>", which needs the nickname typed to confirm.
    - The account page has "Revoke consent and delete account". It explains that revoking consent deletes everything, and needs the word `DELETE` typed. After deleting, the parent is signed out and sent to `/sign-in?deleted=1`, which shows "Your account and all data were deleted."

- [ ] **Step 1: Write the failing tests.**
  - **db:**
    - `exportKid` returns every table for your own kid, and null for another family's kid.
    - After `deleteKid`, the admin counts of `kids`, `attempts`, `skill_state`, `style_stats`, `sessions` and `distress_flags` for that kid are 0.
    - After `deleteAccount`, the counts for the `parents` row, the `consents` rows and all kid rows are 0, and the auth user no longer exists.
    - **Review Focus 4:** a session opened and then the kid deleted → `POST /api/kids/:kidId/answer` with the old version returns 404, and the turn route returns 404 (call the handlers as `api.db.test.ts` does).
  - **e2e:**
    1. The parent adds Mia and plays one answer.
    2. The kid page lists that attempt, and the export downloads JSON containing `"nickname":"Mia"`.
    3. Deleting with the wrong typed name is refused; the right name removes Mia from `/`.
    4. Deleting the account lands on the deleted message, and signing in again with the same email creates a fresh parent with no consent.
- [ ] **Step 2: Run.** FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** `npm test && npm run test:db && npm run test:e2e && npm run typecheck` → PASS.
- [ ] **Step 5: Commit.** `feat: parent data rights — view, export, delete kid, revoke consent and delete account`

---

### Task 6: Activity tracking and retention

**Files:**
- Create: `src/server/retention.ts`, `src/app/api/cron/retention/route.ts`.
- Modify: `src/server/playApi.ts`, where `parentRepo` touches activity, and `src/app/auth/confirm/route.ts`, which touches activity after a successful verify.
- Test: `tests/db/retention.db.test.ts`.

**Interfaces:**
- **Consumes:** `requireCronAuth` (Task 4), `getMailer`, `deleteAccount` (Task 5), `parentRepo` (`src/server/playApi.ts`, which already calls `getUser()`; add the `touchActivity` call there).
- **Produces:**
  - Migration `0007_touch_activity.sql` adds `touch_activity() returns void`. It is security definer, uses `search_path = ''`, and EXECUTE is revoked from `public` and `anon` and granted to `authenticated`. It runs `update public.parents set last_active_at = now(), retention_warned_at = null where id = auth.uid() and last_active_at < now() - interval '1 hour'`. A definer function is needed because users have no grant on `retention_warned_at`.
  - `touchActivity(db: SupabaseClient): Promise<void>` calls `db.rpc("touch_activity")` with the parent's own client. It logs errors and never throws, so play and sign-in never fail because of it.
  - `runRetention(now: Date): Promise<{ warned: number; deleted: number; purgedFlags: number }>`:
    1. Warn parents with `last_active_at <= now - 365 days` and `retention_warned_at is null`. Set `retention_warned_at = now` first, then send. The email subject is "Your Math Friend account will be deleted in 30 days". The body links to `APP_ORIGIN/sign-in` and says that signing in keeps the account.
    2. Delete parents with `retention_warned_at <= now - 30 days` and `last_active_at <= now - 365 days`, using `deleteAccount`.
    3. Delete `distress_flags` with `at < now - 30 days`.
  - `GET /api/cron/retention` runs `requireCronAuth`, then `runRetention(now)`, with the same non-production `now` override as Task 4.

- [ ] **Step 1: Write the failing tests (db).**
  - A parent seeded at `last_active_at = now - 366 days` gets a warning email and has `retention_warned_at` set.
  - A second run does not warn again.
  - With `retention_warned_at = now - 31 days`, still inactive, the run deletes the account, and the auth user and kid rows are gone.
  - A warned parent who calls `touch_activity()` through their own client has `retention_warned_at` cleared, and is not deleted on the next run.
  - A distress flag 31 days old is purged; one 29 days old is kept.
  - **Review Focus 2:** the route with a wrong token returns 401 and changes nothing.
  - `touch_activity()` called twice within an hour changes `last_active_at` only once.
- [ ] **Step 2: Run.** FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** `npm test && npm run test:db && npm run test:e2e && npm run typecheck` → PASS.
- [ ] **Step 5: Commit.** `feat: activity tracking and 12-month retention with warning and delete`

---

### Task 7: Full-journey e2e, setup guide and roadmap

**Files:**
- Create: `tests/e2e/journey.spec.ts`.
- Modify: `docs/setup.md`, `vault/05 Roadmap/Roadmap.md`, `vault/02 Decisions/Decision - Stack.md`.

- [ ] **Step 1: Write the journey test (spec §10):**
  1. Sign up by email link.
  2. Set the PIN.
  3. Give consent through the fake gateway.
  4. Add a kid.
  5. Play 5 answers.
  6. Call `/api/cron/weekly-report?now=<next Sunday 17:00 ET>` with the cron bearer token.
  7. The report email arrives in Mailpit with the kid's nickname and a session count of at least 1.
- [ ] **Step 2: Run it.** It should PASS on top of Tasks 1–6. If it fails, fix the cause in the owning module and say so in the commit.
- [ ] **Step 3: Update `docs/setup.md`.** Describe these owner steps; nothing outward-facing is executed:
  - Stripe:
    - create the account;
    - set the test keys `STRIPE_SECRET_KEY` and `CONSENT_GATEWAY=stripe`;
    - run one real test check with card `4242 4242 4242 4242`;
    - switch to live keys;
    - sign Stripe's DPA.
  - Resend: `RESEND_API_KEY`, `EMAIL_FROM` on the verified domain, and `MAILER=resend`.
  - Vercel: `CRON_SECRET` (`openssl rand -hex 32`) and `APP_ORIGIN`. Crons come from `vercel.json`, and the hourly-on-Sunday schedule needs a Vercel plan that allows hourly crons.
  - Before the first family:
    - lawyer review of the privacy notice, the distress phrase list and the consent method;
    - remove the "Draft" banner by changing `PRIVACY_NOTICE_VERSION`.
- [ ] **Step 4: Update the vault.**
  - **Roadmap:** mark "3b Consent + report" done.
  - **Decision - Stack:** add these rows, each "owner's choice, 2026-10-09":
    - Consent = Stripe Checkout setup mode;
    - Schedule = Vercel Cron.
- [ ] **Step 5: Run the full check.** `npm test && npm run typecheck && npm run test:db && npm run test:e2e` → all PASS.
- [ ] **Step 6: Commit.** `test: full parent journey e2e; docs: Stripe, Resend and cron setup; roadmap`. Stage only these files and leave the vault `.obsidian` changes alone.
