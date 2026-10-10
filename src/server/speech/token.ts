import { createHmac, timingSafeEqual } from "node:crypto";

export function speechToken(secret: string, kidId: string, text: string): string {
  return createHmac("sha256", secret).update(`${kidId}\n${text}`).digest("base64url");
}

export function checkSpeechToken(secret: string, kidId: string, text: string, token: string): boolean {
  try {
    const want = Buffer.from(speechToken(secret, kidId, text), "base64url");
    const got = Buffer.from(token, "base64url");
    return got.length === want.length && timingSafeEqual(got, want);
  } catch {
    return false;
  }
}
