import "server-only";
import { NextResponse } from "next/server";
import { SupabaseRepo } from "./persist/supabaseRepo";
import type { Speak } from "./play";
import { touchActivity } from "./retention";
import { createServerSupabase } from "./supabase";
import { clipFor } from "./speech/clips";
import { speechMode } from "./speech/config";
import type { LineSpeech } from "./speech/lineSpeech";
import { speakable } from "./speech/speakable";
import { speechToken } from "./speech/token";
import { env } from "./env";
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

export type { LineSpeech };

/** What to speak for this text, or undefined when speech is off. The token ties the text to this kid for /speak. */
export function speechFor(kidId: string, text: string): LineSpeech | undefined {
  if (speechMode() === "off") return undefined;
  const clip = clipFor(text);
  return { text, token: speechToken(env.speechTokenSecret(), kidId, text), ...(clip ? { clip } : {}) };
}

/** The fixed notices the tablet speaks itself (no round trip to decide what to say). */
export function speechCues(kidId: string): Record<"tryAgain" | "notCaught" | "cantHear", LineSpeech> | undefined {
  const tryAgain = speechFor(kidId, "Let's try again.");
  if (!tryAgain) return undefined;
  return {
    tryAgain,
    notCaught: speechFor(kidId, "I didn't catch that. Try again or tap your answer.")!,
    cantHear: speechFor(kidId, "I couldn't hear. Tap your answer.")!,
  };
}

/** Whether `text` contains `name` as a whole word (any case; letters and digits of any script count as word parts). */
export function mentions(text: string, name: string): boolean {
  const n = name.trim();
  if (!n) return false;
  const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, "iu").test(text);
}

/** The line as the browser gets it: `{name}` filled with the nickname here, after every plan has been built.
 *  The speech text is made from the line before the name is filled, so the name never reaches the voice. A line that
 *  already spells the nickname itself (a Claude line can) is not voiced at all: the text is on screen. */
export function forKid(line: TutorLine, nickname: string | null, kidId: string): TutorLine & { speech?: LineSpeech } {
  const text = speakable(line.say);
  const speech = nickname && mentions(text, nickname) ? undefined : speechFor(kidId, text);
  return { ...line, say: fillName(line.say, nickname ?? ""), ...(speech ? { speech } : {}) };
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
