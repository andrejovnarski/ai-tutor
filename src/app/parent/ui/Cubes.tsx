import styles from "./grownup.module.css";

export function Cubes({
  filled,
  total,
  label,
  max,
}: {
  filled: number;
  total: number;
  color: "blue" | "green";
  label: string;
  max?: number;
}) {
  const drawn = Math.max(0, Math.min(total, max ?? total));
  const lit = Math.max(0, Math.min(filled, drawn));
  const extra = max !== undefined && filled > max ? filled - max : 0;
  return (
    <span role="img" aria-label={label} className={styles.cubes}>
      {Array.from({ length: drawn }, (_, i) => (
        <span
          key={i}
          data-cube=""
          {...(i < lit ? { "data-filled": "true" } : {})}
          className={styles.cube}
        />
      ))}
      {extra > 0 ? <span className={styles.cubesMore}>+{extra}</span> : null}
    </span>
  );
}
