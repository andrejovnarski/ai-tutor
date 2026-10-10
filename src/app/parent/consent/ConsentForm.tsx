"use client";
import { useState } from "react";
import styles from "../ui/grownup.module.css";

export function ConsentForm({ action }: { action: (formData: FormData) => Promise<{ redirectUrl: string }> }) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const { redirectUrl } = await action(new FormData(e.currentTarget));
        window.location.assign(redirectUrl);
      }}
    >
      <label className={styles.field} style={{ flexDirection: "row", alignItems: "flex-start", fontWeight: 400 }}>
        <input style={{ width: 24, height: 24, flex: "none" }} type="checkbox" name="agree" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        I have read the privacy notice and I am this child&apos;s parent or guardian
      </label>
      <p>
        <button type="submit" className={styles.btn} disabled={!agreed || busy}>
          Verify with a card (no charge)
        </button>
      </p>
    </form>
  );
}
