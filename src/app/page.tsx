import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/server/supabase";

export default async function HomePage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/sign-in");
  const { data: kids } = await supabase.from("kids").select("id, nickname, avatar").order("created_at");
  return (
    <main style={{ padding: 24 }}>
      <h1>Math Friend</h1>
      {kids && kids.length > 0 ? (
        <ul style={{ display: "flex", gap: 24, flexWrap: "wrap", listStyle: "none", padding: 0 }}>
          {kids.map((k) => (
            <li key={k.id}>
              <Link href={`/play/${k.id}`} style={{ display: "block", padding: "32px 48px", fontSize: 32, border: "3px solid", borderRadius: 24, textAlign: "center", textDecoration: "none" }}>
                <span aria-hidden="true" style={{ display: "block", fontSize: 20 }}>{k.avatar}</span>
                {k.nickname}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Link href="/parent">Add your first kid</Link>
      )}
      <p>
        <Link href="/parent" style={{ fontSize: 14 }}>Grown-ups</Link>
      </p>
    </main>
  );
}
