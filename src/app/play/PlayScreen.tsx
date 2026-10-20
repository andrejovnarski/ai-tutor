"use client";
// The kid play screen: Nova and the line bubble on top, the felt board with the problem's picture, the answer tray.
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { AgeBand } from "@/domain/types";
import { AnswerTray } from "./AnswerTray";
import { Board } from "./Board";
import { bubbleView, wantsHold } from "./bubble";
import { ConnectionNotice } from "./ConnectionNotice";
import { EndCard } from "./EndCard";
import { LineBubble } from "./LineBubble";
import { Nova } from "./Nova";
import { usePlay } from "./usePlay";
import styles from "./play.module.css";
import { MicStrip } from "./speech/ConfirmHeard";
import { Mic } from "./speech/MicButton";
import { useMic, type Cues } from "./speech/useMic";
import { useNovaAudio } from "./speech/useNovaAudio";

/** How long a correct answer's feedback line stays in the bubble before the next problem's line replaces it. */
export const FEEDBACK_HOLD_MS = 1200;

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(REDUCED);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const useReducedMotion = () => useSyncExternalStore(subscribe, () => window.matchMedia(REDUCED).matches, () => false);

type Props = {
  kidId: string;
  ageBand: AgeBand;
  /** Speech on (SPEECH=azure|fake, fully configured): the mic shows and Nova's lines are voiced. Off is Plan 5a. */
  speech?: boolean;
  /** Voiced copies of the mic notices. */
  cues?: Cues;
};

export function PlayScreen({ kidId, ageBand, speech = false, cues }: Props) {
  const { state, answer, help, retry, say, playAgain } = usePlay(kidId);
  const reduced = useReducedMotion();
  const problem = state.turn?.kind === "problem" ? state.turn : undefined;

  const audio = useNovaAudio(kidId, speech);
  const voice = useMic({
    kidId,
    version: speech && problem ? state.version : undefined,
    onAnswer: (n) => void answer(n),
    onSay: (text) => void say(text),
    onSpeak: (line) => audio.lines([line]),
    onOpen: audio.mic,
    cues,
  });

  // New lines (a load, an answer, a 409) are voiced in order: the feedback line, then the problem's line. A reply to
  // something said (same line, new message) is voiced alone.
  const voiced = useRef<{ line?: unknown; message?: unknown }>({});
  useEffect(() => {
    if (!speech) return;
    const was = voiced.current;
    voiced.current = { line: state.line, message: state.messageSpeech };
    if (state.line !== was.line) audio.lines([state.messageSpeech, state.line?.speech]);
    else if (state.messageSpeech && state.messageSpeech !== was.message) audio.lines([state.messageSpeech]);
  }, [speech, state.line, state.messageSpeech, audio]);

  // A correct answer that moved on: the feedback line for 1.2 s, then the next problem's line (the new problem is on
  // the board at once). Anything else keeps both lines on screen (see bubbleView).
  const holdKey = wantsHold(state, reduced) ? `${state.version}:${state.message}` : null;
  const [heldDone, setHeldDone] = useState<string | null>(null);
  const view = bubbleView(state, { reduced, holdDone: holdKey === null || heldDone === holdKey });
  useEffect(() => {
    if (!view.holding) return;
    const t = setTimeout(() => setHeldDone(holdKey), FEEDBACK_HOLD_MS);
    return () => clearTimeout(t);
  }, [view.holding, holdKey]);

  // 401/404 after load (session expired, kid removed): go home; requireUser sends a signed-out visitor to sign-in.
  useEffect(() => {
    if (state.phase === "gone") window.location.replace("/");
  }, [state.phase]);

  // The tray is remounted per problem. If focus was in the tray (keyboard or switch user), put it on the first
  // button of the new problem. Help restores its own focus, falling back to the tray when Help disappears.
  const tray = useRef<HTMLElement>(null);
  const trayFocus = useRef(false);
  const helpButton = useRef<HTMLButtonElement>(null);
  const helpFocus = useRef(false);
  useEffect(() => {
    const down = (e: PointerEvent) => { if (!tray.current?.contains(e.target as Node)) trayFocus.current = false; };
    document.addEventListener("pointerdown", down);
    return () => document.removeEventListener("pointerdown", down);
  }, []);
  useEffect(() => {
    const el = tray.current;
    if (state.phase !== "problem") return;
    if (helpFocus.current) {
      helpFocus.current = false;
      const target = helpButton.current ?? el?.querySelector<HTMLButtonElement>("button:not(:disabled)");
      target?.focus();
      return;
    }
    if (!trayFocus.current || !el || el.contains(document.activeElement)) return;
    el.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [state.phase, state.version]);

  const ended = state.phase === "ended" && state.summary;
  const notice = state.phase === "retrying" || state.phase === "offline"
    ? <ConnectionNotice offline={state.phase === "offline"} answering={state.request === "answer"} onRetry={retry} />
    : null;

  return (
    <main className={styles.screen} data-version={state.version} data-phase={state.phase}
      // iOS: the first tap or key anywhere (a tile, the mic, Nova) unlocks Nova's audio element, synchronously. Touch
      // pointerdown doesn't count as a user activation, so pointerup, click and keydown are used.
      {...(speech ? { onPointerUpCapture: audio.unlock, onClickCapture: audio.unlock, onKeyDownCapture: audio.unlock } : {})}
      {...(view.holding ? { "data-hold": "true" } : {})}>
      <header className={styles.top}>
        {/* keyed by version on a correct answer so the hop plays once per answer */}
        {speech ? (
          <button type="button" className={styles.novaButton} aria-label="Hear Nova again" onClick={audio.replay}>
            <Nova key={view.hop ? `hop-${state.version}` : "nova"} tone={view.tone} hop={view.hop} />
          </button>
        ) : (
          <Nova key={view.hop ? `hop-${state.version}` : "nova"} tone={view.tone} hop={view.hop} />
        )}
        {view.say ? (
          <LineBubble say={view.say} lead={view.lead} note={view.note} tone={view.tone} ageBand={ageBand} />
        ) : (
          <div className={styles.bubbleSpace} />
        )}
        <div className={styles.topActions}>
          {problem && problem.help < 2 ? (
            <button ref={helpButton} type="button" className={styles.helpButton} data-testid="help" disabled={state.phase !== "problem"}
              onClick={() => {
                helpFocus.current = document.activeElement === helpButton.current;
                if (speech) voice.cancel();
                void help();
              }}>Help me</button>
          ) : null}
          {/* the end card has its own Back to kids */}
          {ended ? null : <Link href="/" className={styles.done}>I&apos;m done for now</Link>}
        </div>
      </header>
      {ended ? (
        <div className={styles.endArea}>
          <EndCard summary={state.summary!} rewards={state.rewards} onPlayAgain={playAgain} />
        </div>
      ) : (
        <>
          <section className={styles.board} data-testid="board" aria-label="Felt board">
            {problem ? <Board problem={problem} /> : null}
            {speech && problem ? <MicStrip mic={voice.mic} onYes={voice.yes} onNo={voice.no} /> : null}
            {notice}
          </section>
          <section
            ref={tray}
            className={styles.tray}
            data-testid="tray"
            aria-label="Answers"
            onFocus={() => { trayFocus.current = true; }}
            // A tile or pad key tapped while the mic listens: the tap wins (the recording or /listen is dropped).
            onClickCapture={(e) => {
              const t = e.target as Element;
              if (speech && t.closest("button") && !t.closest("[data-mic]")) voice.cancel();
            }}
            onBlur={(e) => {
              const to = e.relatedTarget as Node | null;
              if (to && !e.currentTarget.contains(to)) trayFocus.current = false;
            }}
          >
            {problem ? (
              <AnswerTray
                key={state.version}
                input={problem.input}
                choices={problem.choices}
                locked={state.phase !== "problem"}
                onAnswer={(n) => void answer(n)}
                mic={speech && !voice.mic.hidden ? (
                  <Mic speech mic={voice.mic} locked={state.phase !== "problem"} onTap={voice.start} />
                ) : undefined}
              />
            ) : null}
          </section>
        </>
      )}
    </main>
  );
}
