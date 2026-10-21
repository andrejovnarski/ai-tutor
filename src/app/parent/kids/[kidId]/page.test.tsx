import { renderToStaticMarkup } from "react-dom/server";
import { vi } from "vitest";
import { CLUSTERS } from "@/domain/curriculum";

vi.mock("server-only", () => ({}));
vi.mock("next/font/google", () => ({ Atkinson_Hyperlegible: () => ({ variable: "atk" }) }));
vi.mock("@/server/parentGate", () => ({ requireParent: async () => ({ supabase: {} }) }));
vi.mock("@/server/parentSummary", () => ({ kidWeek: vi.fn(async () => null) }));
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

async function markup(sessionCount: number, hasSkills = true) {
  vi.mocked(exportKid).mockResolvedValue({
    kid: { nickname: "Mia", avatar: "cat", grade: "K" },
    skill_state: hasSkills ? CLUSTERS.flatMap(c => c.skills.map(s => ({ skill_id: s.id, attempts: 3, p_known: 0.4, level: 1, recent_tags: ["off-by-ten"], mastered_at: null, last_seen: "2026-10-20", placed: false }))) : [],
    attempts: [], distress_flags: [],
    sessions: Array.from({ length: sessionCount }, (_, i) => ({ id: String(i), started_at: `2026-10-${String(i + 1).padStart(2, "0")}T12:00:00Z`, state: { problems: 1, mastered: [], firstTryCorrect: 1 } })),
  } as unknown as NonNullable<Awaited<ReturnType<typeof exportKid>>>);
  return renderToStaticMarkup(await KidPage({ params: Promise.resolve({ kidId: "kid" }), searchParams: Promise.resolve({}) }));
}
it("renders eight closed islands, at most three needs-hand rows and five open sessions", async () => {
  const html = await markup(30);
  const progress = html.split("<h2>Progress</h2>")[1]!.split("<h2>Sessions</h2>")[0]!;
  expect(progress.match(/<details\b/g)).toHaveLength(8);
  expect(progress).not.toMatch(/<details[^>]*\bopen/);
  expect(progress.match(/<summary[^>]*><b>/g)).toHaveLength(8);
  expect(progress.split("<details")[0]!.match(/<li\b/g)).toHaveLength(3);
  const sessions = html.split("<h2>Sessions</h2>")[1]!;
  expect(sessions.split("<details")[0]!.match(/<li\b/g)).toHaveLength(5);
  expect(sessions).toContain("Show 25 older sessions");
  expect(sessions.match(/<li\b/g)).toHaveLength(30);
  expect(sessions).not.toMatch(/<details[^>]*\bopen/);
});
it("uses singular older session and omits the fold for five sessions", async () => {
  expect(await markup(6)).toContain("Show 1 older session</summary>");
  expect(await markup(5)).not.toContain("older session");
});
it("preserves the empty progress message and omits needs-hand and island folds", async () => {
  const html = await markup(0, false);
  expect(html).toContain("Nothing yet. Skills show up here once Mia has played a little more.");
  expect(html).not.toContain("Needs a hand");
  expect(html).not.toContain("<details");
  expect(html).toContain("No sessions yet.");
});


it("passes the week's current skill to the island summary and missing-row status", async () => {
  const { kidWeek } = await import("@/server/parentSummary");
  const current = CLUSTERS[2]!.skills[0]!;
  vi.mocked(exportKid).mockResolvedValueOnce({
    kid: { id: "k1", nickname: "Mia", grade: "K", age_band: "5-7", avatar: "fox", placed: true, created_at: "2026-10-01T00:00:00Z" },
    skill_state: [{ skill_id: CLUSTERS[0]!.skills[0]!.id, attempts: 1, p_known: 0.4, level: 1, recent_tags: [], mastered_at: null, last_seen: "2026-10-20", placed: false }],
    style_stats: [], distress_flags: [], sessions: [], attempts: [],
  });
  vi.mocked(kidWeek).mockResolvedValueOnce({
    week: { nickname: "Mia", sessions: 1, minutes: 1, mastered: [], currentSkill: current.name, stuck: [] },
    playedDays: ["2026-10-20"],
  });
  const html = renderToStaticMarkup(await KidPage({ params: Promise.resolve({ kidId: "kid" }), searchParams: Promise.resolve({}) }));
  expect(html).toContain(`0 of ${CLUSTERS[2]!.skills.length} learned · working on ${current.name}`);
  expect(html).toMatch(new RegExp(`<b>${current.name}</b><span[^>]*>Working on it</span>`));
});
