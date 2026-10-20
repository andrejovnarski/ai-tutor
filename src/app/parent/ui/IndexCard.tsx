import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./grownup.module.css";

// Keep the color prop for existing callers; Logbook cards have no coloured tab.
export function IndexCard({ href, children }: { color: string; href?: string; children: ReactNode }) {
  if (href) {
    return (
      <Link href={href} className={`${styles.card} ${styles.cardLink}`}>
        {children}
      </Link>
    );
  }
  return (
    <div className={styles.card}>
      {children}
    </div>
  );
}
