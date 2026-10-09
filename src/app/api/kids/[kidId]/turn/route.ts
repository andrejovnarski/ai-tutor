import { NextResponse } from "next/server";
import { playTurn } from "@/server/play";
import { badRequest, notFound, parentRepo, seed } from "@/server/playApi";

export async function POST(_req: Request, { params }: { params: Promise<{ kidId: string }> }) {
  const { kidId } = await params;
  const repo = await parentRepo();
  if (!repo) return notFound();
  const r = await playTurn(repo, kidId, Date.now(), seed);
  if (r.status === 404) return notFound();
  return NextResponse.json({ version: r.version, turn: r.turn });
}
