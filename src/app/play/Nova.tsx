import styles from "./play.module.css";

export type NovaTone = "cheer" | "calm" | "curious";

const EYES: Record<NovaTone, { l: string; r: string }> = {
  cheer: { l: "M27 40 Q31 35 35 40", r: "M45 40 Q49 35 53 40" },
  calm: { l: "M27.5 40 a3.5 3.5 0 1 0 7 0 a3.5 3.5 0 1 0 -7 0", r: "M45.5 40 a3.5 3.5 0 1 0 7 0 a3.5 3.5 0 1 0 -7 0" },
  curious: { l: "M25.5 40 a5.5 5.5 0 1 0 11 0 a5.5 5.5 0 1 0 -11 0", r: "M46 41 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0" },
};
const MOUTHS = { cheer: "M32 50 Q40 57 48 50", calm: "M34 51 Q40 54 46 51", curious: "M37 52 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0" };

export function Nova({ tone, hop, burst }: { tone: NovaTone; hop?: boolean; burst?: boolean }) {
  const eye = EYES[tone];
  const ringClass = [styles.ring, burst ? styles.ringSpin : hop ? styles.ringTip : ""].join(" ");
  return (
    <svg role="img" aria-label="Nova" viewBox="0 0 80 80"
      className={[styles.nova, hop ? styles.hop : ""].join(" ").trim()}
      {...(hop ? { "data-hop": "true" } : {})} {...(burst ? { "data-burst": "true" } : {})}>
      <path className={ringClass} d="M8 50 A34 9 -12 0 0 72 36" fill="none" stroke="var(--pp-sun)" strokeWidth="6" strokeLinecap="round" />
      <circle cx="40" cy="42" r="26" fill="var(--pp-nova)" stroke="var(--pp-ink)" strokeWidth="3" />
      <circle cx="30" cy="30" r="4" fill="#9d93f5" />
      <path data-eye="l" d={eye.l} fill={tone === "cheer" ? "none" : tone === "curious" ? "var(--pp-white)" : "var(--pp-ink)"} stroke="var(--pp-ink)" strokeWidth={tone === "curious" ? 2.5 : tone === "cheer" ? 3 : 0} strokeLinecap="round" />
      {tone === "curious" ? <circle cx="31" cy="40" r="2.2" fill="var(--pp-ink)" /> : null}
      <path data-eye="r" d={eye.r} fill={tone === "cheer" ? "none" : "var(--pp-ink)"} stroke="var(--pp-ink)" strokeWidth={tone === "cheer" ? 3 : 0} strokeLinecap="round" />
      <path d={MOUTHS[tone]} fill="none" stroke="var(--pp-ink)" strokeWidth="3" strokeLinecap="round" />
      <path className={ringClass} d="M8 50 A34 9 -12 0 1 72 36" fill="none" stroke="var(--pp-sun)" strokeWidth="6" strokeLinecap="round" strokeDasharray="0 70 200" />
      {burst ? <g className={styles.stars} aria-hidden="true" fill="var(--pp-sun)" stroke="var(--pp-ink)" strokeWidth="1">
        {[[8, 15], [66, 10], [73, 61], [12, 68]].map(([x, y]) => <path key={x} data-star="true" transform={`translate(${x} ${y})`} d="M0 -5 L1.5 -1.5 L5 0 L1.5 1.5 L0 5 L-1.5 1.5 L-5 0 L-1.5 -1.5 Z" />)}
      </g> : null}
    </svg>
  );
}
