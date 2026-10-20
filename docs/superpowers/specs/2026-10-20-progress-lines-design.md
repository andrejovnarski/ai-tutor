# Progress lines on the end card: "Today" and "Next time"

Date: 2026-10-20. From `docs/improvements/learning-experience-roadmap.md` §9.
Built by Codex task by task through `docs/codex/HANDOFF.md`; Claude reviews and runs db/e2e.

## Problem

The end card says "Great work today!", counts problems and first-try answers, and (rewards on) shows cubes,
week dots and new stickers. Nothing tells the child, in their words, what they did today or what comes next.

## Decisions (owner, 2026-10-20)

1. Two short lines only — **Today** and **Next time**. No path, no map, no dashboard.
2. Today picks one thing, in this order: **learned** a skill → **kept going** (solved one after a wrong try or
   after Help) → **practiced** a skill.

## What the child sees

On the end card, under "Great work today!" and above the stats/rewards strip:

**Today** (at most one line):

| Case | Line |
|---|---|
| A skill was mastered in this session (`session.mastered`, last one) | `You learned {skill}!` |
| Else a problem was solved on try 2 after a wrong first try or after Help 1 | `You kept going and solved a tricky one!` |
| Else at least one practice/review/check/wind-down problem was served | `You practiced {skill}.` — the skill served most (ties: the most recent) |
| Else the session was placement only | `You showed Nova what you can do!` |
| Else (nothing answered) | no line |

**Next time** (at most one line), from `frontier(kid)` at the end of the session:

| Case | Line |
|---|---|
| Frontier skill is the skill named in a "practiced" Today line | `Next time: more {skill}` |
| Frontier skill exists (otherwise) | `Next time: {skill}` |
| No frontier (everything mastered) | `Next time: a mix of your skills` |
| Session had no answered problems | no line |

Rules:

- Placement never reads as an achievement: placement-mastered skills are not in `session.mastered`, and a
  placement-only session gets the neutral "showed Nova" line.
- A correct answer after **Help 2** is copying and does **not** count as "kept going".
- No line mentions missing days, streaks, or coming back; nothing asks the child to keep playing.
- `{skill}` is the skill's `kidName` if set, else its `name`.

## Kid names

`Skill` gains optional `kidName?: string`, used only on these lines. Set it for jargon names:

| Skill `name` | `kidName` |
|---|---|
| Break apart | Splitting numbers |
| Related facts | Number families |
| Add without regrouping | Adding big numbers |
| Add with regrouping | Big adding with carrying |
| Subtract without regrouping | Taking away big numbers |
| Subtract with regrouping | Big taking away with borrowing |
| Doubles and near doubles | Doubles |
| 10 more, 10 less | Ten more, ten less |

All other skills use `name`.

## Data

- `Session` gains `recovered: number` (problems solved on try 2 that were not after Help 2) and
  `practiced: Record<string, number>` (first tries served per skill in practice, review, check and wind-down,
  newest skill last in insertion order for tie-breaks). Missing in old saved sessions → `0` / `{}`.
- `SessionSummary` gains `today: Today | null` and `next: Next | null`:
  - `type Today = { kind: "learned" | "practiced"; skillId: string } | { kind: "kept-going" | "placement" }`
  - `type Next = { kind: "skill" | "more"; skillId: string } | { kind: "mix" }`
  built in `summaryOf()`.
- One pure function owns the words: `progressLines(summary): { today: string | null; next: string | null }` in
  `src/domain/session/progressLines.ts`. `publicTurn` attaches its result to the end turn as
  `progress: { today, next }`, so the browser gets plain text and no skill ids.
- The same-day end card (`todaysEndCard` in `src/server/play.ts`) rebuilds the summary from the saved state, so
  the lines come back on reload. No database change, no migration.

## Client

`EndCard` renders the two lines (`data-testid="progress-today"`, `"progress-next"`) when present: Today in the
body text size, Next time a little quieter, both left out when null. Fits every size checked by
`tests/e2e/kid-shots.spec.ts` with no clipping (the bubble/text guard pattern applies). Speech: not voiced in
this version.

## Privacy

No new data leaves the session state; parents already see sessions. No notice change.

## Out of scope

Stepping-stone path, parent-page or email copies of these lines, voicing them, rewards changes.

## Testing

- `summaryOf` / `progressLines` unit tests: every row of both tables; Help 2 copy not counted; old session
  without the new fields; tie-break on practiced; kidName fallback.
- Engine: `recovered` and `practiced` counted in `answer()`/`help()` for each mode.
- End card render test for both lines, either line missing, both missing.
- e2e: finish a session (existing rewards/session-ending helpers) → both lines visible; reload → same lines.

## Build order (Codex tasks)

- **T11** domain: kidName, counters, `summaryOf`, `progressLines`, `publicTurn` wiring.
- **T12** `EndCard` UI, kid-shots fit, e2e.
