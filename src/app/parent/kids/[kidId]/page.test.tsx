import { renderToStaticMarkup } from "react-dom/server";
import { vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/font/google", () => ({ Atkinson_Hyperlegible: () => ({ variable: "atk" }) }));
vi.mock("@/server/parentGate", () => ({ requireParent: async () => ({ supabase: {} }) }));
vi.mock("@/server/parentSummary", () => ({ kidWeek: async () => null }));
vi.mock("@/server/rewards", () => ({ kidProgress: vi.fn(async () => null) }));
vi.mock("@/server/rights", () => ({ exportKid: vi.fn() }));
vi.mock("./actions", () => ({ deleteKidAction: async () => {} }));

const { exportKid } = await import("@/server/rights");
const { default: KidPage } = await import("./page");

it.each([0, 1, 2])("shows the session help count with the right plural, hiding zero (%i)", async (helped) => {
  vi.mocked(exportKid).mockResolvedValue({
    kid: { id: "k1", nickname: "Mia", grade: "K", age_band: "5-7", avatar: "fox", placed: true, created_at: "2026-10-01T00:00:00Z" },
    skill_state: [], style_stats: [], distress_flags: [],
    sessions: [{ id: "s1", started_at: "2026-10-18T20:00:00Z", state: { problems: 1, firstTryCorrect: 0, mastered: ["add-subtract-within-100.add"] } }],
    attempts: Array.from({ length: helped }, () => ({ session_id: "s1", result: "helped", answer: null, time_ms: 1_000, at: "2026-10-18T20:00:10Z" })),
  });
  const html = renderToStaticMarkup(await KidPage({ params: Promise.resolve({ kidId: "k1" }), searchParams: Promise.resolve({}) }));
  expect(html).toContain("1 problem, 0 right first time");
  expect(html).toContain("Learned: Add without regrouping");
  if (helped === 0) {
    expect(html).not.toContain("Asked for help");
  } else {
    expect(html).toContain(`Asked for help ${helped} ${helped === 1 ? "time" : "times"}</span>`);
  }
});

it.each([true, false])("shows the islands card first only with progress (%s)", async (available) => {
  const { kidProgress } = await import("@/server/rewards");
  const { progress } = await import("@/domain/rewards/progress");
  vi.mocked(kidProgress).mockResolvedValue(available ? progress([], {}, Date.now()) : null);
  vi.mocked(exportKid).mockResolvedValue({
    kid: { id: "k1", nickname: "Mia", grade: "K", age_band: "5-7", avatar: "fox", placed: true, created_at: "2026-10-01T00:00:00Z" },
    skill_state: [], style_stats: [], distress_flags: [], sessions: [], attempts: [],
  });
  const html = renderToStaticMarkup(await KidPage({ params: Promise.resolve({ kidId: "k1" }), searchParams: Promise.resolve({}) }));
  if (available) {
    expect(html).toContain("Mia&#x27;s islands");
    expect(html.indexOf("Mia&#x27;s islands")).toBeLessThan(html.indexOf("<h2>Rewards"));
    expect(html.indexOf("Mia&#x27;s islands")).toBeLessThan(html.indexOf("<h2>Progress"));
  } else {
    expect(html).not.toContain("islands");
    expect(html).not.toContain("<figure");
    expect(html).toContain("<h2>Progress");
  }
});
