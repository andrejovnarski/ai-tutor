import { renderToStaticMarkup } from "react-dom/server";
import { vi } from "vitest";
import { progress } from "@/domain/rewards/progress";

const kids = [
  { id: "k1", nickname: "Mia", avatar: "fox", grade: "K" },
  { id: "k2", nickname: "Alexandrina", avatar: "owl", grade: "1" },
];
const db = { from: (table: string) => ({ select: () => ({
  eq: () => ({ single: async () => ({ data: { consent_at: "2026-10-01" } }) }),
  order: async () => ({ data: table === "kids" ? kids : [] }),
}) }) };
vi.mock("server-only", () => ({}));
vi.mock("next/font/google", () => ({ Atkinson_Hyperlegible: () => ({ variable: "atk" }) }));
vi.mock("@/server/parentGate", () => ({ requireParent: async () => ({ supabase: db, user: { id: "p1" } }) }));
vi.mock("@/server/parentSummary", () => ({
  lastPlayed: async () => new Map(), lastPlayedLabel: () => "Not yet",
}));
vi.mock("@/server/rewards", () => ({ kidProgress: vi.fn() }));
const { kidProgress } = await import("@/server/rewards");
const { default: ParentPage } = await import("./page");

it.each([true, false])("renders each kid with optional hidden mini map (%s)", async (available) => {
  vi.mocked(kidProgress).mockReset();
  vi.mocked(kidProgress).mockImplementation(async (_, id) =>
    available ? progress([], id === "k1" ? { "count-to-20.count": 1 } : {}, Date.now()) : null);
  const html = renderToStaticMarkup(await ParentPage());
  for (const kid of kids) {
    expect(html).toContain(kid.nickname);
    expect(html).toContain(`href="/parent/kids/${kid.id}"`);
    expect(kidProgress).toHaveBeenCalledWith(db, kid.id, expect.any(Number));
  }
  expect(kidProgress).toHaveBeenCalledTimes(2);
  const cards = html.match(/<a [^>]*href="\/parent\/kids\/k[12]"[\s\S]*?<\/a>/g)!;
  expect(cards).toHaveLength(2);
  for (const card of cards) {
    if (available) {
      expect(card).toMatch(/<span[^>]*aria-hidden="true"[^>]*><svg[^>]*aria-label="Map:/);
      expect(card).not.toContain("figcaption");
      expect(card).not.toMatch(/data-rise|data-sail/);
    } else expect(card).not.toContain("<svg");
  }
});
