import "server-only";
import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { env } from "./env";

const MIN = 60_000;
export const COOKIE_MS = 15 * MIN;
export const RESET_WINDOW_MS = 10 * MIN;

const KEYLEN = 32;

function derive(pin: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(pin, salt, KEYLEN, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPin(pin: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16);
  return { hash: (await derive(pin, salt)).toString("hex"), salt: salt.toString("hex") };
}

export async function verifyPin(pin: string, hash: string, salt: string): Promise<boolean> {
  const expected = Buffer.from(hash, "hex");
  if (expected.length !== KEYLEN || !/^[0-9a-f]+$/i.test(salt)) return false;
  return timingSafeEqual(await derive(pin, Buffer.from(salt, "hex")), expected);
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

function mac(parentId: string, exp: number): string {
  return createHmac("sha256", env.parentCookieSecret()).update(`${parentId}.${exp}`).digest("hex");
}

export function signParentCookie(parentId: string, now: number): string {
  const exp = now + COOKIE_MS;
  return `${exp}.${mac(parentId, exp)}`;
}

export function verifyParentCookie(value: string, parentId: string, now: number): boolean {
  const m = /^(\d+)\.([0-9a-f]{64})$/.exec(value);
  if (!m) return false;
  const exp = Number(m[1]);
  if (!(exp > now)) return false;
  return timingSafeEqual(Buffer.from(m[2]!, "hex"), Buffer.from(mac(parentId, exp), "hex"));
}

/** "Forgot PIN" only works soon after the parent proved the email by signing in with a link. */
export function canResetPin(lastSignInAt: number, now: number): boolean {
  return now - lastSignInAt <= RESET_WINDOW_MS;
}
