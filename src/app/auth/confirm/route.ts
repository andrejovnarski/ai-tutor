import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { touchActivity } from "@/server/retention";
import { createServerSupabase } from "@/server/supabase";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const to = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl.origin), 303);
  if (!token_hash || !type) return to("/sign-in?error=link");
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error) return to("/sign-in?error=link");
  await touchActivity(supabase);
  return to("/");
}
