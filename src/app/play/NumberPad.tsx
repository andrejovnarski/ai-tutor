"use client";

import { useState } from "react";
import { padReducer, type PadKey } from "./numberPad";
import styles from "./play.module.css";

const KEYS: PadKey[] = ["1", "2", "3", "4", "5", "del", "6", "7", "8", "9", "0", "ok"];

export function NumberPad({ locked, onAnswer }: { locked: boolean; onAnswer: (given: number) => void }) {
  const [entry, setEntry] = useState("");

  function press(key: PadKey) {
    if (locked) return;
    const r = padReducer(entry, key);
    setEntry(r.entry);
    if (r.submit !== undefined) onAnswer(r.submit);
  }

  return (
    <div className={styles.padWrap} data-testid="number-pad">
      <div className={styles.entry} aria-live="polite" aria-label="Your answer">
        {entry}
      </div>
      <div className={styles.keys}>
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            data-key={k}
            className={styles.key}
            aria-label={k === "del" ? "Delete" : undefined}
            disabled={locked || (k === "ok" && entry === "")}
            onClick={() => press(k)}
          >
            {k === "del" ? "⌫" : k === "ok" ? "OK" : k}
          </button>
        ))}
      </div>
    </div>
  );
}
