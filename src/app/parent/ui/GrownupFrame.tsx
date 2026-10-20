import Link from "next/link";
import type { ReactNode } from "react";
import { atkinson } from "./fonts";
import styles from "./grownup.module.css";

// The same little-planet Nova as the kid side (cheer face), drawn without the kid component's motion.
function NovaMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 80 80" className={className}>
      <path d="M8 50 A34 9 -12 0 0 72 36" fill="none" stroke="var(--pp-sun)" strokeWidth="6" strokeLinecap="round" />
      <circle cx="40" cy="42" r="26" fill="var(--pp-nova)" stroke="var(--pp-ink)" strokeWidth="3" />
      <circle cx="30" cy="30" r="4" fill="#9d93f5" />
      <path d="M27 40 Q31 35 35 40 M45 40 Q49 35 53 40" fill="none" stroke="var(--pp-ink)" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 50 Q40 57 48 50" fill="none" stroke="var(--pp-ink)" strokeWidth="3" strokeLinecap="round" />
      <path d="M8 50 A34 9 -12 0 1 72 36" fill="none" stroke="var(--pp-sun)" strokeWidth="6" strokeLinecap="round" strokeDasharray="0 70 200" />
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
          <p className={styles.appName}>Brightling AI</p>
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
