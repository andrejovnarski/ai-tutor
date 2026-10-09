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

## Vercel

Set these environment variables for the project:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Hosted project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Hosted publishable key |
| `SUPABASE_SECRET_KEY` | Hosted secret key (server only, never expose) |
| `PARENT_COOKIE_SECRET` | Output of `openssl rand -hex 32` |

## Before the first family signs up

The COPPA lawyer review (spec section 8, `docs/superpowers/specs/2026-10-08-adaptive-tutor-design.md`) must happen first. Consent and the report come in plan 3b; do not invite real families until both are done.
