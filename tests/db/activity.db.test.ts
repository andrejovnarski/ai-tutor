import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { admin, makeParent } from "../helpers/admin";

const who = vi.hoisted(() => ({ client: null as unknown as SupabaseClient }));
vi.mock("server-only", () => ({}));
vi.mock("../../src/server/supabase", () => ({ createServerSupabase: async () => who.client }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

const { requireUser, requireParent } = await import("../../src/server/parentGate");

const run = Date.now();
const DAY = 86_400_000;
const ago = (d: number) => new Date(Date.now() - d * DAY).toISOString();
const row = async (id: string) => (await admin().from("parents").select("*").eq("id", id).single()).data;

async function warnedParent(tag: string) {
  const p = await makeParent(`act-${tag}-${run}@test.dev`, { consent: true });
  const { error } = await admin().from("parents")
    .update({ last_active_at: ago(400), retention_warned_at: ago(5), retention_warn_sent_at: ago(5) }).eq("id", p.userId);
  expect(error).toBeNull();
  who.client = p.client;
  return p;
}

describe("a warned parent who comes back on an existing session (spec §8: while active)", () => {
  it("any signed-in page (requireUser) clears the warning and refreshes activity", async () => {
    const p = await warnedParent("u");
    await requireUser();
    const r = await row(p.userId);
    expect(r.retention_warned_at).toBeNull();
    expect(r.retention_warn_sent_at).toBeNull();
    expect(new Date(r.last_active_at).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it("a parent page (requireParent) counts even before the PIN is entered", async () => {
    const p = await warnedParent("p");
    await expect(requireParent()).rejects.toThrow(); // no PIN cookie: redirect to /parent/pin
    const r = await row(p.userId);
    expect(r.retention_warned_at).toBeNull();
    expect(r.retention_warn_sent_at).toBeNull();
  });
});
