import type { ReactNode } from "react";
import { requireUser } from "@/server/parentGate";

/** Play runs on the parent's sign-in: a signed-out visitor goes to sign-in, not an error. */
export default async function PlayLayout({ children }: { children: ReactNode }) {
  await requireUser();
  return children;
}
