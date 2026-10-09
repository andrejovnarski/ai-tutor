"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PARENT_COOKIE, requireParent } from "@/server/parentGate";
import { deleteAccount } from "@/server/rights";

/** Revoking consent means deleting everything: the account, its kids and all their data. Then sign out. */
export async function deleteAccountAction(formData: FormData): Promise<void> {
  const { supabase, user } = await requireParent();
  if (String(formData.get("confirm") ?? "") !== "DELETE") redirect("/parent/account?error=confirm");
  await deleteAccount(user.id);
  await supabase.auth.signOut({ scope: "local" });
  (await cookies()).delete({ name: PARENT_COOKIE, path: "/parent" });
  redirect("/sign-in?deleted=1");
}
