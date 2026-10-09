"use client";
import { useState } from "react";

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
      <label>
        <input type="checkbox" name="agree" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        I have read the privacy notice and I am this child&apos;s parent or guardian
      </label>
      <p>
        <button type="submit" disabled={!agreed || busy}>
          Verify with a card (no charge)
        </button>
      </p>
    </form>
  );
}
