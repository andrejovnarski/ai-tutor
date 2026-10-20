import "server-only";

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

let warnedTutorVoice = false;
let warnedSpeech = false;
let warnedRewards = false;

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
  /** "azure", "fake" or "off"; unset or bad is "off" (warned once). */
  speech: (): "azure" | "fake" | "off" => {
    const v = process.env.SPEECH || "off";
    if (v === "azure" || v === "fake" || v === "off") return v;
    if (!warnedSpeech) {
      warnedSpeech = true;
      console.warn(`SPEECH must be "azure", "fake" or "off", got "${v}"; using "off"`);
    }
    return "off";
  },
  /** "on" or "off"; unset or bad is "off" (warned once). */
  rewards: (): "on" | "off" => {
    const v = process.env.REWARDS || "off";
    if (v === "on" || v === "off") return v;
    if (!warnedRewards) {
      warnedRewards = true;
      console.warn(`REWARDS must be "on" or "off", got "${v}"; using "off"`);
    }
    return "off";
  },
  azureSpeechKey: () => need("AZURE_SPEECH_KEY"),
  azureSpeechRegion: () => need("AZURE_SPEECH_REGION"),
  speechTokenSecret: () => need("SPEECH_TOKEN_SECRET"),
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
