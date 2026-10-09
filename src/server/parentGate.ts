import "server-only";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyParentCookie } from "./pin";
import { createServerSupabase } from "./supabase";

export const PARENT_COOKIE = "parent_ok";

/** Signed-in parent or redirect to sign-in. */
export async function requireUser() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/sign-in");
  return { supabase, user: data.user as User };
}

/** Signed-in parent who has also entered the PIN in the last 15 minutes, or redirect to the PIN page. */
export async function requireParent() {
  const ctx = await requireUser();
  const value = (await cookies()).get(PARENT_COOKIE)?.value ?? "";
  if (!verifyParentCookie(value, ctx.user.id, Date.now())) redirect("/parent/pin");
  return ctx;
}
