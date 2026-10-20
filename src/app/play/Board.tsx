import type { PublicTurn } from "@/server/publicTurn";
import { Visual } from "./visuals/Visual";
import styles from "./play.module.css";

type Problem = Extract<PublicTurn, { kind: "problem" }>;
export type BoardKey = { key: number; version: number; try: 1 | 2; help: 0 | 1 | 2 };

/** Board's React key: a new problem or a new try starts a fresh board (a fill frame's added counters reset);
 * Help 2 on the same try keeps it, so the child's counters stay while Nova shows how. */
export function nextBoardKey(prev: BoardKey | null, version: number, p: Pick<Problem, "try" | "help">): BoardKey {
  if (prev?.version === version) return prev;
  const keep = prev !== null && p.try === prev.try && p.help === 2 && prev.help !== 2;
  return { key: keep ? prev.key : version, version, try: p.try, help: p.help };
}

/** The problem's picture and its prompt. A word problem's story picture already prints the sentence, so the h1
 * then stays for screen readers (and tests) only, rather than printing the same words twice. */
export function Board({ problem, locked }: { problem: Problem; locked?: boolean }) {
  const { say, show } = problem.prompt;
  const printed = show.kind === "story" && show.text.trim() === say.trim();
  return (
    <>
      <div className={styles.picture}><Visual v={show} locked={locked} /></div>
      <h1 className={printed ? `${styles.prompt} ${styles.srOnly}` : styles.prompt} data-testid="say">{say}</h1>
    </>
  );
}
