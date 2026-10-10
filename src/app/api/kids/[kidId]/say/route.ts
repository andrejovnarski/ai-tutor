import { NextResponse } from "next/server";
import { detectDistress } from "@/server/distress/detect";
import { DISTRESS_REPLY } from "@/server/distress/phrases";
import { reportDistress } from "@/server/distress/report";
import { playSay } from "@/server/play";
import { badRequest, forKid, nicknameOrNull, notFound, novaSpeak, parentRepo, seed, speechFor, tryAgain } from "@/server/playApi";

// Recognised speech arrives here. Text is only ever kept (and logged) when it matches the distress list.
// Anything else gets Nova's steer-back to the problem (no open chat): nothing is stored, and only the turn plan
// (which may carry the text, never the name) goes to the voice.
export async function POST(req: Request, { params }: { params: Promise<{ kidId: string }> }) {
  const { kidId } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest();
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return badRequest();
  const { text } = body as Record<string, unknown>;
  if (typeof text !== "string" || text.length < 1 || text.length > 500) return badRequest();

  const repo = await parentRepo();
  if (!repo) return notFound();
  let hit = false;
  try {
    if (!(await repo.loadKid(kidId))) return notFound();
    hit = detectDistress(text).hit;
    if (!hit) {
      const [line, nickname] = await Promise.all([playSay(repo, kidId, text, seed(), novaSpeak()), nicknameOrNull(repo, kidId)]);
      if (!line) return notFound();
      const out = forKid(line, nickname, kidId);
      return NextResponse.json({ reply: out.say, ...(out.speech ? { replySpeech: out.speech } : {}) });
    }
    await reportDistress(kidId, text, Date.now());
  } catch (err) {
    // Even if storing failed, a child who said something worrying still hears the line.
    const res = tryAgain("say", err);
    if (!hit) return res;
    const replySpeech = speechFor(kidId, DISTRESS_REPLY);
    return NextResponse.json({ error: "try again", reply: DISTRESS_REPLY, ...(replySpeech ? { replySpeech } : {}) }, { status: res.status });
  }
  const replySpeech = speechFor(kidId, DISTRESS_REPLY);
  return NextResponse.json({ reply: DISTRESS_REPLY, ...(replySpeech ? { replySpeech } : {}) });
}
