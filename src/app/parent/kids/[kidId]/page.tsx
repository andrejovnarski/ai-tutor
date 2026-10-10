import { notFound } from "next/navigation";
import { requireParent } from "@/server/parentGate";
import { kidWeek } from "@/server/parentSummary";
import { exportKid } from "@/server/rights";
import { faceOf } from "../../../avatars";
import { gradeName } from "../../../grades";
import { GrownupFrame } from "../../ui/GrownupFrame";
import styles from "../../ui/grownup.module.css";
import { deleteKidAction } from "./actions";
import { WeekSummary } from "./WeekSummary";

type Row = Record<string, unknown>;

function Table({ title, rows }: { title: string; rows: Row[] }) {
  const cols = rows.length ? Object.keys(rows[0]!) : [];
  const show = (v: unknown) => (v !== null && typeof v === "object" ? JSON.stringify(v) : String(v ?? ""));
  return (
    <section>
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p className={styles.quiet}>Nothing yet.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={c} scope="col">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {cols.map((c) => (
                    <td key={c}>{show(r[c])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

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
  const week = await kidWeek(supabase, kidId, new Date());
  return (
    <GrownupFrame back={{ href: "/parent", label: "Your kids" }}>
      <h1>
        <span aria-hidden="true">{faceOf(kid.avatar)} </span>
        {`${kid.nickname}'s week`}
      </h1>
      <p className={styles.quiet}>{gradeName(kid.grade)}</p>
      {week && <WeekSummary nickname={kid.nickname} week={week.week} playedDays={week.playedDays} />}
      <details className={styles.details}>
        <summary>See everything we store about {kid.nickname}</summary>
        <Table title="Skills" rows={data.skill_state} />
        <Table title="Styles" rows={data.style_stats} />
        <Table title="Attempts" rows={data.attempts} />
        <Table title="Sessions" rows={data.sessions} />
        <Table title="Flagged messages" rows={data.distress_flags} />
      </details>
      <p className={styles.dataLinks}>
        <a href={`/parent/kids/${kidId}/export`}>Download {kid.nickname}&apos;s data</a>
        <a href="#delete" className={styles.dangerLink}>Delete {kid.nickname}</a>
      </p>
      <section id="delete" className={styles.section}>
        <h2>Delete {kid.nickname}</h2>
        <p>This removes {kid.nickname} and everything above, right away. It cannot be undone.</p>
        {error === "confirm" && <p role="alert">That name did not match. Nothing was deleted.</p>}
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
