# Setup guide

Owner steps for local development and for going live. Nothing here is run automatically; the hosted steps are yours to do.

## Local development

1. `npx supabase start` (needs Docker).
2. `npm run env:local` writes `.env.local` from the running stack and keeps an existing `PARENT_COOKIE_SECRET`.
3. Run the checks:
   - `npm test` (unit)
   - `npm run typecheck`
   - `npm run test:db` (database tests against local Supabase)
   - `npm run test:e2e` (Playwright)
4. `npm run dev` to use the app.

## Hosted Supabase

1. Create a project at supabase.com. Save the database password.
2. Link and push the schema (migrations `0001_init`, `0002_save_step_hardening`, `0003_pin_attempts`):
   ```
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
3. In Authentication, URL Configuration:
   - Site URL: the production URL (for example `https://your-app.vercel.app`).
   - Redirect URLs: the same origin, plus any preview origin you use.
4. In Authentication, Email Templates, set the **Magic Link** template to the same body as `supabase/templates/magic_link.html`:
   ```html
   <h2>Sign in</h2>
   <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Sign in to Adaptive Tutor</a></p>
   ```

### Cautions

- **Do not `supabase config push` the local config.** The local `[auth.rate_limit] email_sent` was raised so tests can sign in repeatedly. Set the hosted project's email rate limit in the dashboard instead.
- **Only the `magic_link` template is customised.** Keep "Confirm email" off in hosted Auth (matching local `enable_confirmations = false`). Otherwise customise the `confirmation` template to the same link, `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`, or first-time parents land on the error page.

## Resend as custom SMTP

Supabase's built-in mailer is for testing only. Use Resend:

1. Create a Resend account and add and verify a sending domain (DNS records).
2. Sign Resend's data processing agreement (parent emails pass through it).
3. Create an API key.
4. In Supabase, Authentication, SMTP Settings, enable custom SMTP:
   - Host: `smtp.resend.com`
   - Port: `465`
   - User: `resend`
   - Password: the Resend API key
   - Sender: an address on the verified domain
5. Send yourself a magic link to confirm delivery.

## Stripe (consent)

Parental consent is a card check with no charge: Stripe Checkout in setup mode. Locally the app uses a fake gateway.

1. Create a Stripe account.
2. Set the **test** keys: `STRIPE_SECRET_KEY` (starts `sk_test_`) and `CONSENT_GATEWAY=stripe`.
3. Run one real check in test mode with card `4242 4242 4242 4242` (any future expiry, any CVC). Confirm the consent row appears and no charge is made.
4. Switch to the **live** keys.
5. Sign Stripe's data processing agreement.

Note: the app has no Stripe webhook yet. Consent is recorded only when the parent returns to the app after Checkout. Nothing stays attached if they never return: Checkout uses `customer_creation: "if_required"`, so no Stripe Customer is created and the card is not attached to one. A `checkout.session.completed` webhook is still on the to-do list, so that consent completes even if the parent never returns.

## Resend (app email)

The weekly report and distress emails go through Resend too (Auth email is set up above).

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | The Resend API key |
| `EMAIL_FROM` | An address on the verified domain |
| `MAILER` | `resend` |

## Tutor voice (Claude)

Nova's lines come from Claude when `TUTOR_VOICE=claude`. Unset (or any other value) means canned lines only, so nothing calls Claude by accident. Every AI line is checked before it is spoken; a failed check, an error or a timeout falls back to a canned line.

| Variable | Value |
|---|---|
| `TUTOR_VOICE` | `claude` to turn it on; `canned` (the default) to keep it off |
| `ANTHROPIC_API_KEY` | On Vercel: an Anthropic API key (server only, never expose). Locally you can instead run `ant auth login` and leave the key unset; the SDK finds the credentials itself |

### Run the eval before families

The eval is the only place that spends money on purpose. It runs 46 turn plans through the real voice and the line checks.

```
npm run eval:tutor                  # prints the case count and cost estimate; makes no API call
npm run eval:tutor -- --yes         # runs it for real (about $1 for 46 cases)
npm run eval:tutor -- --yes --limit 8   # a cheap smoke run
```

The estimate is cases x (about 1,500 cached input + 300 uncached input + 1,000 output tokens) at the Opus 5.5 rates: $4/MTok input, $0.20/MTok cache read, $20/MTok output. It needs credentials as above and writes `evals/tutor/report-<date>.md`.

A passing report:

- the script exits 0: no more than 10% of cases ended on a canned line;
- most outcomes are `ai`; a few `ai-retry` are fine, but many `canned:guard` entries mean the prompt or a guard needs work (the guard reasons show which);
- p50 latency near the 1.5 s goal and p95 under the 2.5 s cap;
- mean `cacheRead` above zero after the first case (the prompt cache is working);
- you spot-read the listed lines for tone: warm, short, never saying the answer early, never naming the child's mistake as a fault.

### Latency

The goal is the first word within about 1.5 s. The hard cap is 2.5 s: after that Nova uses a canned line, so a child never waits longer. If measured latency or cost is too high, consider Sonnet 5.5 or Haiku 4.5 (one constant, `MODEL` in `src/server/tutor/voice.ts`). Only do that if the eval shows it is needed; it is the owner's decision (spec section 7).

## Vercel

Set these environment variables for the project:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Hosted project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Hosted publishable key |
| `SUPABASE_SECRET_KEY` | Hosted secret key (server only, never expose) |
| `PARENT_COOKIE_SECRET` | Output of `openssl rand -hex 32` |
| `CRON_SECRET` | Output of `openssl rand -hex 32`; Vercel sends it as a bearer token to the cron routes |
| `APP_ORIGIN` | The production origin, for example `https://your-app.vercel.app` |
| `STRIPE_SECRET_KEY`, `CONSENT_GATEWAY`, `RESEND_API_KEY`, `EMAIL_FROM`, `MAILER` | As in the Stripe and Resend sections |
| `TUTOR_VOICE`, `ANTHROPIC_API_KEY` | As in the Tutor voice section |

Crons come from `vercel.json`: the weekly report (hourly on Sundays, it sends from 17:00 New York time) and daily retention. Hourly crons need a Vercel plan that allows them; the free Hobby plan does not.

### Production cautions

- **Retention deletes `auth.users` through a SQL definer function.** Verify on the hosted project that it works: delete one test account through retention and check the user is gone.
- **`tests/db/globalSetup.ts` deletes `@test.dev` users.** Only ever run the db test suite against the local stack.

## Before the first family signs up

Do not invite real families until all of these are done:

1. A lawyer reviews the privacy notice, the distress phrase list and the consent method (spec sections 8 and 11, `docs/superpowers/specs/2026-10-08-adaptive-tutor-design.md`).
   Also ask the lawyer: the privacy notice is currently reachable only after sign-in and the parent PIN. Does it need a public link before sign-up?
2. Remove the "Draft" banner by changing `PRIVACY_NOTICE_VERSION` (in `src/server/consent/notice.ts`) to a non-draft version.
3. The Stripe, Resend and Vercel steps above are done, including the hosted retention check.
4. `npm run eval:tutor -- --yes` passes (Tutor voice section).
