import styles from "./grownup.module.css";

export function PinField({ name, label }: { name: string; label: string }) {
  return (
    <label className={styles.field}>
      {label}
      <span className={styles.pinBox}>
        <input
          className={styles.pinInput}
          name={name}
          type="password"
          inputMode="numeric"
          pattern="[0-9]{4}"
          maxLength={4}
          required
          autoComplete="off"
        />
      </span>
    </label>
  );
}
