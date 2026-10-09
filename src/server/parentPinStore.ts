import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

export type PinRow = {
  pin_hash: string | null;
  pin_salt: string | null;
  pin_failed: number;
  pin_locked_until: string | null;
};

// Users cannot update PIN columns (Task 2), so these go through the secret key.
// Callers must have confirmed the parent with auth.getUser() and pass that user's id; every query is scoped to it.
function db() {
  return createClient(env.supabaseUrl(), env.supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function readPinRow(parentId: string): Promise<PinRow> {
  const { data, error } = await db()
    .from("parents")
    .select("pin_hash, pin_salt, pin_failed, pin_locked_until")
    .eq("id", parentId)
    .single();
  if (error) throw error;
  return data as PinRow;
}

async function write(parentId: string, patch: Partial<PinRow>): Promise<void> {
  const { error } = await db().from("parents").update(patch).eq("id", parentId);
  if (error) throw error;
}

export const storePin = (parentId: string, hash: string, salt: string) =>
  write(parentId, { pin_hash: hash, pin_salt: salt, pin_failed: 0, pin_locked_until: null });

export const clearPin = (parentId: string) =>
  write(parentId, { pin_hash: null, pin_salt: null, pin_failed: 0, pin_locked_until: null });

export const recordPinFailure = (parentId: string, failed: number, lockedUntilMs: number | null) =>
  write(parentId, {
    pin_failed: failed,
    pin_locked_until: lockedUntilMs === null ? null : new Date(lockedUntilMs).toISOString(),
  });

export const resetPinFailures = (parentId: string) => write(parentId, { pin_failed: 0, pin_locked_until: null });
