import { NextResponse } from "next/server";
import { badRequest, notFound, parentRepo } from "@/server/playApi";
import { getTts, SpeechError, speechMode } from "@/server/speech/config";
import { checkSpeechToken } from "@/server/speech/token";
import { env } from "@/server/env";

const MAX_CHARS = 300;

// Synthesises text that this server itself tokenised for this kid (a line's nickname-free speech text), so the
// route cannot be used to voice arbitrary text, and the name never reaches the voice.
export async function POST(req: Request, { params }: { params: Promise<{ kidId: string }> }) {
  const { kidId } = await params;
  if (speechMode() === "off") return notFound();
  const repo = await parentRepo();
  if (!repo) return notFound();
  try {
    if (!(await repo.loadKid(kidId))) return notFound();
  } catch {
    return notFound();
  }
  const tts = getTts();
  if (!tts) return notFound();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest();
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return badRequest();
  const { text, token } = body as Record<string, unknown>;
  if (typeof text !== "string" || typeof token !== "string" || text.length < 1 || text.length > MAX_CHARS) return badRequest();
  if (!checkSpeechToken(env.speechTokenSecret(), kidId, text, token)) return badRequest();

  try {
    const audio = await tts.synthesize(text, AbortSignal.timeout(5000));
    return new Response(audio as BodyInit, {
      headers: { "content-type": "audio/mpeg", "cache-control": "private, max-age=86400" },
    });
  } catch (err) {
    if (!(err instanceof SpeechError)) console.warn("speak failed");
    return NextResponse.json({ error: "tts" }, { status: 503 });
  }
}
