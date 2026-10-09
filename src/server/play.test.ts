import { firstSkills, placedKid } from "../domain/session/testkit";
import { startSession } from "../domain/session/engine";
import { MemoryRepo } from "./persist/repo";
import { playAnswer, playTurn, type AnswerResult, type TurnResult } from "./play";

const kid = placedKid(firstSkills(3));
const seed = () => 42;
const setup = () => {
  const repo = new MemoryRepo();
  repo.addKid(kid);
  return repo;
};
const pendingAnswer = (repo: MemoryRepo) => repo.sessions.find((s) => !s.ended)!.state.pending!.problem.answer;
const ok = <T extends { status: number }>(r: T) => r as Extract<T, { status: 200 }>;

it("plays a first turn at version 1 and takes an answer to version 2", async () => {
  const repo = setup();
  const t = ok(await playTurn(repo, kid.kidId, 1000, seed));
  expect(t.status).toBe(200);
  expect(t.version).toBe(1);
  expect(t.turn.kind).toBe("problem");
  const a = ok(await playAnswer(repo, kid.kidId, 1, pendingAnswer(repo), 5000, seed));
  expect(a.status).toBe(200);
  expect(a.version).toBe(2);
  expect(repo.attempts).toHaveLength(1);
  expect(a.feedback.result.kind).toBe("correct");
  expect("revealed" in a).toBe(false);
});

it("answers 409 with the current turn on a replayed version and stores nothing more", async () => {
  const repo = setup();
  await playTurn(repo, kid.kidId, 1000, seed);
  const right = pendingAnswer(repo);
  await playAnswer(repo, kid.kidId, 1, right, 5000, seed);
  const again = await playAnswer(repo, kid.kidId, 1, right, 6000, seed);
  expect(again.status).toBe(409);
  if (again.status === 409) {
    expect(again.version).toBe(2);
    expect(again.turn.kind).toBe("problem");
  }
  expect(repo.attempts).toHaveLength(1);
});

it("lets exactly one of two racing answers win", async () => {
  const repo = setup();
  await playTurn(repo, kid.kidId, 1000, seed);
  const right = pendingAnswer(repo);
  const results = await Promise.all([
    playAnswer(repo, kid.kidId, 1, right, 5000, seed),
    playAnswer(repo, kid.kidId, 1, right, 5000, seed),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(repo.attempts).toHaveLength(1);
});

it("resumes the same problem without bumping the version", async () => {
  const repo = setup();
  const a = ok(await playTurn(repo, kid.kidId, 1000, seed));
  const b = ok(await playTurn(repo, kid.kidId, 2000, seed));
  expect(b.version).toBe(a.version);
  expect(b.turn).toEqual(a.turn);
});

it("starts a new session after the old one ended", async () => {
  const repo = setup();
  await repo.createSession(kid.kidId, { ...startSession(kid, 1, 0), ended: true });
  const t = ok(await playTurn(repo, kid.kidId, 1000, seed));
  expect(t.turn.kind).toBe("problem");
  expect(t.version).toBe(1);
  expect(repo.sessions).toHaveLength(2);
  expect(repo.sessions.filter((s) => s.ended)).toHaveLength(1);
});

it("rolls over to a new session when an answer ends the old one", async () => {
  const repo = setup();
  await playTurn(repo, kid.kidId, 1000, seed);
  const a = ok(await playAnswer(repo, kid.kidId, 1, pendingAnswer(repo), 1000 + 12 * 60_000, seed));
  // 12 minutes in (5-7 band: 10 to 15) after a right answer, the engine ends the session.
  expect(a.next.kind).toBe("problem");
  expect(repo.sessions).toHaveLength(2);
  expect(repo.sessions.filter((s) => !s.ended)).toHaveLength(1);
  expect(a.version).toBe(1);
});

it("returns 404 for an unknown kid", async () => {
  const repo = setup();
  expect(await playTurn(repo, "nope", 0, seed)).toEqual({ status: 404 });
  expect(await playAnswer(repo, "nope", 1, 1, 0, seed)).toEqual({ status: 404 });
});

it("reveals the answer after a second wrong try, and not after the first", async () => {
  const repo = setup();
  await playTurn(repo, kid.kidId, 1000, seed);
  const answer = pendingAnswer(repo);
  const first = ok(await playAnswer(repo, kid.kidId, 1, answer + 1000, 2000, seed));
  expect(first.feedback.then).toBe("retry");
  expect("revealed" in first).toBe(false);
  const second = ok(await playAnswer(repo, kid.kidId, first.version, answer + 1000, 3000, seed));
  expect(second.feedback.reveal).toBe(true);
  expect(second.revealed).toBe(answer);
});

const LEAK = /"(answer|mistakes|templateId|seed)"\s*:/;

it("never leaks answers, mistakes or template data to the browser", async () => {
  const repo = setup();
  const results: (TurnResult | AnswerResult)[] = [];
  results.push(await playTurn(repo, kid.kidId, 1000, seed));
  const answer = pendingAnswer(repo);
  const first = await playAnswer(repo, kid.kidId, 1, answer + 1000, 2000, seed);
  results.push(first);
  results.push(await playAnswer(repo, kid.kidId, ok(first).version, answer + 1000, 3000, seed));
  results.push(await playAnswer(repo, kid.kidId, 1, 0, 4000, seed)); // 409
  for (const r of results) expect(JSON.stringify(r)).not.toMatch(LEAK);
});

it("lets two racing first turns share one new session", async () => {
  const repo = setup();
  const [a, b] = await Promise.all([playTurn(repo, kid.kidId, 1000, seed), playTurn(repo, kid.kidId, 1000, seed)]);
  expect(a.status).toBe(200);
  expect(b.status).toBe(200);
  expect(ok(a).turn).toEqual(ok(b).turn);
  expect(repo.sessions.filter((s) => !s.ended)).toHaveLength(1);
});
