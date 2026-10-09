import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import Stripe from "stripe";
import { env } from "../env";

export type ConsentVerdict =
  | { ok: true; parentId: string; ref: string; method: "stripe" | "fake" }
  | { ok: false };

export interface ConsentGateway {
  start(parentId: string, returnUrl: string): Promise<{ redirectUrl: string }>;
  verify(sessionId: string): Promise<ConsentVerdict>;
}

const NO: ConsentVerdict = { ok: false };

function fakeMac(parentId: string): string {
  return createHmac("sha256", env.parentCookieSecret()).update(`consent.${parentId}`).digest("hex");
}

/** Local dev and tests: a signed id that stands in for the card check. Never allowed in production. */
export const fakeGateway: ConsentGateway = {
  async start(parentId) {
    return { redirectUrl: `/parent/consent/return?session_id=fake_${parentId}_${fakeMac(parentId)}` };
  },
  async verify(sessionId) {
    const m = /^fake_([0-9a-f-]{36})_([0-9a-f]{64})$/.exec(sessionId);
    if (!m) return NO;
    if (!timingSafeEqual(Buffer.from(m[2]!, "hex"), Buffer.from(fakeMac(m[1]!), "hex"))) return NO;
    return { ok: true, parentId: m[1]!, ref: sessionId, method: "fake" };
  },
};

type StripeLike = Pick<Stripe, "checkout" | "paymentMethods">;

/** Stripe Checkout in setup mode: the card is verified, then detached so nothing is kept or charged. */
export function stripeGateway(client: StripeLike): ConsentGateway {
  return {
    async start(parentId, returnUrl) {
      const session = await client.checkout.sessions.create({
        mode: "setup",
        currency: "usd",
        allowed_payment_method_types: ["card"],
        metadata: { parent_id: parentId },
        success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.appOrigin()}/parent/consent?cancelled=1`,
      });
      if (!session.url) throw new Error("Stripe returned no Checkout URL");
      return { redirectUrl: session.url };
    },
    async verify(sessionId) {
      try {
        const s = await client.checkout.sessions.retrieve(sessionId, { expand: ["setup_intent"] });
        const si = s.setup_intent;
        const parentId = s.metadata?.parent_id;
        if (s.status !== "complete" || !si || typeof si === "string" || si.status !== "succeeded" || !parentId) return NO;
        const pm = typeof si.payment_method === "string" ? si.payment_method : si.payment_method?.id;
        if (pm && s.customer) await client.paymentMethods.detach(pm);
        return { ok: true, parentId, ref: s.id, method: "stripe" };
      } catch {
        return NO;
      }
    },
  };
}

export function getConsentGateway(): ConsentGateway {
  if (env.consentGateway() === "fake") {
    if (process.env.VERCEL_ENV === "production") throw new Error("The fake consent gateway cannot run in production");
    return fakeGateway;
  }
  return stripeGateway(new Stripe(env.stripeSecretKey()));
}
