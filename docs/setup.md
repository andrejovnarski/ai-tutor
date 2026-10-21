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

## Order of going live

1. GitHub: create a **private** repository and push `main` (Vercel deploys from it).
2. Hosted Supabase (below).
3. Resend: domain, DPA, SMTP in Supabase (below).
4. Stripe in test mode (below).
5. Vercel: import the repo, set the variables, deploy (below).
6. Speech, if any pilot kid is 5 to 7 (below).
7. Run the checks in "Before the first family signs up".

Pick a US region everywhere (Supabase, Vercel functions, Azure) so data stays in one country.

## Hosted Supabase

1. Create a project at supabase.com. Save the database password.
2. Link and push the schema (every file in `supabase/migrations`, `0001` to `0010`):
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
   <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Sign in to Brightling AI</a></p>
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

The eval is the only place that spends money on purpose. It runs 51 turn plans through the real voice and the line checks.

```
npm run eval:tutor                  # prints the case count and cost estimate; makes no API call
npm run eval:tutor -- --yes         # runs it for real (about $1 for 51 cases)
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

The goal is the first word within about 1.5 s. Each line is capped at 2.5 s: after that Nova uses a canned line for it. A whole request can still take longer, because an answer that ends the session rolls over into a new one (another line) and a request that loses a race with another tablet retries its step.

If measured latency or cost is too high, Sonnet 5.5 or Haiku 4.5 are candidates (`MODEL` in `src/server/tutor/voice.ts`), but switching models is more than changing that constant: re-check that the new model supports every request option the voice sends, in particular `output_config.effort` (Haiku 4.5 rejects `effort` with an error, which would turn every line into `canned:error`) and the server-side `fallbacks` beta. Run the eval after any switch. Only do it if the eval shows it is needed; it is the owner's decision (spec section 7).

## Speech (Azure)

Kids talk to Nova and hear her lines when `SPEECH=azure`. Unset (or `off`) means the screen without mic or audio. Needed for kids aged 5 to 7, who can't read the lines yet.

1. In the Azure portal create a **Speech** resource (Azure AI services, Speech) in a US region, for example `eastus`. The free F0 tier is enough for a pilot.
2. Copy Key 1 and the region into `.env.local`:
   | Variable | Value |
   |---|---|
   | `SPEECH` | `azure` |
   | `AZURE_SPEECH_KEY` | Key 1 |
   | `AZURE_SPEECH_REGION` | The region, for example `eastus` |
   | `SPEECH_TOKEN_SECRET` | Output of `openssl rand -hex 32` |
3. `npm run speech:smoke`: hears the sample "twelve" and speaks one line (about $0.01).
4. `npm run speech:premake`: renders Nova's fixed lines to `public/audio/nova/` once. Commit the mp3 files and `manifest.json`.
5. Set the same four variables on Vercel (a new `SPEECH_TOKEN_SECRET` there is fine).
6. The app never asks Azure to keep audio (it does not send `storeAudio`). Keep it that way.
7. Microsoft's data protection terms (DPA) apply to Azure services; confirm they cover the resource and keep a copy for the lawyer.
8. Check on a real iPad in Safari: Nova speaks after the avatar tap, the mic asks for permission, "twelve" answers, a mumble asks "Did you say...?".

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
| `TUTOR_VOICE`, `ANTHROPIC_API_KEY` | As in the Tutor voice section. For the pilot leave `TUTOR_VOICE` unset (canned lines) |
| `SPEECH`, `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, `SPEECH_TOKEN_SECRET` | As in the Speech section. Unset means no mic and no audio |
| `REWARDS` | `on` or `off`. Cubes, levels, the week goal and stickers on the end card, the picker, the child page and the weekly email. Unset (or anything else) means `off`. Leave it off until the lawyer answers question 10 in `docs/lawyer-brief.md` |

Crons come from `vercel.json`: the weekly report (hourly on Sundays, it sends from 17:00 New York time) and daily retention. Hourly crons need a Vercel plan that allows them; the free Hobby plan does not, so use Pro. Hobby is also for non-commercial use only.

Steps: in Vercel, Add New Project, import the GitHub repo, set the variables above for Production (and Preview if you use previews), deploy. Then set the Supabase Site URL and Redirect URLs to the deployed origin and set `APP_ORIGIN` to match. Redeploy after changing variables.

### Production cautions

- **Retention deletes `auth.users` through a SQL definer function.** Verify on the hosted project that it works: delete one test account through retention and check the user is gone.
- **`tests/db/globalSetup.ts` deletes `@test.dev` users.** Only ever run the db test suite against the local stack.

## Before the first family signs up

Do not invite real families until all of these are done:

1. A lawyer reviews the privacy notice, the distress phrase list and the consent method. Send them `docs/lawyer-brief.md`; it lists every question.
2. Remove the "Draft" banner by changing `PRIVACY_NOTICE_VERSION` (in `src/server/consent/notice.ts`) to a non-draft version.
3. The Stripe, Resend and Vercel steps above are done, including the hosted retention check.
4. Data processing agreements are signed (or accepted) with Supabase, Vercel, Resend, Stripe, and Microsoft if speech is on, and Anthropic if Claude is on.
5. If `SPEECH=azure`: the Speech steps are done, including the iPad check.
6. If `TUTOR_VOICE=claude`: `npm run eval:tutor -- --yes` passes (Tutor voice section). Not needed for canned lines.
7. 3 to 5 playtests with a parent present (spec section 10) on the deployed app.
