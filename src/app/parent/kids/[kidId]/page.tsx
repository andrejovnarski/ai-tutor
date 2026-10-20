import { notFound } from "next/navigation";
import { requireParent } from "@/server/parentGate";
import { kidWeek } from "@/server/parentSummary";
import { kidProgress } from "@/server/rewards";
import { kidRecord } from "@/server/kidRecord";
import { exportKid } from "@/server/rights";
import { faceOf } from "../../../avatars";
import { gradeName } from "../../../grades";
import { GrownupFrame } from "../../ui/GrownupFrame";
import { IslandsCard } from "../../ui/IslandsCard";
import { RewardsSection } from "../../ui/RewardsSection";
import styles from "../../ui/grownup.module.css";
import { deleteKidAction } from "./actions";
import { WeekSummary } from "./WeekSummary";

export default async function KidPage({
  params,
  searchParams,
}: {
  params: Promise<{ kidId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { kidId } = await params;
  const { error } = await searchParams;
  const { supabase } = await requireParent();
  const data = await exportKid(supabase, kidId);
  if (!data) notFound();
  const { kid } = data;
  const [week, progress] = await Promise.all([kidWeek(supabase, kidId, new Date()), kidProgress(supabase, kidId, Date.now())]);
  const record = kidRecord(data);
  return (
    <GrownupFrame back={{ href: "/parent", label: "Your kids" }}>
      <h1>
        <span aria-hidden="true">{faceOf(kid.avatar)} </span>
        {`${kid.nickname}'s week`}
      </h1>
      <p className={styles.quiet}>{gradeName(kid.grade)}</p>
      {progress && <IslandsCard nickname={kid.nickname} map={progress.map} />}
      {week && <WeekSummary nickname={kid.nickname} week={week.week} playedDays={week.playedDays} />}
      {progress && <RewardsSection nickname={kid.nickname} progress={progress} />}
      <section className={styles.section}>
        <h2>Progress</h2>
        {record.skills.length === 0 ? (
          <p className={styles.quiet}>{`Nothing yet. Skills show up here once ${kid.nickname} has played a little more.`}</p>
        ) : (
          <ul className={styles.recordList}>
            {record.skills.map((s) => (
              <li key={s.name}>
                <b>{s.name}</b>
                <span className={styles.block}>{s.status}</span>
                {s.tricky && <span className={`${styles.block} ${styles.quiet}`}>{`Tricky part: ${s.tricky}`}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={styles.section}>
        <h2>Sessions</h2>
        {record.sessions.length === 0 ? (
          <p className={styles.quiet}>No sessions yet.</p>
        ) : (
          <ul className={styles.recordList}>
            {record.sessions.map((s, i) => (
              <li key={i}>
                <b>{s.when}</b>
                <span className={styles.block}>{`${s.length} · ${s.problems}`}</span>
                {s.helped > 0 && <span className={styles.block}>{`Asked for help ${s.helped} ${s.helped === 1 ? "time" : "times"}`}</span>}
                {s.mastered.length > 0 && <span className={styles.block}>{`Learned: ${s.mastered.join(", ")}`}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
      {record.flags.length > 0 && (
        <section className={styles.section}>
          <h2>Flagged messages</h2>
          <p className={styles.quiet}>{`Things ${kid.nickname} said to Nova that sounded like ${kid.nickname} might need a grown-up.`}</p>
          <ul className={styles.recordList}>
            {record.flags.map((f, i) => (
              <li key={i}>
                <b>{f.when}</b>
                <span className={styles.block}>{`"${f.line}"`}</span>
                <span className={`${styles.block} ${styles.quiet}`}>{f.emailed}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className={styles.section}>
        <p className={styles.dataLinks}>
          <a href={`/parent/kids/${kidId}/export`}>Download everything we store about {kid.nickname}</a>
        </p>
        <p className={styles.quiet}>The file has every detail we keep, exactly as stored.</p>
        <p className={styles.dataLinks}>
          <a href="#delete" className={styles.dangerLink}>Delete {kid.nickname}</a>
        </p>
      </section>
      <section id="delete" className={styles.section}>
        <h2>Delete {kid.nickname}</h2>
        <p>This removes {kid.nickname} and everything we store about them, right away. It cannot be undone.</p>
        {error === "confirm" && <p role="alert" className={styles.note}>That name did not match. Nothing was deleted.</p>}
        <form action={deleteKidAction.bind(null, kidId)}>
          <label className={styles.field}>
            Type {kid.nickname} to confirm
            <input name="confirm" required autoComplete="off" className={styles.input} />
          </label>
          <button type="submit" className={styles.btnDanger}>Delete {kid.nickname}</button>
        </form>
      </section>
    </GrownupFrame>
  );
}
