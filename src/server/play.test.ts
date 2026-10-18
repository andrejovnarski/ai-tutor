import { firstSkills, placedKid } from "../domain/session/testkit";
import { startSession } from "../domain/session/engine";
import type { Pending } from "../domain/session/types";
import { styleView } from "../domain/problems/styleView";
import { MemoryRepo } from "./persist/repo";
import type { PublicTurn } from "./publicTurn";
import { playAgain, playAnswer, playSay, playTurn, type AnswerResult, type TurnResult } from "./play";

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

const MIN = 60_000;
const HOUR = 60 * MIN;
const openSessions = (repo: MemoryRepo) => repo.sessions.filter((s) => !s.ended);
/** Plays one problem and answers it right 12 minutes in: in the 5-7 band (10 to 15) the engine ends the session. */
const finish = async (repo: MemoryRepo, end: number) => {
  const t = ok(await playTurn(repo, kid.kidId, end - 12 * MIN, seed));
  const right = pendingAnswer(repo);
  return { right, version: t.version, a: ok(await playAnswer(repo, kid.kidId, t.version, right, end, seed)) };
};
// 2026-10-19 is EDT (UTC-4).
const TODAY = Date.parse("2026-10-19T14:00:00Z");

it("an answer that ends the session returns the end card and opens no new session", async () => {
  const repo = setup();
  const { a } = await finish(repo, TODAY);
  expect(a.next.kind).toBe("end");
  if (a.next.kind === "end") expect(a.next.summary.problems).toBeGreaterThanOrEqual(1);
  expect(a.version).toBe(2);
  expect(openSessions(repo)).toHaveLength(0);
});

it("opening play later the same New York day shows the same end card", async () => {
  const repo = setup();
  const { a } = await finish(repo, TODAY);
  const t = ok(await playTurn(repo, kid.kidId, TODAY + 3 * HOUR, seed));
  expect(t.turn).toEqual(a.next);
  expect(t.version).toBe(a.version);
  expect("line" in t).toBe(false);
  expect(repo.sessions).toHaveLength(1);
});

it.each([
  ["summer (EDT)", "2026-10-20T03:59:00Z", "2026-10-20T04:01:00Z"],
  ["winter (EST)", "2026-12-02T04:59:00Z", "2026-12-02T05:01:00Z"],
])("opening play the next New York day starts a fresh session: %s", async (_, last, next) => {
  const repo = setup();
  const { a } = await finish(repo, Date.parse(last));
  expect(a.next.kind).toBe("end");
  const t = ok(await playTurn(repo, kid.kidId, Date.parse(next), seed));
  expect(t.turn.kind).toBe("problem");
  expect(openSessions(repo)).toHaveLength(1);
});

it("an open session abandoned yesterday closes quietly and starts fresh", async () => {
  const repo = setup();
  await playTurn(repo, kid.kidId, TODAY - 18 * HOUR, seed); // 16:00 EDT yesterday, never answered
  const t = ok(await playTurn(repo, kid.kidId, TODAY, seed));
  expect(t.turn.kind).toBe("problem");
  expect(repo.sessions).toHaveLength(2);
  expect(repo.sessions[0]!.ended).toBe(true);
  expect(openSessions(repo)).toHaveLength(1);
});

it("an open session abandoned earlier today after an answer shows its end card", async () => {
  const repo = setup();
  const t0 = ok(await playTurn(repo, kid.kidId, TODAY, seed));
  await playAnswer(repo, kid.kidId, t0.version, pendingAnswer(repo), TODAY + MIN, seed);
  const t = ok(await playTurn(repo, kid.kidId, TODAY + 2 * HOUR, seed));
  expect(t.turn.kind).toBe("end");
  if (t.turn.kind === "end") expect(t.turn.summary.problems).toBe(1);
  expect(openSessions(repo)).toHaveLength(0);
  expect(await playTurn(repo, kid.kidId, TODAY + 3 * HOUR, seed)).toEqual(t);
});

it("an open session abandoned earlier today with no answers never shows an end card", async () => {
  const repo = setup();
  await playTurn(repo, kid.kidId, TODAY, seed);
  const t = ok(await playTurn(repo, kid.kidId, TODAY + 2 * HOUR, seed));
  expect(t.turn.kind).toBe("problem");
  expect(repo.sessions).toHaveLength(2);
  expect(repo.sessions[0]!.ended).toBe(true);
  expect(openSessions(repo)).toHaveLength(1);
});

it("with no open session, a session ended today with no answers starts fresh", async () => {
  const repo = setup();
  await playTurn(repo, kid.kidId, TODAY, seed);
  repo.sessions[0]!.ended = true;
  const t = ok(await playTurn(repo, kid.kidId, TODAY + MIN, seed));
  expect(t.turn.kind).toBe("problem");
  expect(repo.sessions).toHaveLength(2);
  expect(openSessions(repo)).toHaveLength(1);
});

it("play again starts exactly one session, also when two tablets race", async () => {
  const repo = setup();
  const { a } = await finish(repo, TODAY);
  const [x, y] = (await Promise.all([
    playAgain(repo, kid.kidId, TODAY + MIN, seed),
    playAgain(repo, kid.kidId, TODAY + MIN, seed),
  ])).map(ok);
  expect(x!.turn.kind).toBe("problem");
  expect(y!.turn.kind).toBe("problem");
  expect(y!.version).toBe(x!.version);
  // Versions are monotonic per kid: the new session continues from the old one's final version.
  expect(x!.version).toBeGreaterThan(a.version);
  expect(openSessions(repo)).toHaveLength(1);
});

it("play again on a session abandoned earlier today starts fresh, never the end card", async () => {
  const repo = setup();
  await playTurn(repo, kid.kidId, TODAY, seed);
  const t = ok(await playAgain(repo, kid.kidId, TODAY + 2 * HOUR, seed));
  expect(t.turn.kind).toBe("problem");
  expect(repo.sessions).toHaveLength(2);
  expect(openSessions(repo)).toHaveLength(1);
});

it("play again returns 404 for an unknown kid", async () => {
  expect(await playAgain(setup(), "nope", 0, seed)).toEqual({ status: 404 });
});

it("a repeated answer after the end creates nothing and gets the end card", async () => {
  const repo = setup();
  const { a, right, version } = await finish(repo, TODAY);
  const again = await playAnswer(repo, kid.kidId, version, right, TODAY + 1000, seed);
  expect(again.status).toBe(409);
  if (again.status === 409) {
    expect(again.turn).toEqual(a.next);
    expect(again.version).toBe(a.version);
  }
  expect(repo.sessions).toHaveLength(1);
  expect(repo.attempts).toHaveLength(1);
});

it("rejects a stale answer from an ended session with the end card (two tablets)", async () => {
  const repo = setup();
  const a = ok(await playTurn(repo, kid.kidId, TODAY - 12 * MIN, seed));
  const b = ok(await playTurn(repo, kid.kidId, TODAY - 12 * MIN, seed));
  expect(b.version).toBe(a.version);
  const right = pendingAnswer(repo);
  // Tablet B answers and ends the session.
  const won = ok(await playAnswer(repo, kid.kidId, b.version, right, TODAY, seed));
  expect(won.next.kind).toBe("end");
  // Tablet A still holds the old version.
  const stale = await playAnswer(repo, kid.kidId, a.version, right, TODAY + 1, seed);
  expect(stale.status).toBe(409);
  if (stale.status === 409) {
    expect(stale.version).toBe(won.version);
    expect(stale.turn).toEqual(won.next);
  }
  expect(repo.sessions).toHaveLength(1);
  expect(repo.attempts).toHaveLength(1);
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

describe("the retry board", () => {
  // Add within 5 is the frontier: its templates set `sum`, and none of its styles is story.
  const sumKid = placedKid(firstSkills(7));
  const sumRepo = () => {
    const repo = new MemoryRepo();
    repo.addKid(sumKid);
    return repo;
  };
  const stored = (repo: MemoryRepo) => repo.sessions.find((s) => !s.ended)!.state.pending!;
  const shown = (t: PublicTurn) => (t as Extract<PublicTurn, { kind: "problem" }>).prompt.show;

  it("after a wrong first try shows the chosen style, and a reload shows the same", async () => {
    const repo = sumRepo();
    const t = ok(await playTurn(repo, sumKid.kidId, 1000, seed));
    const original = shown(t.turn);
    const r = ok(await playAnswer(repo, sumKid.kidId, t.version, pendingAnswer(repo) + 1000, 2000, seed));
    const p = stored(repo);
    expect(p.problem.sum).toBeDefined();
    expect(p.style).not.toBeNull();
    const view = styleView(p.style!, p.problem.sum!) ?? original;
    expect(shown(r.next)).toEqual(view);
    expect(shown(ok(await playTurn(repo, sumKid.kidId, 3000, seed)).turn)).toEqual(view);
    expect(JSON.stringify(r)).not.toMatch(/"sum"\s*:/);
    expect(JSON.stringify(r.next)).not.toMatch(/"style"\s*:/);
  });

  it("an older session's pending problem with no sum and no style keeps its original picture", async () => {
    const repo = sumRepo();
    const t = ok(await playTurn(repo, sumKid.kidId, 1000, seed));
    await playAnswer(repo, sumKid.kidId, t.version, pendingAnswer(repo) + 1000, 2000, seed);
    const p: Partial<Pending> = stored(repo);
    delete p.style;
    delete p.problem!.sum;
    const reload = ok(await playTurn(repo, sumKid.kidId, 3000, seed));
    expect(reload.turn).toMatchObject({ kind: "problem", try: 2 });
    expect(shown(reload.turn)).toEqual(shown(t.turn));
  });
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
