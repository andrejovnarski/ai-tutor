import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { lastPlayedLabel } = await import("./parentSummary");
const { nyMidnightDaysAgo } = await import("./report/collect");

const now = new Date("2026-10-10T18:00:00Z"); // Saturday, 14:00 in New York
describe("lastPlayedLabel", () => {
  it.each([
    [null, "hasn't played yet"],
    ["2026-10-10T13:00:00Z", "played today"],
    ["2026-10-10T04:30:00Z", "played today"], // 00:30 EDT Oct 10
    ["2026-10-10T03:30:00Z", "played yesterday"], // 23:30 EDT Oct 9 (already Oct 10 in UTC)
    ["2026-10-06T15:00:00Z", "played on Tuesday"],
    ["2026-10-04T15:00:00Z", "played on Sunday"], // 6 days ago
    ["2026-10-03T15:00:00Z", "played on Oct 3"], // 7 days ago
  ])("%s -> %s", (iso, label) => expect(lastPlayedLabel(iso ? new Date(iso) : null, now)).toBe(label));
});

describe("nyMidnightDaysAgo", () => {
  it("is 00:00 New York, 6 days back, in summer time", () => {
    expect(nyMidnightDaysAgo(new Date("2026-10-11T21:00:00Z"), 6).toISOString()).toBe("2026-10-05T04:00:00.000Z");
  });
  it("uses the NY date, not the UTC date", () => {
    expect(nyMidnightDaysAgo(new Date("2026-10-11T02:00:00Z"), 0).toISOString()).toBe("2026-10-10T04:00:00.000Z");
  });
  it("is DST-safe across the Nov 1 2026 change", () => {
    // Nov 4 minus 6 days = Oct 29 (EDT, -04)
    expect(nyMidnightDaysAgo(new Date("2026-11-04T15:00:00Z"), 6).toISOString()).toBe("2026-10-29T04:00:00.000Z");
    // Nov 2 minus 1 day = Nov 1 (EST after 02:00 fallback; midnight is still EDT)
    expect(nyMidnightDaysAgo(new Date("2026-11-02T15:00:00Z"), 1).toISOString()).toBe("2026-11-01T04:00:00.000Z");
    // Nov 2 itself is EST (-05)
    expect(nyMidnightDaysAgo(new Date("2026-11-02T15:00:00Z"), 0).toISOString()).toBe("2026-11-02T05:00:00.000Z");
    // Nov 8 minus 6 = Nov 2 (EST)
    expect(nyMidnightDaysAgo(new Date("2026-11-08T15:00:00Z"), 6).toISOString()).toBe("2026-11-02T05:00:00.000Z");
  });
});
