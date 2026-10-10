import type { AgeBand } from "@/domain/types";
import { requireUser } from "@/server/parentGate";
import { PlayScreen } from "../PlayScreen";

/** Reads the kid's age band (bubble text size) on the server; the screen itself runs in the browser. A kid that isn't
 * this parent's (or doesn't exist) gets the default band here, and the play API's 404 shows the failure state. */
export default async function PlayPage({ params }: { params: Promise<{ kidId: string }> }) {
  const { kidId } = await params;
  const { supabase } = await requireUser();
  const { data } = await supabase.from("kids").select("age_band").eq("id", kidId).maybeSingle();
  const ageBand: AgeBand = data?.age_band === "8-11" ? "8-11" : "5-7";
  return <PlayScreen kidId={kidId} ageBand={ageBand} />;
}
