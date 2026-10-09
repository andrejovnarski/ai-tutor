import { firstSkills, placedKid } from "../../domain/session/testkit";
import { startSession } from "../../domain/session/engine";
import { MemoryRepo } from "./repo";

const kid = placedKid(firstSkills(3));
const setup = () => {
  const repo = new MemoryRepo();
  repo.addKid(kid);
  return repo;
};

it("returns null for an unknown kid", async () => {
  const repo = setup();
  expect(await repo.loadKid("nope")).toBeNull();
  expect(await repo.openSession("nope")).toBeNull();
});

it("allows one open session per kid and bumps the version on save", async () => {
  const repo = setup();
  const s = await repo.createSession(kid.kidId, startSession(kid, 1, 0));
  expect(s.version).toBe(0);
  await expect(repo.createSession(kid.kidId, startSession(kid, 2, 0))).rejects.toThrow();
  expect(await repo.saveStep(s, s.state, false, null)).toBe(1);
  expect((await repo.openSession(kid.kidId))!.version).toBe(1);
});

it("returns -1 and writes nothing on a stale version", async () => {
  const repo = setup();
  const s = await repo.createSession(kid.kidId, startSession(kid, 1, 0));
  await repo.saveStep(s, s.state, false, null);
  const attempt = { kidId: kid.kidId, skillId: "x", templateId: "t", seed: 1, level: 1 as const, answer: 1, result: "correct" as const,
    mistakeTag: null, style: null, timeMs: 1, at: 1, try: 1 as const, mode: "practice" as const };
  const writes = { kidId: kid.kidId, attempts: [attempt], skillStates: [], styleStats: [], kidPlaced: true as const };
  expect(await repo.saveStep(s, s.state, true, writes)).toBe(-1);
  expect(repo.attempts).toHaveLength(0);
  expect((await repo.openSession(kid.kidId))!.version).toBe(1);
});

it("closes the session when ended, which frees the kid for a new one", async () => {
  const repo = setup();
  const s = await repo.createSession(kid.kidId, startSession(kid, 1, 0));
  await repo.saveStep(s, s.state, true, null);
  expect(await repo.openSession(kid.kidId)).toBeNull();
  await repo.createSession(kid.kidId, startSession(kid, 2, 0));
});
