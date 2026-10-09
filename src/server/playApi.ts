import "server-only";
import { NextResponse } from "next/server";
import { SupabaseRepo } from "./persist/supabaseRepo";
import type { Speak } from "./play";
import { touchActivity } from "./retention";
import { createServerSupabase } from "./supabase";
import { fillName } from "./tutor/plan";
import type { TutorLine } from "./tutor/types";
import { getTutorVoice, speak } from "./tutor/voice";

export const seed = () => crypto.getRandomValues(new Uint32Array(1))[0]!;
export const notFound = () => NextResponse.json({ error: "not found" }, { status: 404 });
export const badRequest = () => NextResponse.json({ error: "bad request" }, { status: 400 });
/** An unexpected failure (database down, a lost race that would not settle): logged here, the client may retry. */
export const tryAgain = (route: string, err: unknown) => {
  console.error(`${route} failed`, err);
  return NextResponse.json({ error: "try again" }, { status: 503 });
};
/** Largest magnitude attempts.answer (a Postgres int) can hold. */
export const MAX_INT = 2 ** 31 - 1;

/** The signed-in parent's repo (RLS applies), or null when signed out. The PIN cookie is not needed: kids play without it. */
export async function parentRepo(): Promise<SupabaseRepo | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  await touchActivity(supabase);
  return new SupabaseRepo(supabase);
}

/** Nova's guarded voice (Claude or canned, per TUTOR_VOICE). Never throws: a failure is a canned line. */
export function novaSpeak(): Speak {
  const voice = getTutorVoice();
  return async (plan, s) => (await speak(plan, { voice, seed: s })).line;
}

/** The line as the browser gets it: `{name}` filled with the nickname here, after every plan has been built. */
export function forKid(line: TutorLine, nickname: string | null): TutorLine {
  return { ...line, say: fillName(line.say, nickname ?? "") };
}

/** The nickname for `{name}`, or null ("friend") if the lookup fails: a name must never fail a step that was saved. */
export async function nicknameOrNull(repo: SupabaseRepo, kidId: string): Promise<string | null> {
  try {
    return await repo.nickname(kidId);
  } catch {
    console.warn("nickname lookup failed; using the default name");
    return null;
  }
}
