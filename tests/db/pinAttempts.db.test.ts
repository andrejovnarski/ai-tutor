import { describe, it, expect } from "vitest";
import { admin, anon, makeParent } from "../helpers/admin";

const email = () => `pin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
const row = async (id: string) =>
  (await admin().from("parents").select("pin_failed, pin_locked_until").eq("id", id).single()).data!;
const fail = (id: string) => admin().rpc("record_pin_failure", { p_parent: id });

describe("record_pin_failure", () => {
  it("12 concurrent failures end locked with every failure counted", async () => {
    const { userId } = await makeParent(email());
    const results = await Promise.all(Array.from({ length: 12 }, () => fail(userId)));
    for (const r of results) expect(r.error).toBeNull();
    const r = await row(userId);
    expect(r.pin_failed).toBeGreaterThanOrEqual(5);
    expect(r.pin_locked_until).not.toBeNull();
    expect(Date.parse(r.pin_locked_until!)).toBeGreaterThan(Date.now() + 9 * 60_000);
  });

  it("locks on the 5th failure, not before", async () => {
    const { userId } = await makeParent(email());
    for (let i = 1; i <= 4; i++) {
      await fail(userId);
      expect((await row(userId)).pin_locked_until).toBeNull();
    }
    await fail(userId);
    expect((await row(userId)).pin_locked_until).not.toBeNull();
  });

  it("a failure while locked does not clear or shorten the lock, and success cannot reset it", async () => {
    const { userId } = await makeParent(email());
    for (let i = 0; i < 5; i++) await fail(userId);
    const before = await row(userId);
    await fail(userId);
    await admin().rpc("reset_pin_failures", { p_parent: userId });
    expect(await row(userId)).toEqual(before);
  });

  it("an expired lock starts a fresh count, and success resets it", async () => {
    const { userId } = await makeParent(email());
    await admin().from("parents").update({ pin_failed: 5, pin_locked_until: new Date(Date.now() - 1000).toISOString() }).eq("id", userId);
    await fail(userId);
    expect(await row(userId)).toEqual({ pin_failed: 1, pin_locked_until: null });
    await admin().rpc("reset_pin_failures", { p_parent: userId });
    expect((await row(userId)).pin_failed).toBe(0);
  });

  it("is not callable by signed-in parents or anon", async () => {
    const { userId, client } = await makeParent(email());
    expect((await client.rpc("record_pin_failure", { p_parent: userId })).error).not.toBeNull();
    expect((await anon().rpc("reset_pin_failures", { p_parent: userId })).error).not.toBeNull();
  });
});
