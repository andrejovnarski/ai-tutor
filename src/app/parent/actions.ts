"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PARENT_COOKIE, requireParent, requireUser } from "@/server/parentGate";
import { canResetPin, hashPin, isValidPin, signParentCookie, verifyPin } from "@/server/pin";
import { clearPin, readPinRow, recordPinFailure, resetPinFailures, storePin } from "@/server/parentPinStore";
import { parseKidProfile, ageBandFor } from "@/server/kidProfile";

async function grantParentCookie(parentId: string) {
  (await cookies()).set(PARENT_COOKIE, signParentCookie(parentId, Date.now()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/parent",
    maxAge: 15 * 60,
  });
}

/** First visit: choose a PIN. Only allowed while no PIN is set. */
export async function setPin(formData: FormData): Promise<void> {
  const { user } = await requireUser();
  const row = await readPinRow(user.id);
  if (row.pin_hash) redirect("/parent/pin");
  const pin = String(formData.get("pin") ?? "");
  if (!isValidPin(pin)) redirect("/parent/pin?error=format");
  if (pin !== String(formData.get("pin2") ?? "")) redirect("/parent/pin?error=mismatch");
  const { hash, salt } = await hashPin(pin);
  await storePin(user.id, hash, salt);
  await grantParentCookie(user.id);
  redirect("/parent");
}

export async function unlock(formData: FormData): Promise<void> {
  const { user } = await requireUser();
  const row = await readPinRow(user.id);
  if (!row.pin_hash || !row.pin_salt) redirect("/parent/pin");
  const now = Date.now();
  const lockedUntil = row.pin_locked_until ? Date.parse(row.pin_locked_until) : 0;
  if (lockedUntil > now) redirect("/parent/pin?error=locked");
  const pin = String(formData.get("pin") ?? "");
  if (isValidPin(pin) && (await verifyPin(pin, row.pin_hash, row.pin_salt))) {
    if (row.pin_failed || lockedUntil) await resetPinFailures(user.id);
    await grantParentCookie(user.id);
    redirect("/parent");
  }
  const { lockedUntil: locked } = await recordPinFailure(user.id);
  redirect(locked && locked > Date.now() ? "/parent/pin?error=locked" : "/parent/pin?error=wrong");
}

/** Clears the PIN, but only within 10 minutes of an email-link sign-in. */
export async function forgotPin(): Promise<void> {
  const { user } = await requireUser();
  const signedIn = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : 0;
  if (!canResetPin(signedIn, Date.now())) redirect("/parent/pin?error=forgot");
  await clearPin(user.id);
  redirect("/parent/pin");
}

export async function addKid(formData: FormData): Promise<void> {
  const { supabase, user } = await requireParent();
  const { data: parent } = await supabase.from("parents").select("consent_at").eq("id", user.id).single();
  if (!parent?.consent_at) redirect("/parent");
  const parsed = parseKidProfile({
    nickname: formData.get("nickname"),
    grade: formData.get("grade"),
    avatar: formData.get("avatar"),
  });
  if (!parsed.ok) {
    const field = (["nickname", "grade", "avatar"] as const).find((f) => parsed.errors[f])!;
    redirect(`/parent/kids/new?error=${field}`);
  }
  const { nickname, grade, avatar } = parsed.value;
  const { error } = await supabase
    .from("kids")
    .insert({ parent_id: user.id, nickname, grade, age_band: ageBandFor(grade), avatar });
  if (error) redirect("/parent/kids/new?error=save");
  redirect("/parent");
}
