import { firstSkills, placedKid } from "../domain/session/testkit";
import { startSession } from "../domain/session/engine";
import { MemoryRepo } from "./persist/repo";
import { playAnswer, playSay, playTurn, type AnswerResult, type TurnResult } from "./play";

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
  // The ended session was saved at version 1; the new one continues from there.
  expect(t.version).toBe(2);
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
  // Versions are monotonic per kid: the new session continues from the old one's final version (2).
  expect(a.version).toBe(3);
});

it("rejects a stale answer from the previous session after a rollover (two tablets)", async () => {
  const repo = setup();
  const a = ok(await playTurn(repo, kid.kidId, 1000, seed));
  const b = ok(await playTurn(repo, kid.kidId, 1000, seed));
  expect(b.version).toBe(a.version);
  const right = pendingAnswer(repo);
  // Tablet B answers and ends the session; play rolls over into a new one.
  const won = ok(await playAnswer(repo, kid.kidId, b.version, right, 1000 + 12 * 60_000, seed));
  expect(repo.sessions).toHaveLength(2);
  // Tablet A still holds the old version.
  const stale = await playAnswer(repo, kid.kidId, a.version, right, 1000 + 12 * 60_000 + 1, seed);
  expect(stale.status).toBe(409);
  if (stale.status === 409) expect(stale.version).toBe(won.version);
  expect(repo.attempts.filter((x) => x.session_id === "session-2")).toHaveLength(0);
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

it("throws a clear error when no current turn can be had, instead of crashing on null", async () => {
  const repo = setup();
  // A repo that never sees an open session and always loses the create race.
  repo.openSession = async () => null;
  repo.createSession = async () => null;
  await expect(playTurn(repo, kid.kidId, 1000, seed)).rejects.toThrow(/no current turn/);
});

describe("tutor lines", () => {
  type Plan = import("./tutor/types").TurnPlan;
  const recorder = () => {
    const plans: { plan: Plan; seed: number }[] = [];
    const speak = async (plan: Plan, seed: number) => {
      plans.push({ plan, seed });
      return { say: `${plan.event} {name} #${plans.length}`, tone: "calm" as const };
    };
    return { plans, speak };
  };
  const stored = (repo: MemoryRepo) => repo.sessions.find((s) => !s.ended)!.state as { tutorRecent?: string[] };

  it("a problem turn carries a present line; resuming reuses it without a speak call or a write", async () => {
    const repo = setup();
    const r = recorder();
    const t = ok(await playTurn(repo, kid.kidId, 1000, seed, r.speak));
    expect(t.line?.say).toBe("present {name} #1");
    expect(r.plans[0]!.plan.event).toBe("present");
    expect(r.plans[0]!.plan.recentLines).toEqual([]);
    expect(stored(repo).tutorRecent).toEqual(["present {name} #1"]);
    const before = JSON.stringify(repo.sessions);
    const again = ok(await playTurn(repo, kid.kidId, 2000, seed, r.speak));
    const third = ok(await playTurn(repo, kid.kidId, 3000, seed, r.speak));
    expect(r.plans).toHaveLength(1); // two resumes, zero extra speak calls
    expect(again.version).toBe(t.version);
    expect(again.line).toEqual(t.line);
    expect(third.line).toEqual(t.line);
    expect(JSON.stringify(repo.sessions)).toBe(before); // no write on a resume
  });

  it("resuming or a 409 on a retry's problem (try 2) gives back the stored wrong line", async () => {
    const repo = setup();
    const r = recorder();
    await playTurn(repo, kid.kidId, 1000, seed, r.speak);
    const answer = pendingAnswer(repo);
    const first = ok(await playAnswer(repo, kid.kidId, 1, answer + 1000, 2000, seed, r.speak));
    expect(first.feedback.then).toBe("retry");
    const calls = r.plans.length;
    const resumed = ok(await playTurn(repo, kid.kidId, 3000, seed, r.speak));
    expect(resumed.line).toEqual(first.line);
    const stale = await playAnswer(repo, kid.kidId, 1, answer, 4000, seed, r.speak);
    expect(stale.status).toBe(409);
    if (stale.status === 409) expect(stale.line).toEqual(first.line);
    expect(r.plans.length).toBe(calls);
  });

  it("a shown problem with no stored line (an older session) speaks a present line", async () => {
    const repo = setup();
    const r = recorder();
    await playTurn(repo, kid.kidId, 1000, seed, r.speak);
    const s = repo.sessions.find((x) => !x.ended)!.state as { tutorRecent?: string[]; tutorLine?: unknown };
    delete s.tutorRecent;
    delete s.tutorLine;
    const again = ok(await playTurn(repo, kid.kidId, 2000, seed, r.speak));
    expect(again.line?.say).toBe("present {name} #2");
  });

  it("an answer carries the feedback line and the next present line, both saved in the same step", async () => {
    const repo = setup();
    const r = recorder();
    await playTurn(repo, kid.kidId, 1000, seed, r.speak);
    const a = ok(await playAnswer(repo, kid.kidId, 1, pendingAnswer(repo), 5000, seed, r.speak));
    expect(a.version).toBe(2);
    expect(a.line.say).toMatch(/^(correct|celebrate) /);
    expect(a.nextLine?.say).toMatch(/^present /);
    expect(stored(repo).tutorRecent).toEqual(["present {name} #1", a.line.say, a.nextLine!.say]);
    // both lines were asked for with the recent lines from before the answer
    expect(r.plans.slice(1).map((p) => p.plan.recentLines)).toEqual([["present {name} #1"], ["present {name} #1"]]);
  });

  it("keeps only the last 3 raw lines, and a wrong answer gives wrong then explain", async () => {
    const repo = setup();
    const r = recorder();
    await playTurn(repo, kid.kidId, 1000, seed, r.speak);
    const answer = pendingAnswer(repo);
    const first = ok(await playAnswer(repo, kid.kidId, 1, answer + 1000, 2000, seed, r.speak));
    expect(first.line.say).toMatch(/^wrong /);
    const second = ok(await playAnswer(repo, kid.kidId, first.version, answer + 1000, 3000, seed, r.speak));
    expect(second.line.say).toMatch(/^explain /);
    expect(stored(repo).tutorRecent).toHaveLength(3);
    // The retry added only its wrong line: [present, wrong, explain, present] keeps the last 3.
    expect(stored(repo).tutorRecent).toEqual([first.line.say, second.line.say, second.nextLine!.say]);
  });

  it("a wrong first try (retry) keeps the same problem: no nextLine, exactly one speak call", async () => {
    const repo = setup();
    const r = recorder();
    await playTurn(repo, kid.kidId, 1000, seed, r.speak);
    const before = r.plans.length;
    const first = ok(await playAnswer(repo, kid.kidId, 1, pendingAnswer(repo) + 1000, 2000, seed, r.speak));
    expect(first.feedback.then).toBe("retry");
    expect(first.line.say).toMatch(/^wrong /);
    expect("nextLine" in first).toBe(false);
    expect(r.plans.length - before).toBe(1);
    expect(stored(repo).tutorRecent).toEqual(["present {name} #1", first.line.say]);
  });

  it("a 409 carries the line for its current turn and saves nothing", async () => {
    const repo = setup();
    const r = recorder();
    await playTurn(repo, kid.kidId, 1000, seed, r.speak);
    const right = pendingAnswer(repo);
    await playAnswer(repo, kid.kidId, 1, right, 5000, seed, r.speak);
    const before = JSON.stringify(stored(repo));
    const again = await playAnswer(repo, kid.kidId, 1, right, 6000, seed, r.speak);
    expect(again.status).toBe(409);
    if (again.status === 409) expect(again.line?.say).toMatch(/^present /);
    expect(JSON.stringify(stored(repo))).toBe(before);
  });

  it("seeds vary per line so canned lines rotate", async () => {
    const repo = setup();
    const r = recorder();
    await playTurn(repo, kid.kidId, 1000, seed, r.speak);
    let v = 1;
    for (let i = 0; i < 3; i++) v = ok(await playAnswer(repo, kid.kidId, v, pendingAnswer(repo), 2000 + i, seed, r.speak)).version;
    const seeds = r.plans.filter((p) => p.plan.event === "present").map((p) => p.seed);
    expect(new Set(seeds).size).toBe(seeds.length);
    for (const s of r.plans.map((p) => p.seed)) expect(Number.isFinite(s)).toBe(true);
  });

  it("defaults to canned lines when no speaker is given", async () => {
    const repo = setup();
    const t = ok(await playTurn(repo, kid.kidId, 1000, seed));
    expect(t.line?.say.length).toBeGreaterThan(0);
  });
});

describe("kid said", () => {
  it("steers back with a kid-said line about the current problem and writes nothing", async () => {
    const repo = setup();
    await playTurn(repo, kid.kidId, 1000, seed);
    const before = JSON.stringify(repo.sessions);
    const plans: import("./tutor/types").TurnPlan[] = [];
    const line = await playSay(repo, kid.kidId, "tell me a joke", 5, async (p) => {
      plans.push(p);
      return { say: "Back to it, {name}!", tone: "calm" };
    });
    expect(line?.say).toBe("Back to it, {name}!");
    expect(plans[0]!.event).toBe("kid-said");
    expect(plans[0]!.problem).toBe(repo.sessions[0]!.state.pending!.problem.prompt.say);
    expect(JSON.stringify(repo.sessions)).toBe(before);
  });

  it("with no open problem still steers back with a canned line", async () => {
    const repo = setup();
    const line = await playSay(repo, kid.kidId, "hi", 0);
    expect(line?.say.length).toBeGreaterThan(0);
    expect(repo.sessions).toHaveLength(0);
  });

  it("is null for an unknown kid", async () => {
    expect(await playSay(setup(), "nope", "hi", 0)).toBeNull();
  });
});
