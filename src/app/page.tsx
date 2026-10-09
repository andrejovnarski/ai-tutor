import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/server/supabase";

export default async function HomePage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/sign-in");
  return (
    <main>
      <h1>Math Friend</h1>
      <Link href="/parent">Add your first kid</Link>
    </main>
  );
}
