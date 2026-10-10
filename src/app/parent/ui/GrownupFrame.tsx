import Link from "next/link";
import type { ReactNode } from "react";
import { atkinson } from "./fonts";
import styles from "./grownup.module.css";

function NovaMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 120 120" className={className}>
      <line x1="60" y1="14" x2="60" y2="28" strokeWidth="4" strokeLinecap="round" className={styles.novaAntenna} />
      <circle cx="60" cy="10" r="6" fill="var(--sticky)" />
      <ellipse cx="60" cy="72" rx="44" ry="42" fill="var(--chalk)" stroke="var(--felt-deep)" strokeWidth="4" />
      <rect x="26" y="38" width="68" height="38" rx="16" fill="var(--ink)" />
      <path d="M34 56 Q44 44 54 56" fill="none" stroke="var(--chalk)" strokeWidth="5" strokeLinecap="round" />
      <path d="M66 56 Q76 44 86 56" fill="none" stroke="var(--chalk)" strokeWidth="5" strokeLinecap="round" />
      <circle cx="60" cy="96" r="5" fill="var(--link)" />
    </svg>
  );
}

export function GrownupFrame({
  back,
  bare,
  children,
}: {
  back?: { href: string; label: string };
  bare?: boolean;
  children: ReactNode;
}) {
  return (
    <main className={`${styles.frame} ${atkinson.variable}`}>
      {bare ? (
        <div className={styles.bareHead}>
          <NovaMark className={styles.novaBig} />
          <p className={styles.appName}>Math Friend</p>
        </div>
      ) : (
        <div className={styles.strip}>
          <div className={styles.stripInner}>
            <NovaMark className={styles.novaSmall} />
            <span className={styles.stripText}>For grown-ups</span>
            {back ? (
              <Link href={back.href} className={styles.stripLink}>
                {back.label}
              </Link>
            ) : null}
          </div>
        </div>
      )}
      <div className={styles.col}>{children}</div>
    </main>
  );
}
