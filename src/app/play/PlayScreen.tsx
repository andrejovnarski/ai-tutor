"use client";
// The kid play screen: Nova and the line bubble on top, the felt board with the problem's picture, the answer tray.
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { AgeBand } from "@/domain/types";
import { AnswerTray } from "./AnswerTray";
import { ConnectionNotice } from "./ConnectionNotice";
import { EndCard } from "./EndCard";
import { LineBubble } from "./LineBubble";
import { Nova } from "./Nova";
import { usePlay } from "./usePlay";
import { Visual } from "./visuals/Visual";
import styles from "./play.module.css";

/** How long the feedback line stays in the bubble before the next problem's line replaces it. */
export const FEEDBACK_HOLD_MS = 1200;

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(REDUCED);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const useReducedMotion = () => useSyncExternalStore(subscribe, () => window.matchMedia(REDUCED).matches, () => false);

export function PlayScreen({ kidId, ageBand }: { kidId: string; ageBand: AgeBand }) {
  const { state, answer, retry } = usePlay(kidId);
  const reduced = useReducedMotion();

  // After an answer that moved on, the bubble shows the feedback line for 1.2 s, then the next problem's line. The
  // new problem is on the board at once. With reduced motion nothing swaps on a timer: both lines show together.
  const holdKey = state.message ? `${state.version}:${state.message}` : null;
  const [heldDone, setHeldDone] = useState<string | null>(null);
  const holding = !reduced && holdKey !== null && heldDone !== holdKey;
  useEffect(() => {
    if (!holding) return;
    const t = setTimeout(() => setHeldDone(holdKey), FEEDBACK_HOLD_MS);
    return () => clearTimeout(t);
  }, [holding, holdKey]);

  const problem = state.turn?.kind === "problem" ? state.turn : undefined;
  const ended = state.phase === "ended" && state.summary;
  const say = holding ? state.message : state.line?.say;
  const tone = ended || (holding && state.correct) ? "cheer" : (state.line?.tone ?? "calm");
  const hop = !!state.correct && !reduced;
  const notice = state.phase === "retrying" || state.phase === "offline"
    ? <ConnectionNotice offline={state.phase === "offline"} onRetry={retry} />
    : null;

  return (
    <main className={styles.screen} data-version={state.version} data-phase={state.phase}>
      <header className={styles.top}>
        {/* keyed by version on a correct answer so the hop plays once per answer */}
        <Nova key={hop ? `hop-${state.version}` : "nova"} tone={tone} hop={hop} />
        {say ? (
          <LineBubble
            say={say}
            lead={reduced && state.message ? state.message : undefined}
            note={state.note ?? undefined}
            tone={tone}
            ageBand={ageBand}
          />
        ) : (
          <div className={styles.bubbleSpace} />
        )}
        {/* the end card has its own Back to kids */}
        {ended ? null : <Link href="/" className={styles.done}>I&apos;m done for now</Link>}
      </header>
      {ended ? (
        <div className={styles.endArea}>
          <EndCard summary={state.summary!} onPlayAgain={retry} />
        </div>
      ) : (
        <>
          <section className={styles.board} data-testid="board" aria-label="Felt board">
            {problem ? (
              <>
                <div className={styles.picture}><Visual v={problem.prompt.show} /></div>
                <h1 className={styles.prompt} data-testid="say">{problem.prompt.say}</h1>
              </>
            ) : null}
            {notice}
          </section>
          <section className={styles.tray} data-testid="tray" aria-label="Answers">
            {problem ? (
              <AnswerTray
                key={state.version}
                input={problem.input}
                choices={problem.choices}
                locked={state.phase !== "problem"}
                onAnswer={(n) => void answer(n)}
              />
            ) : null}
          </section>
        </>
      )}
    </main>
  );
}
