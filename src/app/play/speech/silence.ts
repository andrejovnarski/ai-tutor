// Pure silence gate: decides when a recording has started, finished or never began.

const SPEECH_RMS = 0.02;
const SPEECH_START_MS = 100;
const QUIET_STOP_MS = 1000;
const MAX_MS = 6000;

export type GateState = { ms: number; speechMs: number; quietMs: number; started: boolean };

export function rms(frame: Float32Array): number {
  if (frame.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < frame.length; i++) { const x = frame[i] ?? 0; sum += x * x; }
  return Math.sqrt(sum / frame.length);
}

/** "go" keeps recording; "stop" means send it; "nothing" means speech never started. */
export function gateStep(
  s: GateState,
  frameRms: number,
  frameMs: number,
): { s: GateState; verdict: "go" | "stop" | "nothing" } {
  const loud = frameRms >= SPEECH_RMS;
  const ms = s.ms + frameMs;
  let { speechMs, quietMs, started } = s;
  if (!started) {
    speechMs = loud ? speechMs + frameMs : 0;
    if (speechMs >= SPEECH_START_MS) started = true;
  } else {
    quietMs = loud ? 0 : quietMs + frameMs;
  }
  const next = { ms, speechMs, quietMs, started };
  if (started && quietMs >= QUIET_STOP_MS) return { s: next, verdict: "stop" };
  if (ms >= MAX_MS) return { s: next, verdict: started ? "stop" : "nothing" };
  return { s: next, verdict: "go" };
}
