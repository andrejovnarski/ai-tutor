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
  const s = (await repo.createSession(kid.kidId, startSession(kid, 1, 0)))!;
  expect(s.version).toBe(0);
  expect(await repo.createSession(kid.kidId, startSession(kid, 2, 0))).toBeNull();
  expect(await repo.saveStep(s, s.state, false, null)).toBe(1);
  expect((await repo.openSession(kid.kidId))!.version).toBe(1);
});

it("returns -1 and writes nothing on a stale version", async () => {
  const repo = setup();
  const s = (await repo.createSession(kid.kidId, startSession(kid, 1, 0)))!;
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
  const s = (await repo.createSession(kid.kidId, startSession(kid, 1, 0)))!;
  await repo.saveStep(s, s.state, true, null);
  expect(await repo.openSession(kid.kidId)).toBeNull();
  await repo.createSession(kid.kidId, startSession(kid, 2, 0));
});

it("returns -1 and writes nothing when the session already ended", async () => {
  const repo = setup();
  const s = (await repo.createSession(kid.kidId, startSession(kid, 1, 0)))!;
  expect(await repo.saveStep(s, s.state, true, null)).toBe(1);
  const attempt = { kidId: kid.kidId, skillId: "x", templateId: "t", seed: 1, level: 1 as const, answer: 1, result: "correct" as const,
    mistakeTag: null, style: null, timeMs: 1, at: 1, try: 1 as const, mode: "practice" as const };
  const writes = { kidId: kid.kidId, attempts: [attempt], skillStates: [], styleStats: [], kidPlaced: true as const };
  expect(await repo.saveStep({ ...s, version: 1 }, s.state, false, writes)).toBe(-1);
  expect(repo.attempts).toHaveLength(0);
});

it("starts a new session at the kid's previous final version, so versions never repeat", async () => {
  const repo = setup();
  const s = (await repo.createSession(kid.kidId, startSession(kid, 1, 0)))!;
  await repo.saveStep(s, s.state, false, null);
  await repo.saveStep({ ...s, version: 1 }, s.state, true, null);
  const next = (await repo.createSession(kid.kidId, startSession(kid, 2, 0)))!;
  expect(next.version).toBe(2);
  expect((await repo.openSession(kid.kidId))!.version).toBe(2);
});

it("writes rows for the session's own kid, not the kid id in the writes", async () => {
  const repo = setup();
  const other = { ...kid, kidId: "other-kid" };
  repo.addKid(other);
  const s = (await repo.createSession(kid.kidId, startSession(kid, 1, 0)))!;
  const st = Object.values(kid.skills)[0]!;
  const writes = { kidId: other.kidId, attempts: [], skillStates: [{ ...st, attempts: 99 }], styleStats: [] };
  expect(await repo.saveStep(s, s.state, false, writes)).toBe(1);
  expect((await repo.loadKid(kid.kidId))!.skills[st.skillId]!.attempts).toBe(99);
  expect((await repo.loadKid(other.kidId))!.skills[st.skillId]!.attempts).toBe(st.attempts);
});
