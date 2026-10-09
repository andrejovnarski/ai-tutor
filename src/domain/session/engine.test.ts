import { getSkill } from "../curriculum/index";
import { newKidState } from "../kid/state";
import { answer, nextTurn, startSession } from "./engine";
import { MIN, SEC, firstSkills, fresh, generate, placedKid, play, rightFor, wrongFor, type ProblemTurn } from "./testkit";
import type { Session } from "./types";

const turnOf = (s: Session, now: number) => {
  const r = nextTurn(s, now);
  return { s: r.session, t: r.turn as ProblemTurn };
};

it("is deterministic", () => {
  const kid = newKidState("k", "5-7", "K");
  const a = play(startSession(kid, 3, 0), 0, (t, i) => (i % 4 === 0 ? wrongFor(t) : rightFor(t)));
  const b = play(startSession(kid, 3, 0), 0, (t, i) => (i % 4 === 0 ? wrongFor(t) : rightFor(t)));
  expect(b.steps).toEqual(a.steps);
});

it("resumes identically after a JSON round trip", () => {
  const pick = (t: ProblemTurn, i: number) => (i % 3 === 0 ? wrongFor(t) : rightFor(t));
  const whole = play(fresh(placedKid(firstSkills(4))), 0, pick);
  let s = fresh(placedKid(firstSkills(4)));
  let now = 0;
  const steps = [];
  for (let i = 0; i < 7; i++) {
    const r = turnOf(s, now);
    now += 20 * SEC;
    const a = answer(r.s, pick(r.t, i), now)!;
    steps.push({ turn: r.t, given: pick(r.t, i), feedback: a.feedback, writes: a.writes });
    s = a.session;
  }
  const pending = turnOf(s, now);
  const reloaded = JSON.parse(JSON.stringify(pending.s)) as Session;
  expect(turnOf(reloaded, now).t).toEqual(pending.t); // same pending problem after reload
  const rest = play(reloaded, now, (t, i) => pick(t, i + 7));
  expect([...steps, ...rest.steps]).toEqual(whole.steps);
});

it("first session places the kid in at most 10 problems", () => {
  const { steps } = play(startSession(newKidState("k", "5-7", "1"), 1, 0), 0, rightFor);
  const placement = steps.filter((x) => x.turn.kind === "problem" && x.turn.mode === "placement");
  expect(placement.length).toBeGreaterThan(0);
  expect(placement.length).toBeLessThanOrEqual(10);
  const last = placement.at(-1)!;
  expect(last.writes!.kidPlaced).toBe(true);
  const after = steps[placement.length]!;
  expect(after.turn.kind === "problem" && after.turn.mode).not.toBe("placement");
});

it("placement wrong answers are not explained or retried", () => {
  const { steps } = play(startSession(newKidState("k", "5-7", "K"), 1, 0), 0, wrongFor, { max: 12 });
  const p = steps.filter((x) => x.turn.kind === "problem" && x.turn.mode === "placement");
  for (const x of p) expect(x.feedback).toMatchObject({ then: "next", reveal: false, style: null });
});

describe("retry flow in practice", () => {
  const start = () => turnOf(fresh(placedKid(firstSkills(3))), 0);

  it("wrong, then wrong: explain, retry same problem, then reveal", () => {
    const { s, t } = start();
    expect(t.mode).toBe("practice");
    const a = answer(s, wrongFor(t), 10 * SEC)!;
    expect(a.feedback).toMatchObject({ then: "retry", reveal: false });
    expect(getSkill(t.skillId).styles).toContain(a.feedback.style);
    const again = turnOf(a.session, 11 * SEC);
    expect(again.t).toEqual({ ...t, try: 2 });
    const b = answer(again.s, wrongFor(again.t), 20 * SEC)!;
    expect(b.feedback).toMatchObject({ then: "next", reveal: true, style: a.feedback.style });
    expect(b.writes.styleStats).toEqual([{ ...a.session.kid.styles[a.feedback.style!], tries: 1, wins: 0 }]);
  });

  it("wrong, then right: style win; BKT counts the first try only", () => {
    const { s, t } = start();
    const a = answer(s, wrongFor(t), 10 * SEC)!;
    const again = turnOf(a.session, 11 * SEC);
    const b = answer(again.s, rightFor(again.t), 20 * SEC)!;
    expect(b.feedback.then).toBe("next");
    expect(b.writes.styleStats[0]).toMatchObject({ style: a.feedback.style, tries: 1, wins: 1 });
    expect(b.session.kid.skills[t.skillId]!.attempts).toBe(1);
    expect(a.writes.attempts[0]).toMatchObject({ try: 1, style: null, result: expect.stringMatching(/wrong|known-mistake/) });
    expect(b.writes.attempts[0]).toMatchObject({ try: 2, style: a.feedback.style, result: "correct" });
    expect(b.writes.skillStates).toEqual([]);
  });

  it("an attempt row has every spec field", () => {
    const { s, t } = start();
    const a = answer(s, rightFor(t), 7 * SEC)!;
    expect(a.writes.attempts[0]).toEqual({
      kidId: "kid-1", skillId: t.skillId, templateId: t.templateId, seed: t.seed, level: t.level,
      answer: t.problem.answer, result: "correct", mistakeTag: null, style: null, timeMs: 7 * SEC, at: 7 * SEC, try: 1, mode: "practice",
    });
    expect(a.writes.skillStates.map((x) => x.skillId)).toEqual([t.skillId]);
  });
});

it("double tap: a second answer with nothing pending is ignored (Review Focus 1)", () => {
  const { s, t } = turnOf(fresh(placedKid(firstSkills(3))), 0);
  const a = answer(s, rightFor(t), 5 * SEC)!;
  expect(answer(a.session, rightFor(t), 5 * SEC)).toBeNull();
});

it("a stale session ends and drops the unanswered problem (Review Focus 2)", () => {
  const first = turnOf(fresh(placedKid(firstSkills(3))), 0);
  const a = answer(first.s, rightFor(first.t), 20 * SEC)!;
  const second = turnOf(a.session, 20 * SEC);
  const later = nextTurn(second.s, 20 * SEC + 31 * MIN);
  expect(later.turn.kind).toBe("end");
  expect(answer(later.session, 1, 20 * SEC + 31 * MIN)).toBeNull();
});

it("clamps timeMs (Review Focus 3)", () => {
  const { s, t } = turnOf(fresh(placedKid(firstSkills(3)), 7, 10 * SEC), 10 * SEC);
  expect(answer(s, rightFor(t), 5 * SEC)!.writes.attempts[0]!.timeMs).toBe(0);
  expect(answer(s, rightFor(t), 10 * SEC + 25 * MIN)!.writes.attempts[0]!.timeMs).toBe(600_000);
});

describe("session length", () => {
  it("5–7, always right: ends between 10 and 11 minutes", () => {
    const { steps, now } = play(fresh(placedKid(firstSkills(3))), 0, rightFor);
    expect(steps.at(-1)!.turn.kind).toBe("end");
    expect(now).toBeGreaterThanOrEqual(10 * MIN);
    expect(now).toBeLessThan(11 * MIN);
  });

  it("wrong at the 10-minute mark: keeps going and ends on a correct answer", () => {
    const { steps, now } = play(fresh(placedKid(firstSkills(3))), 0, (t, i) => (i === 29 ? wrongFor(t) : rightFor(t)));
    const answered = steps.filter((x) => x.feedback);
    expect(answered.at(-1)!.feedback!.result.kind).toBe("correct");
    expect(now).toBeGreaterThan(10 * MIN);
  });

  it("8–11: ends at 15 minutes or later", () => {
    const { now } = play(fresh(placedKid(firstSkills(3), "8-11", "2")), 0, rightFor);
    expect(now).toBeGreaterThanOrEqual(15 * MIN);
  });
});

describe("template fallback", () => {
  it("uses another template and logs", () => {
    const s = fresh(placedKid(firstSkills(3)));
    const broken = getSkill("compare-numbers.groups").templates[0]!;
    const deps = { generate: (id: string, seed: number, lv: 1 | 2 | 3) => { if (id === broken) throw new Error("boom"); return generate(id, seed, lv); } };
    let found = false;
    let cur = s;
    for (let i = 0; i < 6 && !found; i++) {
      const r = nextTurn(cur, i * 20 * SEC, deps);
      const t = r.turn as ProblemTurn;
      expect(t.templateId).not.toBe(broken);
      if (t.logs.some((l) => l.type === "template-failed")) found = true;
      cur = answer(r.session, rightFor(t), i * 20 * SEC + 10 * SEC)!.session;
    }
    expect(found).toBe(true);
  });

  it("ends the session when every template fails", () => {
    const deps = { generate: () => { throw new Error("boom"); } };
    expect(nextTurn(fresh(placedKid(firstSkills(3))), 0, deps).turn.kind).toBe("end");
  });
});

it("8–11 get the number pad, except for two-way picks", () => {
  const { steps } = play(fresh(placedKid([], "8-11", "2")), 0, rightFor, { max: 60 });
  for (const x of steps) {
    if (x.turn.kind !== "problem") continue;
    expect(x.turn.problem.input).toBe(x.turn.problem.choices!.length === 2 ? "tap-choice" : "number-pad");
  }
});

it("double tap on a wrong first answer does not use up the retry (Review Focus 1)", () => {
  const { s, t } = turnOf(fresh(placedKid(firstSkills(3))), 0);
  const a = answer(s, wrongFor(t), 5 * SEC)!;
  expect(a.feedback.then).toBe("retry");
  expect(answer(a.session, wrongFor(t), 5 * SEC + 50)).toBeNull(); // before the retry was shown
  const again = turnOf(a.session, 12 * SEC);
  const b = answer(again.s, rightFor(again.t), 15 * SEC)!;
  expect(b.feedback.result.kind).toBe("correct");
  expect(b.writes.attempts[0]!.timeMs).toBe(3 * SEC); // timed from when the retry was shown
});

it("the first-session summary counts correct placement answers", () => {
  const { steps } = play(startSession(newKidState("k", "5-7", "K"), 1, 0), 0, rightFor);
  const end = steps.at(-1)!.turn;
  if (end.kind !== "end") throw new Error("no end");
  expect(end.summary.firstTryCorrect).toBe(end.summary.problems);
});
