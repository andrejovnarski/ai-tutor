import Link from "next/link";
import { requireParent } from "@/server/parentGate";
import { DRAFT_BANNER, NOTICE_SECTIONS, NOTICE_SUMMARY, PRIVACY_NOTICE_VERSION } from "@/server/consent/notice";

export default async function PrivacyPage() {
  await requireParent();
  return (
    <main>
      <p role="note">
        <strong>{DRAFT_BANNER}</strong>
      </p>
      <h1>Privacy notice</h1>
      <p>{NOTICE_SUMMARY}</p>
      {NOTICE_SECTIONS.map((s) => (
        <section key={s.heading}>
          <h2>{s.heading}</h2>
          <ul>
            {s.body.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ))}
      <p>Version {PRIVACY_NOTICE_VERSION}</p>
      <p>
        <Link href="/parent/consent">Back to consent</Link>
      </p>
    </main>
  );
}
