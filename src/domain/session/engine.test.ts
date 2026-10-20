import { recordPlacement } from "../kid/placement";
import { getSkill } from "../curriculum/index";
import { newKidState } from "../kid/state";
import { answer, help, nextTurn, startSession, summaryOf } from "./engine";
import { MIN, SEC, firstSkills, fresh, generate, placedKid, play, rightFor, setSkill, wrongFor, type ProblemTurn } from "./testkit";
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
    expect(again.t).toEqual({ ...t, try: 2, style: a.feedback.style });
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

it("summaryOf a finished session is the summary of the end turn nextTurn gives it", () => {
  const { session, now } = play(fresh(placedKid(firstSkills(3))), 0, rightFor);
  for (const at of [now, now + 5 * MIN]) {
    const end = nextTurn(session, at).turn;
    if (end.kind !== "end") throw new Error("no end");
    expect(summaryOf(session, at)).toEqual(end.summary);
  }
});

describe("Help me", () => {
  const start = () => turnOf(fresh(placedKid(firstSkills(3))), 0);
  const wrong = (s: Session) => answer(s, s.pending!.problem.answer + 1000, 5000)!;

  it("ignores unavailable, unshown, ended and fully helped problems", () => {
    const { s } = start();
    for (const session of [
      { ...s, pending: null }, { ...s, ended: true },
      { ...s, pending: { ...s.pending!, shown: false } },
      { ...s, pending: { ...s.pending!, help: 2 as const } },
    ]) expect(help(session, 5000)).toBeNull();
  });

  it.each(["practice", "review", "wind-down"] as const)("Help 1 in %s is a quiet miss", (mode) => {
    const initial = start().s;
    const s = { ...initial, pending: { ...initial.pending!, mode } };
    const h = help(s, 5000)!;
    const w = wrong(s);
    expect(h.session.kid).toEqual(w.session.kid);
    expect(h.session).toMatchObject({ problems: 1, firstTryCorrect: 0, recent: [false], lastCorrect: false,
      pending: { try: 2, help: 1, shown: false } });
    expect(h.writes.attempts[0]).toMatchObject({ result: "helped", answer: null, mistakeTag: null, try: 1,
      style: s.pending.style, timeMs: 5000 });
    expect(h.feedback).toMatchObject({ result: { kind: "helped" }, then: "retry", reveal: false });
    expect(getSkill(s.pending.skillId).styles).toContain(h.feedback.style);
    expect(help(h.session, 5001)).toBeNull();
  });

  it("struggle schedules the same check, after the supported try", () => {
    const initial = start().s;
    const s = { ...initial, kid: setSkill(initial.kid, initial.pending!.skillId, { wrongStreak: 1 }) };
    const h = help(s, 5000)!;
    expect(h.session.check).not.toBeNull();
    expect(h.session.check).toEqual(wrong(s).session.check);
    const retry = turnOf(h.session, 6000);
    expect(retry.t).toMatchObject({ try: 2, help: 1, mode: "practice" });
    const a = answer(retry.s, rightFor(retry.t), 7000)!;
    expect(turnOf(a.session, 8000).t.mode).toBe("check");
  });

  it.each([false, true])("placement miss, final item = %s; supported answer never updates placement", (last) => {
    const initial = turnOf(fresh(newKidState("k", "5-7", "1")), 0).s;
    const s = last ? { ...initial, placement: { ...initial.placement!, probes: 4, inProbe: 1 } } : initial;
    const h = help(s, 5000)!;
    expect(h.session.placement).toEqual(last ? null : recordPlacement(s.placement!, false));
    expect(h.session.kid.placed).toBe(last);
    expect(h.writes.kidPlaced).toBe(last ? true : undefined);
    expect(h.session.problems).toBe(1);
    expect(h.session.firstTryCorrect).toBe(0);
    const retry = turnOf(h.session, 6000);
    const a = answer(retry.s, rightFor(retry.t), 7000)!;
    expect(a.session.placement).toEqual(h.session.placement);
    expect(a.session.kid.skills).toEqual(h.session.kid.skills);
    expect(a.writes.skillStates).toEqual([]);
    expect(a.writes.kidPlaced).toBeUndefined();
    expect(a.session.problems).toBe(1);
  });

  it.each([0, 3])("check follows wrong step-back / loop guard at %i step-backs", (stepBacksInRow) => {
    const initial = start().s;
    const s = { ...initial, check: { prereqId: initial.pending!.skillId, returnTo: "compare-numbers.to-10", done: 0 },
      stepBacksInRow, pending: { ...initial.pending!, mode: "check" as const } };
    const h = help(s, 5000)!;
    const w = wrong(s);
    expect({ ...h.session, pending: null }).toEqual(w.session);
    expect(h.feedback).toMatchObject({ then: "retry", reveal: false, style: w.feedback.style, logs: w.feedback.logs });
    expect(h.session.pending).toMatchObject({ try: 2, help: 1 });
  });

  it.each(["help", "wrong"] as const)("Help 2 after %s keeps learning unchanged, and copied answers never teach style", (first) => {
    const s = start().s;
    const one = first === "help" ? help(s, 5000)! : wrong(s);
    const retry = turnOf(one.session, 6000);
    const two = help(retry.s, 7000)!;
    expect(two.writes.attempts[0]).toMatchObject({ result: "helped", answer: null, mistakeTag: null, try: 2 });
    expect(two.writes.skillStates).toEqual([]);
    expect(two.writes.styleStats).toEqual([]);
    expect(two.session.kid).toEqual(one.session.kid);
    expect(two.session.pending).toMatchObject({ try: 2, help: 2, shown: false, style: retry.t.style });
    expect(two.feedback).toMatchObject({ then: "retry", reveal: true, style: retry.t.style });
    const shown = turnOf(JSON.parse(JSON.stringify(two.session)), 8000);
    expect(shown.t.help).toBe(2);
    for (const correct of [true, false]) {
      const a = answer(shown.s, shown.t.problem.answer + (correct ? 0 : 1000), 9000)!;
      expect(a.feedback).toMatchObject({ then: "next", reveal: !correct });
      expect(a.writes.styleStats).toEqual([]);
      expect(a.session.kid).toEqual(two.session.kid);
    }
  });

  it("Help 1 survives reload and its answer teaches style; legacy pending is level 0", () => {
    const s = start().s;
    expect(turnOf(s, 0).t.help).toBe(0);
    const one = help(s, 5000)!;
    const shown = turnOf(JSON.parse(JSON.stringify(one.session)), 6000);
    expect(shown.t.help).toBe(1);
    expect(shown.t.problem).toEqual(s.pending!.problem);
    expect(answer(shown.s, rightFor(shown.t), 7000)!.writes.styleStats).toHaveLength(1);
  });
});


describe("progress summary", () => {
  const a = firstSkills(1)[0]!;
  const b = firstSkills(2)[1]!;
  it.each(["wrong", "help", "copy", "first"])("recovery after %s", (kind) => {
    const initial = turnOf(fresh(placedKid([])), 0);
    if (kind === "first") {
      expect(answer(initial.s, rightFor(initial.t), 1)!.session.recovered).toBe(0);
      return;
    }
    const one = kind === "wrong" ? answer(initial.s, wrongFor(initial.t), 1)! : help(initial.s, 1)!;
    let retry = turnOf(one.session, 2);
    if (kind === "copy") retry = turnOf(help(retry.s, 3)!.session, 4);
    const result = answer(retry.s, rightFor(retry.t), 5)!;
    expect(result.session.recovered).toBe(kind === "copy" ? 0 : 1);
  });
  it.each(["practice", "review", "check", "wind-down", "placement"] as const)("counts served %s once", (mode) => {
    let s = fresh(placedKid(mode === "review" ? [a] : []));
    if (mode === "placement") s = fresh(newKidState("k", "5-7", "K"));
    if (mode === "review") s = { ...s, count: 4 };
    if (mode === "check") s = { ...s, check: { prereqId: a, returnTo: b, done: 0 } };
    if (mode === "wind-down") s = { ...s, windDown: 0 };
    const first = turnOf(s, 0);
    expect(first.t.mode).toBe(mode);
    expect(first.s.practiced).toEqual(mode === "placement" ? {} : { [first.t.skillId]: 1 });
    expect(turnOf(first.s, 1).s.practiced).toEqual(first.s.practiced);
    if (mode === "practice") {
      const retry = turnOf(answer(first.s, wrongFor(first.t), 2)!.session, 3);
      expect(retry.s.practiced).toEqual(first.s.practiced);
      const next = turnOf(answer(retry.s, rightFor(retry.t), 4)!.session, 5);
      expect(next.s.practiced[first.t.skillId]).toBe(2);
    }
  });
  it("chooses today by priority and next by the frontier", () => {
    const s = { ...fresh(placedKid([])), problems: 2, practiced: { [b]: 1, [a]: 1 } };
    expect(summaryOf(s, 0)).toMatchObject({ today: { kind: "practiced", skillId: a }, next: { kind: "more", skillId: a } });
    expect(summaryOf({ ...s, practiced: { [a]: 1, [b]: 2 } }, 0)).toMatchObject({ today: { kind: "practiced", skillId: b }, next: { kind: "skill", skillId: a } });
    expect(summaryOf({ ...s, recovered: 1 }, 0).today).toEqual({ kind: "kept-going" });
    expect(summaryOf({ ...s, recovered: 1, mastered: [a, b] }, 0).today).toEqual({ kind: "learned", skillId: b });
    expect(summaryOf({ ...s, kid: placedKid(firstSkills(100)) }, 0).next).toEqual({ kind: "mix" });
    expect(summaryOf(fresh(placedKid([])), 0)).toMatchObject({ today: null, next: null });
  });
  it("moves a served skill to the newest position for ties", () => {
    const s = { ...fresh(placedKid([])), practiced: { [a]: 1, [b]: 2 } };
    const served = turnOf(s, 0).s;
    expect(Object.keys(served.practiced)).toEqual([b, a]);
    expect(summaryOf({ ...served, problems: 1 }, 0).today).toEqual({ kind: "practiced", skillId: a });
  });
  it("placement mastery followed by practice and wind-down-only both say practiced", () => {
    for (const windDown of [null, 0]) {
      const served = turnOf({ ...fresh(placedKid([a])), windDown }, 0);
      const s = answer(served.s, rightFor(served.t), 1)!.session;
      expect(s.mastered).toEqual([]);
      expect(summaryOf(s, 2).today).toEqual({ kind: "practiced", skillId: served.t.skillId });
    }
  });
  it("a completed placement with no mastered skills still gets the neutral line", () => {
    let s = fresh(newKidState("k", "5-7", "K"));
    for (let i = 0; !s.kid.placed; i++) {
      const served = turnOf(s, i * 2);
      s = answer(served.s, wrongFor(served.t), i * 2 + 1)!.session;
    }
    expect(s.placement).toBeNull();
    expect(s.mastered).toEqual([]);
    expect(summaryOf(s, 10).today).toEqual({ kind: "placement" });
  });
  it("defaults missing counters while resuming an old saved session", () => {
    const legacy = JSON.parse(JSON.stringify(fresh(placedKid([]))));
    delete legacy.recovered;
    delete legacy.practiced;
    const served = turnOf(legacy, 0);
    expect(served.s.practiced).toEqual({ [served.t.skillId]: 1 });
    const retry = turnOf(answer(served.s, wrongFor(served.t), 1)!.session, 2);
    expect(answer(retry.s, rightFor(retry.t), 3)!.session.recovered).toBe(1);
  });
  it("round trips the summary and supports old saved sessions", () => {
    const s = { ...fresh(placedKid([])), problems: 2, count: 2, practiced: { [a]: 2 }, recovered: 1 };
    expect(summaryOf(JSON.parse(JSON.stringify(s)), 10)).toEqual(summaryOf(s, 10));
    const legacy = JSON.parse(JSON.stringify(s));
    delete legacy.recovered;
    delete legacy.practiced;
    expect(summaryOf(legacy, 10).today).toBeNull();
    legacy.mastered = [a];
    expect(summaryOf(legacy, 10).today).toEqual({ kind: "learned", skillId: a });
    legacy.mastered = [];
    legacy.placement = { probes: 0 };
    expect(summaryOf(legacy, 10).today).toEqual({ kind: "placement" });
    const placement = play(fresh(newKidState("k", "5-7", "K")), 0, rightFor, { max: 1 }).session;
    expect(summaryOf(placement, 10).today).toEqual({ kind: "placement" });
  });
});
