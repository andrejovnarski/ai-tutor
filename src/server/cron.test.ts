import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
const { requireCronAuth, easternSlot } = await import("./cron");

beforeEach(() => vi.stubEnv("CRON_SECRET", "s3cret-value"));
const req = (auth?: string) => new Request("http://x/api/cron", { headers: auth ? { authorization: auth } : {} });

describe("requireCronAuth", () => {
  it("rejects a missing header and a wrong secret with 401", () => {
    expect(requireCronAuth(req())?.status).toBe(401);
    expect(requireCronAuth(req("Bearer nope"))?.status).toBe(401);
    expect(requireCronAuth(req("Bearer s3cret-value-longer"))?.status).toBe(401);
    expect(requireCronAuth(req("s3cret-value"))?.status).toBe(401);
  });
  it("accepts the right secret", () => {
    expect(requireCronAuth(req("Bearer s3cret-value"))).toBeNull();
  });
});

describe("easternSlot", () => {
  it("reads the New York hour and Sunday across daylight saving", () => {
    expect(easternSlot(new Date("2026-10-11T21:00:00Z"))).toMatchObject({ weekday: "Sun", hour: 17, date: "2026-10-11" }); // EDT
    expect(easternSlot(new Date("2026-12-06T22:00:00Z"))).toMatchObject({ weekday: "Sun", hour: 17, date: "2026-12-06" }); // EST
    expect(easternSlot(new Date("2026-10-11T22:00:00Z")).hour).toBe(18);
    expect(easternSlot(new Date("2026-10-12T02:00:00Z"))).toMatchObject({ weekday: "Sun", hour: 22 });
  });
});
