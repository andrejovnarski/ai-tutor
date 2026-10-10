// Browser-only mic capture. Not unit-tested; the pure parts live in wav.ts and silence.ts.
import { RECORD_BACKSTOP_MS, gateStep, rms, type GateState } from "./silence";
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

/** How long to wait for a suspended context to resume before going on anyway (the backstop then bounds the rest). */
const RESUME_WAIT_MS = 1000;

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
    // The permission prompt can stay open; an abort must not wait for it. A stream granted after the abort is
    // stopped as soon as it arrives.
    const asked = navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    const got = await untilAbort(asked, signal);
    if (got === ABORTED) {
      asked.then((s) => s.getTracks().forEach((t) => t.stop()), () => {});
      return null;
    }
    stream = got;
    const s = got;
    // From here the mic is live. The abort is armed before anything else can wait, and resume() (which an iOS
    // "interrupted" context can leave pending for ever) gets at most RESUME_WAIT_MS; the backstop bounds the rest.
    return await new Promise<Uint8Array | null>((resolve) => {
      const chunks: Float32Array[] = [];
      let gate: GateState = { ms: 0, speechMs: 0, quietMs: 0, started: false };
      let done = false;
      let backstop: ReturnType<typeof setTimeout> | undefined;
      let resumeWait: ReturnType<typeof setTimeout> | undefined;
      const finish = (value: () => Uint8Array | null) => {
        if (done) return;
        done = true;
        clearTimeout(backstop);
        clearTimeout(resumeWait);
        signal.removeEventListener("abort", onAbort);
        resolve(value());
      };
      const onAbort = () => finish(() => null);
      signal.addEventListener("abort", onAbort);
      if (signal.aborted) return onAbort();

      const begin = () => {
        if (done || source) return;
        clearTimeout(resumeWait);
        // If audio callbacks never fire (suspended or interrupted context), give up rather than hold the mic.
        backstop = setTimeout(() => finish(() => null), RECORD_BACKSTOP_MS);
        // ScriptProcessorNode, not an AudioWorklet: no extra module file to serve, works on older iPads.
        source = ctx.createMediaStreamSource(s);
        node = ctx.createScriptProcessor(BUFFER, 1, 1);
        const frameMs = (BUFFER / ctx.sampleRate) * 1000;
        node.onaudioprocess = (e) => {
          if (done) return;
          const frame = new Float32Array(e.inputBuffer.getChannelData(0));
          const level = rms(frame);
          try { onLevel?.(level); } catch {}
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
      };
      if (ctx.state === "running") begin();
      else {
        resumeWait = setTimeout(begin, RESUME_WAIT_MS);
        ctx.resume().then(begin, begin);
      }
    });
  } finally {
    cleanup();
  }
}

const ABORTED = Symbol("aborted");

/** `p`, or ABORTED as soon as `signal` aborts (whichever comes first). */
function untilAbort<T>(p: Promise<T>, signal: AbortSignal): Promise<T | typeof ABORTED> {
  if (signal.aborted) return Promise.resolve(ABORTED);
  return new Promise((resolve, reject) => {
    const onAbort = () => resolve(ABORTED);
    signal.addEventListener("abort", onAbort, { once: true });
    p.then(
      (v) => { signal.removeEventListener("abort", onAbort); resolve(v); },
      (e) => { signal.removeEventListener("abort", onAbort); reject(e); },
    );
  });
}
