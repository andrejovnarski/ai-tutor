import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/server/supabase";

export default async function HomePage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/sign-in");
  const { data: kids } = await supabase.from("kids").select("id, nickname, avatar").order("created_at");
  return (
    <main>
      <h1>Math Friend</h1>
      {kids && kids.length > 0 ? (
        <>
          <ul>
            {kids.map((k) => (
              <li key={k.id}>
                {k.nickname} ({k.avatar})
              </li>
            ))}
          </ul>
          <Link href="/parent">Parent area</Link>
        </>
      ) : (
        <Link href="/parent">Add your first kid</Link>
      )}
    </main>
  );
}
