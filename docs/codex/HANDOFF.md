# Claude ↔ Codex handoff

Shared notes between Claude Code (lead: plans, reviews, merges) and Codex (implementer).
Claude writes tasks here; Codex reads this file, does the task, and writes its report
back under the task. The owner (Andrej) has the final say on everything.

## Rules for Codex

1. Read `AGENTS.md`, `PRODUCT.md` and `DESIGN.md` first. This repo uses a newer Next.js than
   you know — check `node_modules/next/dist/docs/` before touching Next APIs.
2. Do **only** the active task below. No drive-by refactors, no renames, no new dependencies
   unless the task says so.
3. Claude creates the task branch before handing it to you. **Don't run git commands that write**
   (no commit, checkout, branch, stash, reset, push). Leave your changes uncommitted; Claude reviews
   and commits them. Read-only git (`status`, `diff`, `log`) is fine.
4. Write the test first when the task changes behaviour (Vitest for units, `tests/` for e2e).
5. Before reporting done, run and paste the result lines of:
   - `npm run typecheck`
   - `npm test`
   - Don't run `npm run test:db` / `npm run test:e2e` — they need Docker and network, which your
     sandbox doesn't have. Claude runs them.
6. Don't kill anything on port 3000 — that's the owner's dev server.
7. Kids' privacy matters (COPPA): never log, store or send child data anywhere new.
   If a task seems to need that, stop and say so in the report.
8. If something is unclear, make the smallest sensible choice and list it under
   "Choices I made" in the report rather than stopping.

## Rules for Claude

- One active task at a time; each has a goal, files, acceptance checks and a branch.
- Use the project skill `/codex-task` — it covers the whole loop (write task → branch → dispatch →
  review → commit → done log).
- When Codex reports back: read the diff, run all suites yourself (db/e2e via
  `echo '<cmd>' | newgrp docker` if Docker is needed), then review.
  Fixes go back to Codex as a new "Fix round" under the same task.
- Move finished tasks to the Done log with the commit range.
- Ask the owner before merging to `main` or pushing.

---

## Active task

### T5 — Check login locally (getClaims) in the proxy and kid play API
- **Branch:** `codex/auth-claims` (already checked out, from `main`)
- **Goal:** far fewer calls to the Supabase auth server. Today the proxy calls `auth.getUser()` on
  every request (a network round trip), and each kid play API call calls it again in `parentRepo()`.
  Under e2e that was ~1200 calls/min and the local auth container ran out of ports. Both local and
  hosted projects use asymmetric ES256 signing keys (JWKS checked by Claude), so `auth.getClaims()`
  verifies the JWT locally with no network call.
- **Owner ruling:** kid play → local check; parent pages → keep `getUser()` (it catches "signed out on
  another device" at once). Accepted risk: after a sign-out elsewhere, kid play keeps working until
  the access token expires (≤ 1 h), only on that family's own data (RLS still applies).
- **Context:** `src/proxy.ts` (session refresh; Supabase's own Next.js example uses `getClaims()` here —
  keep "no code between createServerClient and the auth call"); `src/server/playApi.ts`
  `parentRepo()` used by `src/app/api/kids/[kidId]/*/route.ts`; `src/server/parentGate.ts`
  `requireUser()` (leave on `getUser()`). `getClaims()` returns `{ data: { claims } | null, error }`;
  the user id is `claims.sub`. Read the installed `@supabase/supabase-js` / `@supabase/ssr` types in
  `node_modules` for the exact shape — don't guess.
- **Do:**
  1. Tests first: unit tests that `parentRepo()` returns null when `getClaims()` has no claims or an
     error, returns a repo when claims exist, and **never calls `getUser()`**. Mock the server client the
     way existing tests in `src/server` do. Same idea for the proxy if it is unit-testable; if not, say why.
  2. `src/proxy.ts`: `getUser()` → `getClaims()`. Update its comment.
  3. `parentRepo()`: `getUser()` → `getClaims()`; signed out = no claims or error. Keep `touchActivity`.
  4. Don't change `requireUser()`/`requireParent()`, `retention.ts`, report/distress code.
- **Don't:** change cookies, RLS, sign-in flow, middleware matcher, or env vars. No new deps.
- **Acceptance:** `npm run typecheck`, `npm test` green. Claude runs db + e2e twice and counts auth
  `/user` calls before/after.

#### Codex report
- Files changed:
- Test results:
- Choices I made:
- Open questions:

<!-- Template:
### T1 — <title>
- **Branch:** `codex/<slug>`
- **Goal:** what should be true when done (plain words)
- **Context:** spec/plan links, relevant files
- **Do:** numbered steps
- **Don't:** out-of-scope things
- **Acceptance:** commands that must pass + behaviour to check

#### Codex report
- Files changed:
- Test results:
- Choices I made:
- Open questions:
-->

## Done log

| Task | Branch | Commits | Result |
|------|--------|---------|--------|
| T1 — "-es" plurals in number guard | `codex/es-plurals` | 0b6e0d4 | Done first try; unit 1214 green, typecheck clean |
| T2 — Placement step cap (6 per probe) | `codex/placement-step-cap` | af8bade | 1 fix round (old sim tests assumed K kid knows ~all; ruled grade-matched). unit 1220, db 133, e2e 62 (4 flaky reruns) |
| T3 — e2e flakes: mail wait + rewards XP seed | `codex/e2e-flakes` | db3696f | rewards.spec 20/20 repeated. Remaining flakes: journey weekly-report cron loops over all leftover local test parents and slows the server |
| T4 — e2e deletes leftover @example.com users | `codex/e2e-flakes` | 8118237 | parents stay flat between runs. Remaining flakes: local auth container runs out of ports (`cannot assign requested address`) under ~1200 getUser calls/min |
