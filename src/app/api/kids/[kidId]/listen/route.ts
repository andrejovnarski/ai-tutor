import { NextResponse } from "next/server";
import { routeHeard } from "@/domain/checker/heard";
import { badRequest, notFound, parentRepo, speechFor } from "@/server/playApi";
import { getStt, speechMode } from "@/server/speech/config";

const MAX_BYTES = 256 * 1024;

// Recognises one short recording. Never answers: the tablet decides what to do with the route. The audio and the
// recognised text are used here and dropped; neither is stored or logged.
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
  const stt = getStt();
  if (!stt) return notFound();

  const declared = req.headers.get("content-length");
  if (declared !== null && Number(declared) > MAX_BYTES) return NextResponse.json({ error: "too large" }, { status: 413 });
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length > MAX_BYTES) return NextResponse.json({ error: "too large" }, { status: 413 });
  const riff = bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF";
  if (!riff) return badRequest();

  let heard;
  try {
    heard = await stt.recognize(bytes, AbortSignal.timeout(5000));
  } catch {
    return NextResponse.json({ error: "stt" }, { status: 503 });
  }
  if (!heard) return NextResponse.json({ heard: "", route: { kind: "nothing" } });
  const route = routeHeard(heard);
  const speech = route.kind === "confirm" ? speechFor(kidId, `Did you say ${route.n}?`) : undefined;
  return NextResponse.json({ heard: heard.text, route, ...(speech ? { speech } : {}) });
}
