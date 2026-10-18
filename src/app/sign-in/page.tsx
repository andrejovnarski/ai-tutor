import { COVERS, TAGLINE } from "../about";
import { GrownupFrame } from "../parent/ui/GrownupFrame";
import styles from "../parent/ui/grownup.module.css";
import { requestLink } from "./actions";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; deleted?: string }>;
}) {
  const { sent, error, deleted } = await searchParams;
  if (sent) {
    return (
      <GrownupFrame bare>
        <h1>Check your email</h1>
        <p>We sent a sign-in link to you. Open it on any device.</p>
      </GrownupFrame>
    );
  }
  return (
    <GrownupFrame bare>
      <h1>Sign in</h1>
      <p className={styles.lede}>{`${TAGLINE} Grown-ups sign in here.`}</p>
      <p className={styles.quiet}>{COVERS}</p>
      {deleted && (
        <p role="status" className={styles.note}>
          Your account and all data were deleted.
        </p>
      )}
      {error === "link" && (
        <p role="alert" className={styles.note}>
          That link expired. Send a new one.
        </p>
      )}
      <form action={requestLink}>
        <label className={styles.field}>
          Your email
          <input className={styles.input} name="email" type="email" required autoComplete="email" />
        </label>
        <button type="submit" className={styles.btn}>
          Email me a sign-in link
        </button>
      </form>
      <p className={styles.quiet}>No password to remember.</p>
    </GrownupFrame>
  );
}
