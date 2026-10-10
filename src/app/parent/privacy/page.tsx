import { GrownupFrame } from "../ui/GrownupFrame";
import { StickyNote } from "../ui/StickyNote";
import styles from "../ui/grownup.module.css";
import { requireParent } from "@/server/parentGate";
import { DRAFT_BANNER, NOTICE_SECTIONS, NOTICE_SUMMARY, PRIVACY_NOTICE_VERSION } from "@/server/consent/notice";

export default async function PrivacyPage() {
  await requireParent();
  return (
    <GrownupFrame back={{ href: "/parent/consent", label: "Back to consent" }}>
      <StickyNote>
        <p role="note" style={{ margin: 0 }}>
          <strong>{DRAFT_BANNER}</strong>
        </p>
      </StickyNote>
      <h1>Privacy notice</h1>
      <p className={styles.lede}>{NOTICE_SUMMARY}</p>
      {NOTICE_SECTIONS.map((s) => (
        <section key={s.heading} className={styles.section}>
          <h2>{s.heading}</h2>
          <ul>
            {s.body.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ))}
      <p className={styles.quiet}>Version {PRIVACY_NOTICE_VERSION}</p>
    </GrownupFrame>
  );
}
