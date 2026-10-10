import Link from "next/link";
import { GrownupFrame } from "../ui/GrownupFrame";
import styles from "../ui/grownup.module.css";
import { requireParent } from "@/server/parentGate";
import { deleteAccountAction } from "./actions";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireParent();
  const { error } = await searchParams;
  return (
    <GrownupFrame back={{ href: "/parent", label: "Your kids" }}>
      <h1>Account</h1>
      <p>
        <Link href="/parent/privacy">Read the privacy notice</Link>
      </p>
      <h2>Revoke consent and delete account</h2>
      <p>
        Revoking consent means deleting everything. Your account, every kid, all their progress, attempts and
        messages, and your consent record are removed right away. This cannot be undone.
      </p>
      {error === "confirm" && (
        <p role="alert" className={styles.note}>
          Type DELETE exactly. Nothing was deleted.
        </p>
      )}
      <form action={deleteAccountAction}>
        <label className={styles.field}>
          Type DELETE to confirm
          <input className={styles.input} name="confirm" required autoComplete="off" />
        </label>
        <button type="submit" className={styles.btnDanger}>Revoke consent and delete account</button>
      </form>
    </GrownupFrame>
  );
}
