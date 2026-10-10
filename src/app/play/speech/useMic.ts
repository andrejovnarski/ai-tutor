"use client";
// The mic on the play screen: record one utterance, POST it to /listen, and act on the route via the pure mic machine.
import { useCallback, useEffect, useRef, useState } from "react";
import type { HeardRoute } from "../../../domain/checker/heard";
import type { LineSpeech } from "../../../server/speech/lineSpeech";
import { micEffect, micReducer, type MicEvent, type MicState } from "./micMachine";
import { startRecording } from "./recorder";

export type Cues = Record<"tryAgain" | "notCaught" | "cantHear", LineSpeech>;

const CUE_FOR: Record<string, keyof Cues> = {
  "Let's try again.": "tryAgain",
  "I didn't catch that. Try again or tap your answer.": "notCaught",
  "I couldn't hear. Tap your answer.": "cantHear",
};

type Deps = {
  kidId: string;
  /** The problem on screen; undefined when there is none. A new version drops whatever the mic was doing. */
  version: number | undefined;
  onAnswer: (n: number) => void;
  onSay: (text: string) => void;
  /** Lines for Nova to voice: a notice's cue, or the confirm question. */
  onSpeak: (line: LineSpeech) => void;
  /** The mic opened or closed (Nova stops while it is open). */
  onOpen: (open: boolean) => void;
  cues?: Cues;
};

const initialMic: MicState = { phase: "idle", failures: 0, hidden: false };

/** Mic permission refused or no mic (or no Web Audio at all): hide the mic for the page's life. */
const isDenied = (e: unknown) => {
  const name = (e as { name?: string } | null)?.name;
  return name === "NotAllowedError" || name === "NotFoundError" || name === "SecurityError" || e instanceof TypeError;
};

export function useMic(deps: Deps) {
  const [mic, setMic] = useState<MicState>(initialMic);
  const ref = useRef<MicState>(initialMic);
  const d = useRef(deps);
  d.current = deps;
  const ctrl = useRef<AbortController | null>(null);

  /** One transition: the next state is computed here once, so its effect is acted on exactly once. */
  const go = useCallback((ev: MicEvent) => {
    const prev = ref.current;
    const next = micReducer(prev, ev);
    if (next === prev) return;
    ref.current = next;
    setMic(next);
    const open = (s: MicState) => s.phase === "listening" || s.phase === "thinking";
    if (open(prev) !== open(next)) d.current.onOpen(open(next));
    if (next.notice && next.notice !== prev.notice) {
      const cue = d.current.cues?.[CUE_FOR[next.notice]!];
      if (cue) d.current.onSpeak(cue);
    }
    const eff = micEffect(prev, next);
    if (eff?.answer !== undefined) d.current.onAnswer(eff.answer);
    else if (eff?.say !== undefined) d.current.onSay(eff.say);
  }, []);

  /** Stops the recording and any /listen in flight. */
  const stop = useCallback(() => {
    ctrl.current?.abort();
    ctrl.current = null;
  }, []);

  // A new problem (a tile, a voice answer, a 409): drop the recording or the request and reset the mic.
  useEffect(() => {
    if (deps.version === undefined) return;
    if (ref.current.version !== undefined && ref.current.version !== deps.version) stop();
    go({ type: "problem", version: deps.version });
  }, [deps.version, go, stop]);

  // Leaving the screen: nothing is recorded or sent afterwards.
  useEffect(() => stop, [stop]);

  /** Call straight from the click handler: Safari only grants the mic when it is asked for inside the tap. */
  const start = useCallback(() => {
    const v = d.current.version;
    const s = ref.current;
    if (v === undefined || s.hidden || s.phase !== "idle") return;
    stop();
    const c = new AbortController();
    ctrl.current = c;
    let recording: Promise<Uint8Array | null>;
    try {
      recording = startRecording({ signal: c.signal });
    } catch (e) {
      go({ type: "start", version: v });
      go(isDenied(e) ? { type: "denied" } : { type: "failed" });
      return;
    }
    go({ type: "start", version: v });
    const current = () => ctrl.current === c && !c.signal.aborted;
    void (async () => {
      let wav: Uint8Array | null;
      try {
        wav = await recording;
      } catch (e) {
        if (current()) go(isDenied(e) ? { type: "denied" } : { type: "failed" });
        return;
      }
      if (!current()) return;
      if (!wav) return go({ type: "nothing" });
      go({ type: "sent" });
      let body: { heard?: unknown; route?: HeardRoute; speech?: LineSpeech };
      try {
        const r = await fetch(`/api/kids/${d.current.kidId}/listen`, {
          method: "POST", headers: { "content-type": "audio/wav" }, body: wav as BodyInit, signal: c.signal,
        });
        if (!r.ok) throw new Error("listen");
        body = await r.json();
      } catch {
        if (current()) go({ type: "failed" });
        return;
      }
      if (!current()) return;
      ctrl.current = null;
      if (!body.route || typeof body.heard !== "string") return go({ type: "failed" });
      go({ type: "result", version: v, heard: body.heard, route: body.route });
      // A kid who can't read yet still hears "Did you say 12?".
      if (ref.current.phase === "confirm" && body.speech) d.current.onSpeak(body.speech);
    })();
  }, [go, stop]);

  /** A tile or pad key was tapped: the tap wins, and the recording or /listen is dropped. */
  const cancel = useCallback(() => {
    if (ref.current.phase === "idle") return; // keep any notice; nothing to stop
    stop();
    go({ type: "cancel" });
  }, [go, stop]);

  const yes = useCallback(() => go({ type: "yes" }), [go]);
  const no = useCallback(() => go({ type: "no" }), [go]);

  return { mic, start, cancel, yes, no };
}
