import styles from "./play.module.css";

export type NovaTone = "cheer" | "calm" | "curious";

// Eye paths in a 120x120 box. Left eye centred near x=44, right near x=76.
const EYES: Record<NovaTone, { l: string; r: string }> = {
  // happy arcs
  cheer: { l: "M34 56 Q44 44 54 56", r: "M66 56 Q76 44 86 56" },
  // round dots
  calm: { l: "M39 54 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0", r: "M71 54 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0" },
  // one raised, wider eye
  curious: { l: "M36 52 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0", r: "M70 58 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0" },
};

export function Nova({ tone, hop }: { tone: NovaTone; hop?: boolean }) {
  const eye = EYES[tone];
  return (
    <svg
      role="img"
      aria-label="Nova"
      viewBox="0 0 120 120"
      className={[styles.nova, hop ? styles.hop : ""].join(" ").trim()}
      {...(hop ? { "data-hop": "true" } : {})}
    >
      <line x1="60" y1="14" x2="60" y2="28" stroke="var(--chalk)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="60" cy="10" r="6" fill="var(--counter-yellow)" className={hop ? styles.blink : undefined} />
      <ellipse cx="60" cy="72" rx="44" ry="42" fill="var(--tray)" stroke="var(--felt-deep)" strokeWidth="4" />
      <rect x="26" y="38" width="68" height="38" rx="16" fill="var(--ink)" />
      <path data-eye="l" d={eye.l} fill={tone === "cheer" ? "none" : "var(--chalk)"} stroke="var(--chalk)" strokeWidth="5" strokeLinecap="round" />
      <path data-eye="r" d={eye.r} fill={tone === "cheer" ? "none" : "var(--chalk)"} stroke="var(--chalk)" strokeWidth="5" strokeLinecap="round" />
      <circle cx="60" cy="96" r="5" fill="var(--cube-blue)" />
    </svg>
  );
}
