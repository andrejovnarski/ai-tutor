// Reads `supabase status -o env` on stdin, writes .env.local with the app's variable names.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const kv = Object.fromEntries(
  readFileSync(0, "utf8").split("\n").map((l) => /^([A-Z_]+)="?(.*?)"?$/.exec(l)).filter(Boolean).map((m) => [m[1], m[2]]),
);
const need = (k) => kv[k] ?? (console.error(`missing ${k}`), process.exit(1));
const prev = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
const secret = /^PARENT_COOKIE_SECRET=(.+)$/m.exec(prev)?.[1] ?? crypto.randomUUID() + crypto.randomUUID();
const keep = (k, d) => new RegExp(`^${k}=(.+)$`, "m").exec(prev)?.[1] ?? d;
writeFileSync(
  ".env.local",
  [
    `NEXT_PUBLIC_SUPABASE_URL=${need("API_URL")}`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${kv.PUBLISHABLE_KEY ?? need("ANON_KEY")}`,
    `SUPABASE_SECRET_KEY=${kv.SECRET_KEY ?? need("SERVICE_ROLE_KEY")}`,
    `PARENT_COOKIE_SECRET=${secret}`,
    `CONSENT_GATEWAY=${keep("CONSENT_GATEWAY", "fake")}`,
    `MAILER=${keep("MAILER", "mailpit")}`,
    `EMAIL_FROM=${keep("EMAIL_FROM", "Math Friend <hello@localhost>")}`,
    `APP_ORIGIN=${keep("APP_ORIGIN", "http://localhost:3000")}`,
    `CRON_SECRET=${keep("CRON_SECRET", crypto.randomUUID() + crypto.randomUUID())}`,
    ...["STRIPE_SECRET_KEY", "RESEND_API_KEY"].flatMap((k) => (keep(k, "") ? [`${k}=${keep(k, "")}`] : [])),
    "",
  ].join("\n"),
);
console.log("wrote .env.local");
