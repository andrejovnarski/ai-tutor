# Session Ending Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A finished session shows the end card ("Great work today!") instead of rolling into a new session; the card stays for the rest of the New York day; **Play again** starts exactly one new session.

**Architecture:** `src/server/play.ts` stops calling `startFresh` after an end and decides, from the session's `lastActivity`, whether to show an end card or start fresh. A new repo method finds the kid's last ended session. A new `/play-again` route starts a session on purpose; the client's end card calls it.

**Tech Stack:** Next.js 16 route handlers, Supabase (Postgres, RLS), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-19-session-ending-design.md`

## Global Constraints

- "Today" is the **New York** calendar date (`America/New_York`), as everywhere else in the app.
- The day of a session is the NY date of its `state.lastActivity` (engine time of its last answer), not `ended_at`.
- No migration. `src/domain` changes only to export the summary builder.
- `/play-again` has the same response shape, status codes and error handling as `/turn`.
- Play again never answers with an end card.
- Keep the existing guarantees: version compare-and-set, one open session per kid (`one_open_session`), stale answers get 409 with the current step.

## Review Focus

1. **Abandoned yesterday, opened today:** an open session whose last activity was yesterday must close quietly and start fresh, never show "Great work today!" (Task 2 test).
2. **Play again on a stale-today open session:** must start a fresh session, not return the end card again (no Play-again loop) (Task 2 test).
3. **Midnight in New York:** last answer 23:59 NY, opened 00:01 NY next day → fresh session; summer/winter offsets (UTC−4/−5) both covered (Task 2 test).
4. **Two tablets tap Play again together:** exactly one open session afterwards, both get the same problem (Task 2 test).
5. **Offline during Play again:** the connection notice's retry repeats Play again, not `/turn` (which would show the end card again) (Task 3 test).

---

### Task 1: `lastEnded` in both repos

**Files:**
- Modify: `src/server/persist/repo.ts` (interface + `MemoryRepo`)
- Modify: `src/server/persist/supabaseRepo.ts`
- Test: `src/server/persist/repo.test.ts`, `tests/db/repo.db.test.ts`

**Interfaces:**
- Produces: `Repo.lastEnded(kidId: string): Promise<OpenSession | null>`: the kid's most recently ended session (`id`, `version`, `state`), null if none or not the parent's kid.

- [ ] **Step 1: Write the failing tests**

`repo.test.ts`:
```ts
it("lastEnded is null with no ended session, then the newest ended one", async () => {
  const repo = setup();
  expect(await repo.lastEnded(kid.kidId)).toBeNull();
  const a = (await repo.createSession(kid.kidId, startSession(kid, 1, 0)))!;
  expect(await repo.lastEnded(kid.kidId)).toBeNull(); // open, not ended
  await repo.saveStep(a, a.state, true, null);
  const b = (await repo.createSession(kid.kidId, startSession(kid, 2, 0)))!;
  await repo.saveStep(b, { ...b.state, seed: 2 }, true, null);
  const last = await repo.lastEnded(kid.kidId);
  expect(last!.id).toBe(b.id);
  expect(last!.version).toBe(b.version + 1);
  expect(await repo.lastEnded("nope")).toBeNull();
});
```
`tests/db/repo.db.test.ts` (follow the file's existing setup): through parent A's client, end two sessions in turn; `lastEnded` returns the second (by `ended_at`); parent B's client gets null for A's kid.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/server/persist/repo.test.ts` → FAIL (`lastEnded` is not a function).

- [ ] **Step 3: Implement**

`MemoryRepo`: the last element of `sessions` with this `kidId` and `ended`, copied like `openSession`. `SupabaseRepo`: `select("id, version, state").eq("kid_id", kidId).not("ended_at", "is", null).order("ended_at", { ascending: false }).limit(1).maybeSingle()`, mapped with the existing `open()`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/server/persist/repo.test.ts` → PASS. `npm run test:db` (local stack running) → PASS.

- [ ] **Step 5: Commit** — `feat: repo lastEnded finds a kid's most recent ended session`

---

### Task 2: Play ends on the end card; Play again

**Files:**
- Create: `src/server/nyDay.ts`
- Modify: `src/server/report/collect.ts` (`nyDate` uses `nyDay`)
- Modify: `src/domain/session/engine.ts` (export `summaryOf`, `end()` uses it)
- Modify: `src/server/play.ts`
- Test: `src/server/play.test.ts`, `src/domain/session/engine.test.ts`

**Interfaces:**
- Consumes: `Repo.lastEnded` (Task 1).
- Produces:
  - `nyDay(ms: number): string`: NY calendar date `YYYY-MM-DD` (no `server-only`, so unit tests import it directly).
  - `summaryOf(s: Session, now: number): SessionSummary`: `{ problems, firstTryCorrect, minutes: Math.round((now - s.startedAt) / 60_000), mastered }`.
  - `playAgain(repo: Repo, kidId: string, now: number, seed: () => number, speak?: Speak): Promise<TurnResult>`: same 404 rule as `playTurn`.

Behaviour in `play.ts` (the rule the tests pin):
- `commit()`: after saving an end turn, return `{ version, turn }` (the end turn). No `startFresh`.
- `current(c, endCard = true)`:
  - open session, `nextTurn` gives a problem: unchanged.
  - open session, `nextTurn` gives an end: save it; if `endCard` and `nyDay(state.lastActivity) === nyDay(now)`, return the end step; otherwise `startFresh`.
  - no open session: if `endCard`, `lastEnded` is today by `lastActivity` → return `{ version, turn: { kind: "end", summary: summaryOf(state, state.lastActivity) } }`; otherwise `startFresh`.
- `playTurn` uses `current(c)`; `playAgain` uses `current(c, false)`; the 409 path in `playAnswer` uses `current(c)`.

- [ ] **Step 1: Write the failing tests**

`engine.test.ts`: `summaryOf` on a finished session equals the `summary` of the end turn `nextTurn` returns for it at the same `now`.

`play.test.ts` (reuse its `seed`, `pendingAnswer`, `ok` helpers; times are ms; 2026-10-19 is EDT, UTC−4):
- `"an answer that ends the session returns the end card and opens no new session"`: the existing 12-minute scenario; expect `a.next.kind === "end"`, `a.next.summary.problems >= 1`, and `repo.sessions.filter((s) => !s.ended)` has length 0.
- `"opening play later the same New York day shows the same end card"`: after the end, `playTurn` at end + 3 h returns `kind: "end"`, the same summary and the same version as the answer's response; no session created.
- `"opening play the next New York day starts a fresh session"`: last answer at `Date.parse("2026-10-20T03:59:00Z")` (23:59 EDT); `playTurn` at `Date.parse("2026-10-20T04:01:00Z")` → `kind: "problem"`, one open session. Repeat for winter: `"2026-12-02T04:59:00Z"` / `"2026-12-02T05:01:00Z"` (EST).
- `"an open session abandoned yesterday closes quietly and starts fresh"`: open session with `lastActivity` yesterday NY and the stale gap passed; `playTurn` now → `kind: "problem"`; the old session is ended; a new one is open.
- `"play again starts exactly one session, also when two tablets race"`: after an end, `Promise.all([playAgain(...), playAgain(...)])` → both `kind: "problem"`, same version; exactly one open session.
- `"play again on a session abandoned earlier today starts fresh, never the end card"`: open session whose `nextTurn` ends it as stale, `lastActivity` earlier today → `playAgain` returns `kind: "problem"`.
- `"a repeated answer after the end creates nothing and gets the end card"`: send the ending answer again with its old version → 409 with `turn.kind === "end"`; still no open session.
- Rewrite `"starts a new session after the old one ended"` and `"rolls over to a new session when an answer ends the old one"` to the cases above (delete what they duplicate). Update `"rejects a stale answer from the previous session after a rollover (two tablets)"`: tablet B ends the session; tablet A's old answer gets 409 with the end card.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/server/play.test.ts src/domain/session/engine.test.ts` → FAIL.

- [ ] **Step 3: Implement** `nyDay`, `summaryOf`, `playAgain` and the `current`/`commit` rule above. `collect.ts`: `nyDate.format(d)` returns `nyDay(d.getTime())` (behaviour unchanged).

- [ ] **Step 4: Run to verify they pass**

Run: `npm test` and `npm run typecheck` → all pass (the report tests prove `nyDate` is unchanged).

- [ ] **Step 5: Commit** — `feat: sessions end on the end card, shown all day; play again starts one session`

---

### Task 3: `/play-again` route and the end card's Play again

**Files:**
- Create: `src/app/api/kids/[kidId]/play-again/route.ts`
- Modify: `src/app/play/usePlay.ts`, `src/app/play/PlayScreen.tsx`
- Test: the existing `usePlay`/screen unit tests (`src/app/play/screen.test.tsx` or `playMachine.test.ts`, whichever drives `usePlay` with a fake fetch), `tests/e2e/screen.spec.ts`

**Interfaces:**
- Consumes: `playAgain` (Task 2).
- Produces: `POST /api/kids/[kidId]/play-again` → `{ version, turn, line? }`; `usePlay(kidId)` returns `{ state, answer, retry, say, playAgain }`.

- [ ] **Step 1: Write the failing tests**

- With a fake fetch: `playAgain()` posts to `/api/kids/<id>/play-again` and the state becomes `phase: "problem"`.
- Review Focus 5: `playAgain()` gets `"offline"` (fake fetch fails past the retries), then `retry()` posts to `/play-again` again, not `/turn`.
- `tests/e2e/screen.spec.ts` `"the end card shows the counts and Play again asks for a new turn"`: stub `/play-again` (not `/turn`) for the second step and expect it to be called once.

- [ ] **Step 2: Run to verify they fail**

- [ ] **Step 3: Implement**

- Route: copy `/turn`'s handler, calling `playAgain` instead of `playTurn`, with `tryAgain("play-again", err)`.
- `usePlay`: `load(path: "turn" | "play-again" = "turn")`; keep the last path in a ref; `retry()` repeats it; `playAgain = () => load("play-again")`.
- `PlayScreen`: `<EndCard onPlayAgain={playAgain} />`.

- [ ] **Step 4: Run to verify they pass**

`npm test`, `npm run typecheck`, `npx playwright test tests/e2e/screen.spec.ts` → PASS.

- [ ] **Step 5: Commit** — `feat: play-again route; the end card's Play again starts a new session`

---

### Task 4: End-to-end: finish, reload, Play again

**Files:**
- Modify: `tests/e2e/play.spec.ts`

- [ ] **Step 1: Write the test** `"a finished session shows the end card, keeps it on reload, and Play again starts one new session"`:
  1. `setUpMia`; through `admin()` set Mia's `placed = true` (skips placement); tap Mia; wait for a problem.
  2. Through `admin()`, set the open session's `state.startedAt` to 25 minutes before now (past both age bands' maximum); leave `lastActivity`.
  3. Answer with `answerOnce` until `getByTestId("end-card")` is visible (at most 10 answers; wind-down ends on the first right answer or its cap).
  4. Reload → the end card is visible again, with the same problem count.
  5. Tap **Play again** → `getByTestId("say")` is visible; through `admin()`, Mia has exactly one session with `ended_at` null.

- [ ] **Step 2: Run** `npx playwright test tests/e2e/play.spec.ts` (port 3000 free) → PASS.

- [ ] **Step 3: Full check** — `npm run typecheck`, `npm test`, `npm run test:db`, `npm run test:e2e` → all pass.

- [ ] **Step 4: Commit** — `test: e2e finish, reload and play again`
