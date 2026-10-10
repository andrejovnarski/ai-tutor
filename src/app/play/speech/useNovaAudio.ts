"use client";
// Plays Nova's lines through one reused <audio> element, driven by the pure audio machine.
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { LineSpeech } from "../../../server/speech/lineSpeech";
import { audioReducer, initialAudioState, type AudioEvent, type AudioState } from "./audioMachine";

export type NovaAudio = {
  /** New lines replace whatever is playing or queued. */
  lines: (lines: Array<LineSpeech | undefined>) => void;
  /** Tap on Nova: the line again (ignored while the mic is open). */
  replay: () => void;
  /** The mic opened (stop Nova, hold new lines) or closed (play what is held). */
  mic: (on: boolean) => void;
};

/**
 * A clip URL when the line has one, else a blob URL from POST /speak (revoked when the line ends or is replaced).
 * If a clip fails, /speak is tried once; any other failure skips to the next line, silently (the text is on screen).
 * The machine's ended/failed events carry no token, so every play gets an id and events from an older play are
 * ignored: a late `ended` can never skip the line that replaced it.
 */
export function useNovaAudio(kidId: string, enabled: boolean): NovaAudio {
  const state = useRef<AudioState>(initialAudioState);
  const el = useRef<HTMLAudioElement | null>(null);
  const playId = useRef(0);
  const blob = useRef<string | null>(null);
  const fetching = useRef<AbortController | null>(null);
  const last = useRef<LineSpeech | undefined>(undefined); // the last line started, for replay
  const live = useRef(true);

  const release = useCallback(() => {
    fetching.current?.abort();
    fetching.current = null;
    const a = el.current;
    if (a) {
      a.onended = null;
      a.onerror = null;
      a.pause();
      a.removeAttribute("src");
    }
    if (blob.current) {
      URL.revokeObjectURL(blob.current);
      blob.current = null;
    }
  }, []);

  const send = useRef<(ev: AudioEvent) => void>(() => {});

  const play = useCallback((line: LineSpeech) => {
    const id = ++playId.current;
    release();
    last.current = line;
    const a = (el.current ??= new Audio());
    const failed = () => { if (id === playId.current) send.current({ type: "failed" }); };
    const start = (src: string, onError: () => void) => {
      if (id !== playId.current) return;
      a.onended = () => { if (id === playId.current) send.current({ type: "ended" }); };
      a.onerror = () => { if (id === playId.current) onError(); };
      a.src = src;
      a.play().catch((e: unknown) => {
        // An AbortError means a newer src or pause() interrupted this play; that newer play owns the element.
        if ((e as { name?: string } | null)?.name !== "AbortError" && id === playId.current) onError();
      });
    };
    const speak = async () => {
      const ctrl = new AbortController();
      fetching.current = ctrl;
      try {
        const r = await fetch(`/api/kids/${kidId}/speak`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: line.text, token: line.token }), signal: ctrl.signal,
        });
        if (!r.ok) throw new Error("speak");
        const b = await r.blob();
        if (id !== playId.current || !live.current) return;
        blob.current = URL.createObjectURL(b);
        start(blob.current, failed);
      } catch {
        failed();
      } finally {
        if (fetching.current === ctrl) fetching.current = null;
      }
    };
    if (line.clip) start(line.clip, () => void speak());
    else void speak();
  }, [kidId, release]);

  send.current = (ev: AudioEvent) => {
    if (!enabled || !live.current) return;
    const prev = state.current;
    if (ev.type === "mic" && ev.on === prev.listening) return; // a repeated "off" would skip the queued line
    const next = audioReducer(prev, ev);
    state.current = next;
    if (next === prev) return;
    playId.current++; // whatever was playing is over
    if (next.current) play(next.current);
    else release();
  };

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      playId.current++;
      release();
      el.current = null;
    };
  }, [release]);

  return useMemo<NovaAudio>(() => ({
    lines: (ls) => send.current({ type: "lines", lines: ls.filter((l): l is LineSpeech => !!l) }),
    replay: () => {
      const line = state.current.current ?? last.current;
      if (line) send.current({ type: "replay", line });
    },
    mic: (on) => send.current({ type: "mic", on }),
  }), []);
}
