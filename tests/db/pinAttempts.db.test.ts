import { describe, it, expect } from "vitest";
import { admin, anon, makeParent } from "../helpers/admin";

const email = () => `pin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.dev`;
const row = async (id: string) =>
  (await admin().from("parents").select("pin_failed, pin_locked_until").eq("id", id).single()).data!;
type Reserved = { allowed: boolean; locked_until: string | null };
const reserve = async (id: string): Promise<Reserved> => {
  const { data, error } = await admin().rpc("reserve_pin_attempt", { p_parent: id });
  expect(error).toBeNull();
  return (Array.isArray(data) ? data[0] : data) as Reserved;
};
const reset = (id: string) => admin().rpc("reset_pin_failures", { p_parent: id });

describe("reserve_pin_attempt", () => {
  it("of 12 parallel reservations at most 5 are allowed, and the parent ends locked", async () => {
    const { userId } = await makeParent(email());
    const results = await Promise.all(Array.from({ length: 12 }, () => reserve(userId)));
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
    const r = await row(userId);
    expect(r.pin_failed).toBe(5);
    expect(Date.parse(r.pin_locked_until!)).toBeGreaterThan(Date.now() + 9 * 60_000);
  });

  it("allows 5 attempts, locks on the 5th, and refuses the 6th", async () => {
    const { userId } = await makeParent(email());
    for (let i = 1; i <= 4; i++) {
      expect(await reserve(userId)).toEqual({ allowed: true, locked_until: null });
    }
    const fifth = await reserve(userId);
    expect(fifth.allowed).toBe(true);
    expect(fifth.locked_until).not.toBeNull();
    const before = await row(userId);
    const sixth = await reserve(userId);
    expect(sixth.allowed).toBe(false);
    expect(Date.parse(sixth.locked_until!)).toBe(Date.parse(before.pin_locked_until!));
    expect(await row(userId)).toEqual(before);
  });

  it("a correct PIN on an allowed attempt resets the count, including the lock that attempt set", async () => {
    const { userId } = await makeParent(email());
    await reserve(userId);
    expect((await reset(userId)).error).toBeNull();
    expect(await row(userId)).toEqual({ pin_failed: 0, pin_locked_until: null });
    for (let i = 0; i < 5; i++) await reserve(userId);
    expect((await row(userId)).pin_locked_until).not.toBeNull();
    expect((await reset(userId)).error).toBeNull();
    expect(await row(userId)).toEqual({ pin_failed: 0, pin_locked_until: null });
  });

  it("an expired lock starts a fresh count", async () => {
    const { userId } = await makeParent(email());
    await admin().from("parents").update({ pin_failed: 5, pin_locked_until: new Date(Date.now() - 1000).toISOString() }).eq("id", userId);
    expect(await reserve(userId)).toEqual({ allowed: true, locked_until: null });
    expect(await row(userId)).toEqual({ pin_failed: 1, pin_locked_until: null });
  });

  it("is not callable by signed-in parents or anon, and the old record_pin_failure is gone", async () => {
    const { userId, client } = await makeParent(email());
    expect((await client.rpc("reserve_pin_attempt", { p_parent: userId })).error).not.toBeNull();
    expect((await anon().rpc("reserve_pin_attempt", { p_parent: userId })).error).not.toBeNull();
    expect((await client.rpc("reset_pin_failures", { p_parent: userId })).error).not.toBeNull();
    expect((await anon().rpc("reset_pin_failures", { p_parent: userId })).error).not.toBeNull();
    expect((await admin().rpc("record_pin_failure", { p_parent: userId })).error).not.toBeNull();
  });
});
