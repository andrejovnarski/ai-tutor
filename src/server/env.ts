import "server-only";

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

export const env = {
  supabaseUrl: () => need("NEXT_PUBLIC_SUPABASE_URL"),
  supabasePublishableKey: () => need("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  supabaseSecretKey: () => need("SUPABASE_SECRET_KEY"),
  parentCookieSecret: () => need("PARENT_COOKIE_SECRET"),
  stripeSecretKey: () => need("STRIPE_SECRET_KEY"),
  consentGateway: () => need("CONSENT_GATEWAY"),
  mailer: () => need("MAILER"),
  resendApiKey: () => need("RESEND_API_KEY"),
  emailFrom: () => need("EMAIL_FROM"),
  cronSecret: () => need("CRON_SECRET"),
  appOrigin: () => need("APP_ORIGIN"),
  /** "claude" or "canned"; unset means "canned" so nothing calls Claude by accident. */
  tutorVoice: (): "claude" | "canned" => {
    const v = process.env.TUTOR_VOICE || "canned";
    if (v !== "claude" && v !== "canned") throw new Error(`TUTOR_VOICE must be "claude" or "canned", got "${v}"`);
    return v;
  },
};
