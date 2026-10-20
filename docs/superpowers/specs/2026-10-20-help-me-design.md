# Help me: child-requested help on the play screen

Date: 2026-10-20. From `docs/improvements/learning-experience-roadmap.md` §7.
Built by Codex task by task through `docs/codex/HANDOFF.md`; Claude reviews and runs db/e2e.

## Problem

A stuck child's only way to get support is to answer wrong first. The retry after a wrong answer already
teaches well (a strategy line from Nova and the board redrawn in a teaching style), but the child has to fail
to reach it, and a guess pollutes the mastery evidence.

## Decisions (owner, 2026-10-20)

1. **Scoring:** asking for help counts like a wrong first try for mastery (same BKT update), with no visible
   penalty. It is stored as `helped`, never as `wrong`.
2. **Two levels, bounded:** Help 1 = hint + teaching picture. Help 2 = Nova shows how and says the answer,
   then the child types the answer to finish. No third level.
3. **Everywhere:** the button is on every problem, including placement and prerequisite checks, where help
   counts as "not passed".
4. **Kid play is touch and keyboard only** in this version. Saying "help" to the mic is later work.

## Child experience

- A large **Help me** button sits at the end of Nova's speech row on every problem (on screens ≤ 720 px wide: on the top row with "I'm done for now"). Owner ruling 2026-10-20, after the tray had no room for an 88 px target. Calm styling per `DESIGN.md`: no red,
  no warning colours, no sad imagery, no counter of how often help was used. It is a real `<button>` with an
  accessible name "Help me", reachable by Tab, activated by Enter/Space.
- **Help 1** (tap before answering, i.e. on try 1): Nova says a strategy hint that never states the answer,
  and the board shows the teaching-style picture, exactly as a retry after a wrong answer does today
  (`styleView`, `pickStyle`). The child then answers.
- **Help 2** (tap on try 2, whether try 2 came from Help 1 or from a wrong first answer): Nova explains step by
  step and says the answer (today's reveal line). The problem stays on screen and the child types the answer.
  The button is then gone for this problem.
- After Help 2, a wrong answer gets today's kind reveal and the next problem; a right one gets a normal
  "correct" line.
- Requesting help never shows "wrong", a cross, a shake, or any negative sound.

## Learning model (`src/domain/session/engine.ts`)

New engine function next to `answer()`:

```ts
export function help(s: Session, now: number): { session: Session; feedback: Feedback; writes: Writes } | null;
```

Returns `null` (nothing happens) when there is no pending problem, it is not shown yet (`pending.shown`
false), the session has ended, or the problem is already at help level 2.

`Pending` gains `help: 0 | 1 | 2`. A saved session without the field reads as `0` (old sessions in the db stay
valid; no data migration).

**Help 1 — pending at try 1, help 0.** Exactly what a wrong first answer does today, minus the answer:

- Writes one attempt: `result: "helped"`, `answer: null`, `mistakeTag: null`, `try: 1`, the problem's
  current style, `timeMs` as for answers.
- Practice / review / wind-down: same mastery and struggle effects as a wrong first try (`firstTry(..., false)`,
  `struggle` for practice), `lastCorrect = false`, counts in `recent` as a miss. Then pick a style the same way
  the wrong path does and move pending to `try: 2, help: 1, shown: false`.
- Placement: the probe item counts as not passed (`recordPlacement(..., false)`, same as a wrong answer,
  including finishing placement if this was the last item). The pending problem then becomes a supported
  `try: 2, help: 1` that is never recorded into placement.
- Prerequisite check: same as a wrong check answer (step back / loop guard), then the supported try 2.
- Session counters: `problems + 1`, `firstTryCorrect + 0` (a helped problem is never "right on the first try").
  Rewards read these counters, so a helped problem earns problem XP but no first-try bonus — no rewards code change.
- Feedback: `then: "retry"`, the chosen `style`, `reveal: false`.

**Help 2 — pending at try 2, help 0 or 1.** No mastery, placement, or style change:

- Writes one attempt: `result: "helped"`, `answer: null`, `try: 2`.
- Pending stays on the same problem with `help: 2`, `shown: false` until the next turn shows it.
- Feedback: `then: "retry"`, `reveal: true` (Nova may say the answer), same `style` as the board.

**Answer after help.**

- After Help 1 (try 2, help 1): today's try-2 rules (style learns from it; wrong → reveal and next).
- After Help 2 (try 2, help 2): records the attempt but **nothing learns from it** (no style stat — the child
  was copying). Wrong → reveal and next; right → next.

The engine stays pure and plain-data; sims in `src/domain/sim` gain a bot that asks for help on a share of
problems, to check mastery does not rise from helped problems.

## Persistence

- Migration `0009_helped_attempts.sql`: `attempts.answer` becomes nullable. `result` is free text today, so
  `helped` needs no constraint change. `save_step` inserts attempts via `jsonb_populate_recordset`, so a null
  answer passes through; verify with a db test.
- No new table. Session state (with `pending.help`) is saved as now, so a reload shows the same hint or demo.

## Server and API

- `src/server/play.ts`: `helpStep(...)` mirroring the answer flow (load open session, version check, engine
  `help`, `commit`, tutor line). Double taps are blocked the same way as answers (version + `shown`).
- Route `POST /api/kids/[kidId]/help` with body `{ version }`, built like `answer/route.ts`: `parentRepo()`
  login check, 404 for another family's kid, 409 on a stale version, same response shape as answer
  (`version`, `feedback`, `next`, `line`, `revealed` on Help 2).
- `PublicTurn` exposes the help level so the client knows whether to show the button.

## Nova's lines (`src/server/tutor`)

- New `TutorEvent` `"help"` for Help 1: plan like `"wrong"` but with no `kidAnswer` and no mistake tag, with the
  style. Added to `HIDES_ANSWER` in `guards.ts`, so the number guard blocks the answer. Canned lines in
  `canned.ts` (warm, short, strategy only, both age bands), one prompt example in `prompt.ts`, cases in the eval
  set.
- Help 2 reuses `"explain"` with `revealed: true`.
- `play.ts` `EVENTS` list gains `"help"` (append at the end so existing canned seeds don't shift).

## Client (`src/app/play`)

- `playMachine.ts`: a `help` action from the problem phases, busy/offline handling like answering.
- `usePlay.ts`: calls the route; applies the returned turn and line like an answer response.
- Button in the answer tray area; hidden when the turn's help level is 2 and on the end card.
- Speech on: Nova's help line is voiced like any other line.

## Parents

- Child page (`src/server/kidRecord.ts`): each session shows "asked for help N times" next to its problems,
  separate from mistakes.
- Every reader of `attempts.result` treats `helped` explicitly: never a mistake tag, never "correct", counts as
  "not first-try correct". Weekly email content otherwise unchanged in this version.
- The data download already includes attempts; its plain-words "about" text gains one line for `helped`.
- `docs/lawyer-brief.md`: one line noting help requests are stored with answers (same kind of data).

## Out of scope

Saying "help" to the mic, half credit for helped answers, interactive step-by-step manipulation (§8), weekly
email help lines, more than two levels.

## Testing

- Engine unit tests for every row above (each mode, both levels, null cases, old pending without `help`).
- Sim: a help-asking bot does not gain mastery faster than a bot that answers those problems wrong.
- Tutor: guard rejects the answer in a `"help"` line; canned lines pass the guard.
- Route/API unit tests like the answer route's; db test that a helped attempt (null answer) saves.
- Client unit tests for the machine and button visibility; one e2e: tap Help me twice, see hint then demo, type
  the answer, next problem; parent page shows "asked for help 2 times" for that session.

## Build order (Codex tasks)

- **T6** engine + sims. **T7** migration, server, route, tutor event. **T8** client button and e2e.
  **T9** parent page, attempt readers, download text, lawyer line.
