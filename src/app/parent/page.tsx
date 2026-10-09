import Link from "next/link";
import { requireParent } from "@/server/parentGate";

export default async function ParentPage() {
  const { supabase, user } = await requireParent();
  const { data: parent } = await supabase.from("parents").select("consent_at").eq("id", user.id).single();
  const { data: kids } = await supabase.from("kids").select("id, nickname, avatar, grade").order("created_at");
  const consented = !!parent?.consent_at;
  return (
    <main>
      <h1>Parent area</h1>
      {!consented && (
        <p>
          Before your kid can play, we need a parent&apos;s consent. <Link href="/parent/consent">Give consent</Link>
        </p>
      )}
      {kids && kids.length > 0 && (
        <ul>
          {kids.map((k) => (
            <li key={k.id}>
              <Link href={`/parent/kids/${k.id}`}>{k.nickname}</Link> ({k.avatar}, grade {k.grade})
            </li>
          ))}
        </ul>
      )}
      {consented && <Link href="/parent/kids/new">Add kid</Link>}
      <p>
        <Link href="/parent/account">Account</Link>
      </p>
      <p>
        <Link href="/">Back</Link>
      </p>
    </main>
  );
}
