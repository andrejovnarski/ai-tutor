// Browser-only mic capture. Not unit-tested; the pure parts live in wav.ts and silence.ts.
import { gateStep, rms, type GateState } from "./silence";
import { downsample, encodeWav } from "./wav";

const BUFFER = 2048;

/**
 * Records one utterance and resolves a 16 kHz mono WAV, or null when nothing was said
 * or the signal aborted. Rejects with the getUserMedia DOMException (NotAllowedError,
 * NotFoundError) unchanged. Call it synchronously from the tap handler (Safari).
 * Every track is stopped and the context closed on every exit.
 */
export function startRecording(opts: {
  signal: AbortSignal;
  onLevel?: (rms: number) => void;
}): Promise<Uint8Array | null> {
  // Create the context before any await so Safari counts it as inside the tap.
  const Ctx: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  void ctx.resume().catch(() => {});
  return record(ctx, opts);
}

async function record(
  ctx: AudioContext,
  { signal, onLevel }: { signal: AbortSignal; onLevel?: (rms: number) => void },
): Promise<Uint8Array | null> {
  let stream: MediaStream | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let node: ScriptProcessorNode | null = null;
  const cleanup = () => {
    if (node) node.onaudioprocess = null;
    try { source?.disconnect(); } catch {}
    try { node?.disconnect(); } catch {}
    stream?.getTracks().forEach((t) => t.stop());
    void ctx.close().catch(() => {});
  };
  try {
    if (signal.aborted) return null;
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    if (signal.aborted) return null;
    const s = stream;
    return await new Promise<Uint8Array | null>((resolve) => {
      // ScriptProcessorNode, not an AudioWorklet: no extra module file to serve, works on older iPads.
      source = ctx.createMediaStreamSource(s);
      node = ctx.createScriptProcessor(BUFFER, 1, 1);
      const frameMs = (BUFFER / ctx.sampleRate) * 1000;
      const chunks: Float32Array[] = [];
      let gate: GateState = { ms: 0, speechMs: 0, quietMs: 0, started: false };
      let done = false;
      const finish = (value: () => Uint8Array | null) => {
        if (done) return;
        done = true;
        signal.removeEventListener("abort", onAbort);
        resolve(value());
      };
      const onAbort = () => finish(() => null);
      signal.addEventListener("abort", onAbort);
      node.onaudioprocess = (e) => {
        if (done) return;
        const frame = new Float32Array(e.inputBuffer.getChannelData(0));
        const level = rms(frame);
        onLevel?.(level);
        chunks.push(frame);
        const r = gateStep(gate, level, frameMs);
        gate = r.s;
        if (r.verdict === "nothing") finish(() => null);
        else if (r.verdict === "stop") {
          finish(() => {
            const all = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
            let at = 0;
            for (const c of chunks) { all.set(c, at); at += c.length; }
            return encodeWav(downsample(all, ctx.sampleRate));
          });
        }
      };
      source.connect(node);
      node.connect(ctx.destination); // some browsers only run the processor when connected
    });
  } finally {
    cleanup();
  }
}
