import { renderToStaticMarkup } from "react-dom/server";
import { vi } from "vitest";
import { progress } from "@/domain/rewards/progress";

const fixture = vi.hoisted(() => ({ progress: null as unknown }));
vi.mock("@/server/parentGate", () => ({
  requireUser: async () => ({ supabase: { from: () => ({ select: () => ({
    order: async () => ({ data: [{ id: "kid1", nickname: "Theo", avatar: "owl" }] }),
  }) }) } }),
}));
vi.mock("@/server/rewards", () => ({ kidProgress: async () => fixture.progress }));
import HomePage from "./page";

it.each([false, true])("picker keeps the nickname first with progress available: %s", async (available) => {
  fixture.progress = available ? progress([], {}, Date.UTC(2026, 9, 19)) : null;
  const html = renderToStaticMarkup(await HomePage());
  const card = html.match(/<a[^>]*href="\/play\/kid1"[^>]*>(.*?)<\/a>/)?.[1] ?? "";
  const accessible = card.replace(/<span aria-hidden="true"[^>]*>.*?<\/span>/, "").replace(/<[^>]*>/g, "");
  expect(accessible).toMatch(/^Theo/);
  expect(card).toContain("data-picker-name");
  expect(card.includes('aria-label="Map:')).toBe(available);
  if (!available) expect(accessible).toBe("Theo");
});
