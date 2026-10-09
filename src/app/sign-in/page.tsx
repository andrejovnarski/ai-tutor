import { requestLink } from "./actions";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;
  if (sent) {
    return (
      <main>
        <h1>Check your email</h1>
        <p>We sent a sign-in link. Open it on any device.</p>
      </main>
    );
  }
  return (
    <main>
      <h1>Sign in</h1>
      {error === "link" && <p role="alert">That link expired. Send a new one.</p>}
      <form action={requestLink}>
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <button type="submit">Send link</button>
      </form>
    </main>
  );
}
