// Pure Nova-audio state machine. Framework-free: no React, no timers, no fetch.
import type { LineSpeech } from "../../../server/speech/lineSpeech";

export type LineKey = string;
export type AudioState = {
  /** Token of the line now playing. */
  playing?: LineKey;
  /** The line now playing (kept so nowPlaying needs no lookup). */
  current?: LineSpeech;
  queue: LineSpeech[];
  /** Mic is open: nothing plays, new lines wait in the queue. */
  listening: boolean;
};

export type AudioEvent =
  | { type: "lines"; lines: LineSpeech[] }
  | { type: "ended" }
  | { type: "replay"; line: LineSpeech }
  | { type: "mic"; on: boolean }
  | { type: "failed" };

export const initialAudioState: AudioState = { queue: [], listening: false };

const advance = (s: AudioState): AudioState => {
  const [next, ...rest] = s.queue;
  return next ? { ...s, playing: next.token, current: next, queue: rest } : { ...s, playing: undefined, current: undefined, queue: [] };
};

export function audioReducer(s: AudioState, ev: AudioEvent): AudioState {
  switch (ev.type) {
    case "lines": {
      const stopped = { ...s, playing: undefined, current: undefined, queue: ev.lines };
      return s.listening ? stopped : advance(stopped);
    }
    case "ended":
    case "failed":
      return s.listening ? s : advance(s);
    case "replay":
      return s.listening ? s : advance({ ...s, playing: undefined, current: undefined, queue: [ev.line, ...s.queue] });
    case "mic":
      if (ev.on) return { ...s, listening: true, playing: undefined, current: undefined };
      return advance({ ...s, listening: false });
  }
}

export const nowPlaying = (s: AudioState): LineSpeech | undefined => s.current;
