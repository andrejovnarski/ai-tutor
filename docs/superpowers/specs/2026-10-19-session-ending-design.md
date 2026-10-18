# Session ending: the end card instead of an endless session

Date: 2026-10-19. Milestone A, project 1 of 3, from `docs/improvements/learning-experience-roadmap.md` §3.
Answers the open question from Plan 5a: yes, a session ends with the summary card.

## Problem

`commit()` in `src/server/play.ts` rolls an ending session straight into a new one, so the server never sends
`kind: "end"`. The end card (`src/app/play/EndCard.tsx`) and the client's `ended` phase exist but real play never
reaches them. Practice feels endless and the session length (10–15 or 15–20 minutes) means nothing to the child.

## Decisions (owner, 2026-10-19)

- A finished session shows the end card: "Great work today!", problems, right on the first try, **Play again**,
  **Back to kids**.
- **End card all day:** until midnight New York time, opening play for that child (reload, or tapping their name
  again) shows the same end card. From the next New York day, opening play starts a fresh session.
- A new session starts only through **Play again** or a visit on a later day.

## Design

### Server (`src/server/play.ts`)

1. **Finishing.** When the engine returns an end turn, `commit()` saves the step as now (state, `ended`, attempts,
   skill and style writes) and returns `{ version, turn: end }`. It no longer calls `startFresh`.
2. **Opening play (`playTurn` → `current`).** A session's day is the New York date of its `state.lastActivity` (its
   last answer). With no open session, read the child's most recent ended session: if its day is today, return its
   end turn (summary rebuilt from its state) with its version; otherwise start a fresh session. With an open session
   that the engine now ends (for example abandoned and gone stale), save the end; show the end card only if its day
   is today, otherwise start fresh, so yesterday's half-finished session never says "Great work today!".
3. **Play again.** New `playAgain(repo, kidId, now, seed, ...)`: if an open session exists, return its current step
   (another tablet already started one); otherwise start a fresh session. Play again never returns an end card: an
   open session that the engine ends is saved and replaced by a fresh one. The `one_open_session` unique index means
   racing calls create exactly one session (`createSession` returns null on the unique violation and the loser reads
   the winner's session).
4. **Stale answers.** An answer for an ended session, or with an old version, takes the existing conflict path and
   gets the current step: the end card on the same day, or the new session after Play again.

### Summary

One function builds the end-turn summary from a session state (`problems`, `firstTryCorrect`, `mastered`, and
`minutes` from `startedAt` to the end time). The live end and the same-day reload use it, so the reload shows the
same counts. The engine's own `end()` keeps producing the live summary; a unit test asserts both agree.

### Persistence

No migration. New repository method `lastEnded(kidId)` → `{ id, version, state } | null` (most recent
`ended_at`), in `MemoryRepo` and `SupabaseRepo`. RLS already limits it to the parent's own kids.

### API and client

- New route `POST /api/kids/[kidId]/play-again`, same response shape and errors as `/turn` (404 for another
  family's kid, the same retry handling, Nova's present line for the new problem).
- `PlayScreen`: the end card's **Play again** calls `/play-again` instead of re-requesting `/turn`. **Back to kids**
  is unchanged.

## Out of scope

Showing mastered skills or "next time" on the end card (roadmap §9), changing session lengths, rewards.

## Testing

- **Unit (`src/server/play.test.ts`):** an answer that ends the session returns `kind: "end"` and leaves no open
  session; opening play the same NY day returns that end card (same counts and version); the next NY day starts a
  fresh session, including just before and just after New York midnight; Play again creates exactly one session,
  also when two calls race; a repeated answer after the end creates nothing. The two rollover tests are rewritten to
  the new behaviour.
- **Unit (summary):** the rebuilt summary equals the engine's `end()` summary for the same state.
- **Database (`tests/db`):** `lastEnded` returns the newest ended session, null when none, nothing for another
  family's kid.
- **Browser (`tests/e2e`):** play a problem, backdate the session's `startedAt` through the admin client so it is past
  the maximum length, answer until the end card shows; reload shows the same end card; **Play again** shows a
  problem; the database has exactly one open session.
