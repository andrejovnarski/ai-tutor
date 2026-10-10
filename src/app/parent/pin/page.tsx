import { requireUser } from "@/server/parentGate";
import { readPinRow } from "@/server/parentPinStore";
import { forgotPin, setPin, unlock } from "../actions";
import { GrownupFrame } from "../ui/GrownupFrame";
import { PinField } from "../ui/PinField";
import styles from "../ui/grownup.module.css";

const MESSAGES: Record<string, string> = {
  format: "The PIN must be exactly 4 digits.",
  mismatch: "The two PINs did not match.",
  wrong: "That PIN is not right.",
  locked: "Locked for 10 minutes. Try again later.",
  forgot: "To reset your PIN, sign in again by email first, then tap Forgot PIN within 10 minutes.",
};

const back = { href: "/", label: "Back to kids" };

export default async function PinPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { user } = await requireUser();
  const { error } = await searchParams;
  const row = await readPinRow(user.id);
  const locked = !!row.pin_locked_until && Date.parse(row.pin_locked_until) > Date.now();
  const message = locked ? MESSAGES.locked : error ? MESSAGES[error] : undefined;

  if (!row.pin_hash) {
    return (
      <GrownupFrame back={back}>
        <h1>Set a PIN</h1>
        <p className={styles.lede}>This 4-digit PIN keeps the parent area for grown-ups.</p>
        {message && (
          <p role="alert" className={styles.note}>
            {message}
          </p>
        )}
        <form action={setPin}>
          <PinField name="pin" label="New PIN" />
          <PinField name="pin2" label="Repeat PIN" />
          <button type="submit" className={styles.btn}>
            Save PIN
          </button>
        </form>
      </GrownupFrame>
    );
  }
  return (
    <GrownupFrame back={back}>
      <h1>Enter your PIN</h1>
      <p className={styles.lede}>So little fingers stay on the kids&apos; side.</p>
      {message && (
        <p role="alert" className={styles.note}>
          {message}
        </p>
      )}
      <form action={unlock}>
        <PinField name="pin" label="PIN" />
        <button type="submit" className={styles.btn}>
          Unlock
        </button>
      </form>
      <form action={forgotPin}>
        <button type="submit" className={styles.linkBtn}>
          Forgot PIN
        </button>
      </form>
    </GrownupFrame>
  );
}
