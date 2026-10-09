import Link from "next/link";
import { requireParent } from "@/server/parentGate";
import { deleteAccountAction } from "./actions";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireParent();
  const { error } = await searchParams;
  return (
    <main>
      <h1>Account</h1>
      <h2>Revoke consent and delete account</h2>
      <p>
        Revoking consent means deleting everything. Your account, every kid, all their progress, attempts and
        messages, and your consent record are removed right away. This cannot be undone.
      </p>
      {error === "confirm" && <p role="alert">Type DELETE exactly. Nothing was deleted.</p>}
      <form action={deleteAccountAction}>
        <label>
          Type DELETE to confirm
          <input name="confirm" required autoComplete="off" />
        </label>
        <button type="submit">Revoke consent and delete account</button>
      </form>
      <p>
        <Link href="/parent">Back</Link>
      </p>
    </main>
  );
}
