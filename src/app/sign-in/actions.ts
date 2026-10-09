"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/server/supabase";

/** Always ends on "Check your email", whether or not the address has an account. */
export async function requestLink(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  if (email) {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "http";
    const supabase = await createServerSupabase();
    // The result is deliberately ignored so the response never depends on the address.
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${proto}://${host}/auth/confirm` },
    });
  }
  redirect("/sign-in?sent=1");
}
