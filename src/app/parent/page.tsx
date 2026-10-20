import Link from "next/link";
import { requireParent } from "@/server/parentGate";
import { lastPlayed, lastPlayedLabel } from "@/server/parentSummary";
import { colorOf, faceOf } from "../avatars";
import { gradeName } from "../grades";
import { GrownupFrame } from "./ui/GrownupFrame";
import { IndexCard } from "./ui/IndexCard";
import styles from "./ui/grownup.module.css";

export default async function ParentPage() {
  const { supabase, user } = await requireParent();
  const { data: parent } = await supabase
    .from("parents")
    .select("consent_at")
    .eq("id", user.id)
    .single();
  const { data: kids } = await supabase
    .from("kids")
    .select("id, nickname, avatar, grade")
    .order("created_at");
  const consented = !!parent?.consent_at;
  const played = await lastPlayed(
    supabase,
    (kids ?? []).map((k) => k.id),
  );
  const now = new Date();
  return (
    <GrownupFrame back={{ href: "/", label: "Back to kids" }}>
      <h1>Your kids</h1>
      {!consented && (
        <IndexCard color="var(--pp-white)">
          <p className={styles.lede}>
            Before your kid can play, we need a parent&apos;s consent.
          </p>
          <Link href="/parent/consent" className={styles.btn}>
            Give consent
          </Link>
        </IndexCard>
      )}
      {(kids ?? []).length > 0 && (
        <ul className={styles.plainList}>
          {(kids ?? []).map((k) => (
            <li key={k.id}>
              <IndexCard
                color={colorOf(k.avatar)}
                href={`/parent/kids/${k.id}`}
              >
                <span className={styles.kidRow}>
                  <span aria-hidden="true" className={styles.kidFace}>
                    {faceOf(k.avatar)}
                  </span>
                  <span>
                    <span className={styles.kidName}>{k.nickname}</span>
                    <span className={`${styles.quiet} ${styles.block}`}>
                      {gradeName(k.grade)},{" "}
                      {lastPlayedLabel(played.get(k.id) ?? null, now)}
                    </span>
                  </span>
                </span>
              </IndexCard>
            </li>
          ))}
        </ul>
      )}
      {consented && (
        <p>
          <Link href="/parent/kids/new" className={styles.btn}>
            Add a child
          </Link>
        </p>
      )}
      <p>
        <Link href="/parent/account">Account and privacy</Link>
      </p>
    </GrownupFrame>
  );
}
