import Link from "next/link";
import { redirect } from "next/navigation";
import { requireParent } from "@/server/parentGate";
import { DRAFT_BANNER, NOTICE_SUMMARY } from "@/server/consent/notice";
import { ConsentForm } from "./ConsentForm";
import { startConsent } from "./actions";

export default async function ConsentPage({ searchParams }: { searchParams: Promise<{ error?: string; cancelled?: string }> }) {
  const { supabase, user } = await requireParent();
  const { data: parent } = await supabase.from("parents").select("consent_at").eq("id", user.id).single();
  if (parent?.consent_at) redirect("/parent");
  const { error, cancelled } = await searchParams;
  return (
    <main>
      <p role="note">
        <strong>{DRAFT_BANNER}</strong>
      </p>
      <h1>Parent consent</h1>
      <p>{NOTICE_SUMMARY}</p>
      <p>
        <Link href="/parent/privacy">Read the full privacy notice</Link>
      </p>
      <p>To confirm you are a grown-up, we check your card with Stripe. You are not charged and we do not keep the card.</p>
      {error && <p role="alert">We couldn&apos;t verify that. No charge was made. Please try again.</p>}
      {cancelled && !error && <p role="status">Card check cancelled. No charge was made.</p>}
      <ConsentForm action={startConsent} />
      <p>
        <Link href="/parent">Back</Link>
      </p>
    </main>
  );
}
