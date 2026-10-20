import { NextResponse } from "next/server";
import { playHelp } from "@/server/play";
import { badRequest, forKid, nicknameOrNull, notFound, novaSpeak, parentRepo, seed, tryAgain, withRewards } from "@/server/playApi";

export async function POST(req: Request, { params }: { params: Promise<{ kidId: string }> }) {
  const { kidId } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest();
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return badRequest();
  const { version } = body as Record<string, unknown>;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 0) return badRequest();

  const repo = await parentRepo();
  if (!repo) return notFound();
  let r, nickname;
  try {
    [r, nickname] = await Promise.all([
      playHelp(repo, kidId, version, Date.now(), seed, novaSpeak()), nicknameOrNull(repo, kidId),
    ]);
  } catch (err) {
    return tryAgain("help", err);
  }
  if (r.status === 404) return notFound();
  if (r.status === 409) {
    return NextResponse.json(
      { version: r.version, turn: await withRewards(r.turn, repo.client, kidId), ...(r.line ? { line: forKid(r.line, nickname, kidId) } : {}) }, { status: 409 });
  }
  // Only what the screen needs: no engine logs.
  const { result, then, style, reveal, mastered } = r.feedback;
  return NextResponse.json({
    version: r.version, feedback: { result, then, style, reveal, mastered }, next: await withRewards(r.next, repo.client, kidId),
    line: forKid(r.line, nickname, kidId), ...(r.nextLine ? { nextLine: forKid(r.nextLine, nickname, kidId) } : {}),
    ...(r.revealed !== undefined ? { revealed: r.revealed } : {}),
  });
}
