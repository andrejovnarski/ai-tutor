import Link from "next/link";
import { redirect } from "next/navigation";
import { requireParent } from "@/server/parentGate";
import { DRAFT_BANNER, NOTICE_SUMMARY } from "@/server/consent/notice";
import { IndexCard } from "../ui/IndexCard";
import { GrownupFrame } from "../ui/GrownupFrame";
import { StickyNote } from "../ui/StickyNote";
import styles from "../ui/grownup.module.css";
import { ConsentForm } from "./ConsentForm";
import { startConsent } from "./actions";

export default async function ConsentPage({ searchParams }: { searchParams: Promise<{ error?: string; cancelled?: string }> }) {
  const { supabase, user } = await requireParent();
  const { data: parent } = await supabase.from("parents").select("consent_at").eq("id", user.id).single();
  if (parent?.consent_at) redirect("/parent");
  const { error, cancelled } = await searchParams;
  return (
    <GrownupFrame back={{ href: "/parent", label: "Your kids" }}>
      <StickyNote>
        <p role="note" style={{ margin: 0 }}>
          <strong>{DRAFT_BANNER}</strong>
        </p>
      </StickyNote>
      <h1>One step before your child plays</h1>
      <IndexCard color="var(--pp-white)">
        <p style={{ margin: "0 0 8px" }}>{NOTICE_SUMMARY}</p>
        <p style={{ margin: 0 }}>
          <Link href="/parent/privacy">Read the full privacy notice</Link>
        </p>
      </IndexCard>
      <p className={styles.lede}>To confirm you are a grown-up, we check your card with Stripe. You are not charged and we do not keep the card.</p>
      {error && (
        <p role="alert" className={styles.note}>We couldn&apos;t verify that. No charge was made. Please try again.
        </p>
      )}
      {cancelled && !error && (
        <p role="status" className={styles.note}>
          Card check cancelled. No charge was made.
        </p>
      )}
      <ConsentForm action={startConsent} />
    </GrownupFrame>
  );
}
