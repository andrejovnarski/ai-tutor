import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { lastPlayedLabel } = await import("./parentSummary");

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
