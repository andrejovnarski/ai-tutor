import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import styles from "./grownup.module.css";

export function IndexCard({ color, href, children }: { color: string; href?: string; children: ReactNode }) {
  const style = { "--tab": color } as CSSProperties;
  if (href) {
    return (
      <Link href={href} className={`${styles.card} ${styles.cardLink}`} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <div className={styles.card} style={style}>
      {children}
    </div>
  );
}
