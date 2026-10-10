import type { ReactNode } from "react";
import styles from "./grownup.module.css";

export function StickyNote({ children }: { children: ReactNode }) {
  return <div className={styles.sticky}>{children}</div>;
}
