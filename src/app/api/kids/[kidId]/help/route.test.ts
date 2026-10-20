import { vi } from "vitest";
vi.mock("@/server/playApi", () => ({
  parentRepo: vi.fn(async () => null),
  badRequest: () => Response.json({ error: "bad request" }, { status: 400 }),
  notFound: () => Response.json({ error: "not found" }, { status: 404 }),
  nicknameOrNull: async () => "Mia",
  novaSpeak: () => undefined,
  seed: () => 42,
  forKid: (line: unknown) => line,
  withRewards: async (turn: unknown) => turn,
  tryAgain: () => Response.json({ error: "try again" }, { status: 503 }),
}));
vi.mock("@/server/play", () => ({ playHelp: vi.fn() }));
import { parentRepo } from "@/server/playApi";
import { playHelp } from "@/server/play";
import { POST } from "./route";
const call = (body: unknown) => POST(new Request("http://localhost/api/kids/k/help", {
  method: "POST", body: JSON.stringify(body),
}), { params: Promise.resolve({ kidId: "k" }) });
beforeEach(() => {
  vi.mocked(parentRepo).mockResolvedValue(null);
  vi.mocked(playHelp).mockReset();
});
it.each([{}, { version: -1 }, { version: 1.5 }, { version: "1" }, null])("rejects invalid version %j", async body => {
  expect((await call(body)).status).toBe(400);
});
it("returns 404 when signed out", async () => {
  expect((await call({ version: 0 })).status).toBe(404);
});
it("returns 404 for another family's kid and 503 for a server failure", async () => {
  vi.mocked(parentRepo).mockResolvedValue({} as NonNullable<Awaited<ReturnType<typeof parentRepo>>>);
  vi.mocked(playHelp).mockResolvedValue({ status: 404 });
  expect((await call({ version: 0 })).status).toBe(404);
  vi.mocked(playHelp).mockRejectedValue(new Error("unavailable"));
  expect((await call({ version: 0 })).status).toBe(503);
});
it("returns the current turn on 409", async () => {
  vi.mocked(parentRepo).mockResolvedValue({} as NonNullable<Awaited<ReturnType<typeof parentRepo>>>);
  const turn = { kind: "end" as const, summary: { problems: 1, firstTryCorrect: 0, minutes: 1, mastered: [] }, progress: { today: null, next: null } };
  vi.mocked(playHelp).mockResolvedValue({ status: 409, version: 2, turn });
  const r = await call({ version: 1 });
  expect(r.status).toBe(409);
  expect(await r.json()).toEqual({ version: 2, turn });
});
it("returns help feedback and the worked answer without engine logs", async () => {
  vi.mocked(parentRepo).mockResolvedValue({} as NonNullable<Awaited<ReturnType<typeof parentRepo>>>);
  const next = { kind: "problem" as const, mode: "practice" as const, try: 2 as const, help: 2 as const,
    prompt: { say: "How many?", show: { kind: "equation" as const, text: "3 + 4 = ?" } },
    input: "number-pad" as const };
  const line = { say: "The answer is 7.", tone: "calm" as const };
  vi.mocked(playHelp).mockResolvedValue({ status: 200, version: 3, next, line, revealed: 7,
    feedback: { result: { kind: "helped" }, then: "retry", style: null, reveal: true, mastered: [], logs: [] } });
  const r = await call({ version: 2 });
  expect(r.status).toBe(200);
  const body = await r.json();
  expect(body).toMatchObject({ version: 3, next, line, revealed: 7, feedback: { result: { kind: "helped" } } });
  expect(body.feedback.logs).toBeUndefined();
});
