"use server";

import { notFound, redirect } from "next/navigation";
import { requireParent } from "@/server/parentGate";
import { deleteKid } from "@/server/rights";

/** Deletes the kid when the typed name matches exactly; every row goes with it. */
export async function deleteKidAction(kidId: string, formData: FormData): Promise<void> {
  const { supabase } = await requireParent();
  const { data: kid } = await supabase.from("kids").select("nickname").eq("id", kidId).maybeSingle();
  if (!kid) notFound();
  if (String(formData.get("confirm") ?? "") !== kid.nickname) redirect(`/parent/kids/${kidId}?error=confirm#delete`);
  await deleteKid(supabase, kidId);
  redirect("/parent");
}
