import type { CSSProperties } from "react";
import styles from "./rewards.module.css";

// The newly earned cubes drop in one after another, the whole run inside about a second (see .drop in the CSS).
const RUN_MS = 640;
const STEP_MS = 160;

/** A rod of maths cubes: `filled` of `total` cubes in cube blue. Cubes from `animateFrom` up to `filled` drop in. */
export function Rod({ filled, total = 10, animateFrom, size }: {
  filled: number;
  total?: number;
  animateFrom?: number;
  size: "s" | "m";
}) {
  const n = Math.max(0, Math.min(total, Math.floor(filled)));
  const from = animateFrom == null ? n : Math.max(0, Math.min(n, Math.floor(animateFrom)));
  const dropping = n - from;
  const step = dropping > 1 ? Math.min(STEP_MS, RUN_MS / (dropping - 1)) : 0;
  return (
    <span className={`${styles.rod} ${size === "s" ? styles.rodS : styles.rodM}`} role="img" aria-label={`${n} of ${total} cubes`}>
      {Array.from({ length: total }, (_, i) => {
        const drop = i >= from && i < n;
        return (
          <span
            key={i}
            className={`${styles.cube}${i < n ? ` ${styles.cubeFilled}` : ""}${drop ? ` ${styles.drop}` : ""}`}
            data-cube={i < n ? "filled" : "empty"}
            {...(drop ? { "data-drop": "true", style: { "--drop-delay": `${Math.round((i - from) * step)}ms` } as CSSProperties } : {})}
          />
        );
      })}
    </span>
  );
}
