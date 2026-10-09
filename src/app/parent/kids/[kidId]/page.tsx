import Link from "next/link";
import { notFound } from "next/navigation";
import { requireParent } from "@/server/parentGate";
import { exportKid } from "@/server/rights";
import { deleteKidAction } from "./actions";

type Row = Record<string, unknown>;

function Table({ title, rows }: { title: string; rows: Row[] }) {
  const cols = rows.length ? Object.keys(rows[0]!) : [];
  const show = (v: unknown) => (v !== null && typeof v === "object" ? JSON.stringify(v) : String(v ?? ""));
  return (
    <section>
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p>Nothing yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
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
  return (
    <main>
      <h1>{kid.nickname}</h1>
      <p>
        Grade {kid.grade}, avatar {kid.avatar}. <a href={`/parent/kids/${kidId}/export`}>Download all data (JSON)</a>
      </p>
      <Table title="Skills" rows={data.skill_state} />
      <Table title="Styles" rows={data.style_stats} />
      <Table title="Attempts" rows={data.attempts} />
      <Table title="Sessions" rows={data.sessions} />
      <Table title="Flagged messages" rows={data.distress_flags} />
      <section>
        <h2>Delete {kid.nickname}</h2>
        <p>This removes {kid.nickname} and everything above, right away. It cannot be undone.</p>
        {error === "confirm" && <p role="alert">That name did not match. Nothing was deleted.</p>}
        <form action={deleteKidAction.bind(null, kidId)}>
          <label>
            Type {kid.nickname} to confirm
            <input name="confirm" required autoComplete="off" />
          </label>
          <button type="submit">Delete {kid.nickname}</button>
        </form>
      </section>
      <p>
        <Link href="/parent">Back</Link>
      </p>
    </main>
  );
}
