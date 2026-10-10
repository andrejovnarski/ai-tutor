import { notFound } from "next/navigation";
import type { AgeBand } from "@/domain/types";
import { requireUser } from "@/server/parentGate";
import { PlayScreen } from "../PlayScreen";

/** Reads the kid's age band (bubble text size) on the server; the screen itself runs in the browser. A kid that isn't
 * this parent's (row-level security hides it), doesn't exist, or has a malformed id is a plain 404 page. */
export default async function PlayPage({ params }: { params: Promise<{ kidId: string }> }) {
  const { kidId } = await params;
  const { supabase } = await requireUser();
  const { data } = await supabase.from("kids").select("age_band").eq("id", kidId).maybeSingle();
  if (!data) notFound();
  const ageBand: AgeBand = data.age_band === "8-11" ? "8-11" : "5-7";
  return <PlayScreen kidId={kidId} ageBand={ageBand} />;
}
