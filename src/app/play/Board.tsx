import type { PublicTurn } from "@/server/publicTurn";
import { Visual } from "./visuals/Visual";
import styles from "./play.module.css";

type Problem = Extract<PublicTurn, { kind: "problem" }>;

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
