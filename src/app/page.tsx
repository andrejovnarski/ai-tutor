import Link from "next/link";
import { requireUser } from "@/server/parentGate";
import styles from "./picker.module.css";

const FACES: Record<string, string> = {
  fox: "🦊", bear: "🐻", owl: "🦉", frog: "🐸", duck: "🦆", rabbit: "🐰", cat: "🐱", turtle: "🐢",
};

export default async function HomePage() {
  const { supabase } = await requireUser(); // counts as activity
  const { data: kids } = await supabase.from("kids").select("id, nickname, avatar").order("created_at");
  return (
    <main className={styles.picker}>
      <h1 className={styles.title}>Who&apos;s playing?</h1>
      {kids && kids.length > 0 ? (
        <ul className={styles.kids}>
          {kids.map((k) => (
            <li key={k.id}>
              <Link href={`/play/${k.id}`} className={styles.kid}>
                <span aria-hidden="true" className={styles.avatar}>{FACES[k.avatar] ?? k.avatar}</span>
                {k.nickname}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Link href="/parent" className={styles.add}>Add your first kid</Link>
      )}
      <Link href="/parent" className={styles.grownUps}>Grown-ups</Link>
    </main>
  );
}
