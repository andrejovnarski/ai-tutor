import styles from "./play.module.css";

/** Retrying: a quiet note while the answer (or the turn) is re-sent. Offline: the retries ran out; Try again reloads the turn. */
export function ConnectionNotice({ offline, onRetry }: { offline: boolean; onRetry: () => void }) {
  return (
    <div className={styles.notice} role={offline ? "alert" : "status"} data-testid="connection-notice">
      {offline ? (
        <>
          <span>Nova can&apos;t connect right now.</span>
          <button type="button" className={styles.noticeButton} onClick={onRetry}>Try again</button>
        </>
      ) : (
        <span>Trying to reach Nova… your answer is saved when it gets through.</span>
      )}
    </div>
  );
}
