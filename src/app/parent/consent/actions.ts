"use server";

import { requireParent } from "@/server/parentGate";
import { getConsentGateway } from "@/server/consent/gateway";
import { env } from "@/server/env";

/**
 * Returns where to send the browser. The client navigates with a full page load: a server-action redirect
 * to the same-origin return route (fake gateway) would be handled as a soft navigation and never fetch it.
 */
export async function startConsent(formData: FormData): Promise<{ redirectUrl: string }> {
  const { user } = await requireParent();
  if (formData.get("agree") !== "on") return { redirectUrl: "/parent/consent" };
  return getConsentGateway().start(user.id, `${env.appOrigin()}/parent/consent/return`);
}
