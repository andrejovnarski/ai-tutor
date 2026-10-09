import "server-only";

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

let warnedTutorVoice = false;

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
  /** "claude" or "canned"; unset means "canned" so nothing calls Claude by accident. A bad value is
   * "canned" too (warned once): a typo must never cost a child a line or a request a 500. */
  tutorVoice: (): "claude" | "canned" => {
    const v = process.env.TUTOR_VOICE || "canned";
    if (v === "claude" || v === "canned") return v;
    if (!warnedTutorVoice) {
      warnedTutorVoice = true;
      console.warn(`TUTOR_VOICE must be "claude" or "canned", got "${v}"; using "canned"`);
    }
    return "canned";
  },
};
