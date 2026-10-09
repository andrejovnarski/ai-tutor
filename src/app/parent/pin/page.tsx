import { requireUser } from "@/server/parentGate";
import { readPinRow } from "@/server/parentPinStore";
import { forgotPin, setPin, unlock } from "../actions";

const MESSAGES: Record<string, string> = {
  format: "The PIN must be exactly 4 digits.",
  mismatch: "The two PINs did not match.",
  wrong: "That PIN is not right.",
  locked: "Locked for 10 minutes. Try again later.",
  forgot: "To reset your PIN, sign in again by email first, then tap Forgot PIN within 10 minutes.",
};

const pinInput = { type: "password", inputMode: "numeric", pattern: "[0-9]{4}", maxLength: 4, required: true, autoComplete: "off" } as const;

export default async function PinPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { user } = await requireUser();
  const { error } = await searchParams;
  const row = await readPinRow(user.id);
  const locked = !!row.pin_locked_until && Date.parse(row.pin_locked_until) > Date.now();
  const message = locked ? MESSAGES.locked : error ? MESSAGES[error] : undefined;

  if (!row.pin_hash) {
    return (
      <main>
        <h1>Set a PIN</h1>
        <p>This 4-digit PIN keeps the parent area for grown-ups.</p>
        {message && <p role="alert">{message}</p>}
        <form action={setPin}>
          <label>
            New PIN
            <input name="pin" {...pinInput} />
          </label>
          <label>
            Repeat PIN
            <input name="pin2" {...pinInput} />
          </label>
          <button type="submit">Save PIN</button>
        </form>
      </main>
    );
  }
  return (
    <main>
      <h1>Parent area</h1>
      {message && <p role="alert">{message}</p>}
      <form action={unlock}>
        <label>
          PIN
          <input name="pin" {...pinInput} />
        </label>
        <button type="submit">Unlock</button>
      </form>
      <form action={forgotPin}>
        <button type="submit">Forgot PIN</button>
      </form>
    </main>
  );
}
