import Link from "next/link";
import { requireUser } from "@/server/parentGate";
import styles from "./picker.module.css";
import { kidProgress } from "@/server/rewards";
import { MiniRewards } from "./MiniRewards";
import { faceOf } from "./avatars";
import { Nova } from "./play/Nova";

export default async function HomePage() {
  const { supabase } = await requireUser(); // counts as activity
  const { data: kids } = await supabase.from("kids").select("id, nickname, avatar").order("created_at");
  const now = Date.now();
  const progresses = await Promise.all((kids ?? []).map((k) => kidProgress(supabase, k.id, now)));
  return (
    <main className={styles.picker}>
      <header className={styles.hello}>
        <Nova tone="cheer" />
        <h1 className={styles.title}>Who&apos;s playing?</h1>
      </header>
      {kids && kids.length > 0 ? (
        <ul className={styles.kids}>
          {kids.map((k, i) => (
            <li key={k.id}>
              <Link href={`/play/${k.id}`} className={styles.kid}>
                <span aria-hidden="true" className={styles.avatar}>{faceOf(k.avatar)}</span>
                <span className={styles.name} data-picker-name><span className={styles.nameText}>{k.nickname}</span></span>
                {progresses[i] && <MiniRewards progress={progresses[i]} />}
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
