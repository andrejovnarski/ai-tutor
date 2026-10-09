import { NextResponse } from "next/server";
import { SupabaseRepo } from "./persist/supabaseRepo";
import { createServerSupabase } from "./supabase";

export const seed = () => crypto.getRandomValues(new Uint32Array(1))[0]!;
export const notFound = () => NextResponse.json({ error: "not found" }, { status: 404 });
export const badRequest = () => NextResponse.json({ error: "bad request" }, { status: 400 });

/** The signed-in parent's repo (RLS applies), or null when signed out. The PIN cookie is not needed: kids play without it. */
export async function parentRepo(): Promise<SupabaseRepo | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  return data.user ? new SupabaseRepo(supabase) : null;
}
