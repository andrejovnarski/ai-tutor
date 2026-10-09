import { NextResponse } from "next/server";
import { playAnswer } from "@/server/play";
import { badRequest, notFound, parentRepo, seed } from "@/server/playApi";

export async function POST(req: Request, { params }: { params: Promise<{ kidId: string }> }) {
  const { kidId } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest();
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return badRequest();
  const { version, given } = body as Record<string, unknown>;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 0) return badRequest();
  if (typeof given !== "number" || !Number.isFinite(given)) return badRequest();

  const repo = await parentRepo();
  if (!repo) return notFound();
  const r = await playAnswer(repo, kidId, version, given, Date.now(), seed);
  if (r.status === 404) return notFound();
  if (r.status === 409) return NextResponse.json({ version: r.version, turn: r.turn }, { status: 409 });
  // Only what the screen needs: no engine logs.
  const { result, then, style, reveal, mastered } = r.feedback;
  return NextResponse.json({
    version: r.version, feedback: { result, then, style, reveal, mastered }, next: r.next,
    ...(r.revealed !== undefined ? { revealed: r.revealed } : {}),
  });
}
