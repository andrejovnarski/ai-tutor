import { NextResponse } from "next/server";
import { detectDistress } from "@/server/distress/detect";
import { DISTRESS_REPLY } from "@/server/distress/phrases";
import { reportDistress } from "@/server/distress/report";
import { playSay } from "@/server/play";
import { badRequest, forKid, notFound, novaSpeak, parentRepo, seed, tryAgain } from "@/server/playApi";

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
      const [line, nickname] = await Promise.all([playSay(repo, kidId, text, seed(), novaSpeak()), repo.nickname(kidId)]);
      if (!line) return notFound();
      return NextResponse.json({ reply: forKid(line, nickname).say });
    }
    await reportDistress(kidId, text, Date.now());
  } catch (err) {
    // Even if storing failed, a child who said something worrying still hears the line.
    const res = tryAgain("say", err);
    return hit ? NextResponse.json({ error: "try again", reply: DISTRESS_REPLY }, { status: res.status }) : res;
  }
  return NextResponse.json({ reply: DISTRESS_REPLY });
}
