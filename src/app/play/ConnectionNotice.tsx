import styles from "./play.module.css";

/** Retrying: a quiet note while the answer (or the turn) is re-sent; the "answer is saved" promise only for an answer.
 * Offline: the retries ran out; Try again reloads the turn. */
export function ConnectionNotice({ offline, answering, onRetry }: { offline: boolean; answering: boolean; onRetry: () => void }) {
  return (
    <div className={styles.notice} role={offline ? "alert" : "status"} data-testid="connection-notice">
      {offline ? (
        <>
          <span>Nova can&apos;t connect right now.</span>
          <button type="button" className={styles.noticeButton} onClick={onRetry}>Try again</button>
        </>
      ) : (
        <span>{answering ? "Trying to reach Nova… your answer is saved when it gets through." : "Trying to reach Nova…"}</span>
      )}
    </div>
  );
}
