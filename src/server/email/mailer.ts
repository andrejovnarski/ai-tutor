import "server-only";
import { Resend } from "resend";
import { env } from "../env";

export type Mail = { to: string; subject: string; text: string; html: string };
export interface Mailer {
  send(m: Mail): Promise<void>;
}

// "Name <addr@host>" or a bare address.
const address = (from: string) => /<([^>]+)>/.exec(from)?.[1] ?? from;

export const resendMailer: Mailer = {
  async send(m) {
    const { error } = await new Resend(env.resendApiKey()).emails.send({ from: env.emailFrom(), ...m });
    if (error) throw new Error(`Resend failed: ${error.message}`);
  },
};

export const mailpitMailer: Mailer = {
  async send(m) {
    const base = process.env.MAILPIT_URL || "http://127.0.0.1:54324";
    const res = await fetch(`${base}/api/v1/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        From: { Email: address(env.emailFrom()) },
        To: [{ Email: m.to }],
        Subject: m.subject,
        Text: m.text,
        HTML: m.html,
      }),
    });
    if (!res.ok) throw new Error(`Mailpit failed: ${res.status}`);
  },
};

export function getMailer(): Mailer {
  if (env.mailer() === "resend") return resendMailer;
  if (process.env.VERCEL_ENV === "production") throw new Error("MAILER=mailpit is not allowed in production");
  return mailpitMailer;
}
