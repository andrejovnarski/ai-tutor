import { NextResponse } from "next/server";
import { playAgain } from "@/server/play";
import { forKid, nicknameOrNull, notFound, novaSpeak, parentRepo, seed, tryAgain } from "@/server/playApi";

export async function POST(_req: Request, { params }: { params: Promise<{ kidId: string }> }) {
  const { kidId } = await params;
  const repo = await parentRepo();
  if (!repo) return notFound();
  let r, nickname;
  try {
    [r, nickname] = await Promise.all([playAgain(repo, kidId, Date.now(), seed, novaSpeak()), nicknameOrNull(repo, kidId)]);
  } catch (err) {
    return tryAgain("play-again", err);
  }
  if (r.status === 404) return notFound();
  return NextResponse.json({ version: r.version, turn: r.turn, ...(r.line ? { line: forKid(r.line, nickname, kidId) } : {}) });
}
