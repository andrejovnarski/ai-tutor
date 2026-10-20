# Recall checks: delayed mastery checks with growing gaps

Date: 2026-10-20. From `docs/improvements/learning-experience-roadmap.md` §10.
Built by Codex task by task through `docs/codex/HANDOFF.md`; Claude reviews and runs db/e2e.

## Problem

Review today picks the mastered skill seen longest ago every `REVIEW_EVERY` (5) problems. It counts problems,
not days, so a "review" can land minutes after the kid learned the skill. One slip on a review drops the skill
out of mastered. The parent page says `Mastered Oct 3` forever, even if the kid has since forgotten.

## Decisions (owner, 2026-10-20)

1. **Growing gaps:** a mastered skill is due for a recall 1, 3, 7, then 21 days later. A pass grows the gap; a
   partial pass starts it over.
2. **Two problems per recall.** Both right → remembered. One right → no model change, gap back to 1 day. Both
   wrong → back to gentle practice.
3. **Parent words:** `Learned Oct 3 · not checked yet`, `Learned Oct 3 · remembered Oct 10`, `Practicing again`.
4. Engine design (Part 1) and data/parent design (Part 2) approved in chat.

"Recall" is the new name. The existing prerequisite "check" (`Session.check`, mode `"check"`) is unchanged.

## Learning model (`src/domain/kid`)

`SkillState` gains:

- `checkStep: 0 | 1 | 2 | 3` — index into `RECALL_GAP_DAYS = [1, 3, 7, 21]`.
- `checkDue: number | null` — ms time the next recall is due.
- `rememberedAt: number | null` — time of the newest passed recall.

Old saved states without the fields read as `0` / `null` / `null`.

- `RECALL_DAY_MS = 20 * 3_600_000`: a "day" is 20 hours, so playing at the same time the next day counts.
- When a skill becomes mastered in play (`firstTry` crosses into mastered): `checkStep 0`,
  `checkDue = now + 1 * RECALL_DAY_MS`.
- A mastered skill with `checkDue === null` (mastered before this feature, or mastered by placement) is due
  now; among due skills the oldest `checkDue` goes first, `null` counts as oldest, ties in curriculum order.
- New pure helper in `src/domain/kid/next.ts`:
  `recallTarget(kid: KidState, now: number, sessionStart: number): string | null` — a mastered skill with
  `(checkDue ?? -Infinity) <= now` and `lastSeen === null || lastSeen < sessionStart`.
- `reviewTarget` (normal review) skips skills that `recallTarget`'s rule says are due, so a normal review never
  warms a skill up just before its recall — except in a session that ran placement (no recall can run there).

## Session engine (`src/domain/session/engine.ts`)

- `Session` gains `recall: { skillId: string; results: boolean[]; templates: string[] } | null` (old sessions:
  `null`) and `Mode` gains `"recall"`.
- **When:** at the normal review slot (`(count + 1) % REVIEW_EVERY === 0`), if `recallTarget` returns a skill,
  start a recall instead of a review. Never in a session that ran placement. At most one recall at a time.
- **What:** two problems of that skill in a row, mode `"recall"`, at the skill's current level, using two
  different templates when the skill has two or more.
- **Ends before the session:** like `check`, a recall in progress is finished before wind-down or end.
- **Scoring** (first tries only; the pair is scored after the second problem's first try):
  - Both right: apply BKT for both correct answers, `checkStep = min(3, checkStep + 1)`,
    `checkDue = now + RECALL_GAP_DAYS[newStep] * RECALL_DAY_MS`, `rememberedAt = now`.
  - One right: no BKT change, `checkStep = 0`, `checkDue = now + 1 * RECALL_DAY_MS`.
  - Both wrong: apply BKT for both wrong answers (drops it out of mastered), `level = 1`, `checkStep = 0`,
    `checkDue = null`, `rememberedAt = null` (ruling at final review: no stale "remembered" date). The skill is then the frontier or near it and comes back through normal practice; when
    it is mastered again the schedule restarts at 1 day.
  - Help 1 on a recall problem counts as a wrong answer.
- **Kid view:** a recall problem looks like any problem. A wrong answer (or Help 1) gets the normal retry with
  a teaching picture; the retry never scores the recall. Session counters (`problems`, `firstTryCorrect`,
  `practiced`) count recall problems like review problems.
- `attempts` rows for recall problems store `mode: "recall"`.

## Persistence

- Migration `0010_recall.sql`: `skill_state` adds `check_step int not null default 0`,
  `check_due timestamptz`, `remembered_at timestamptz`; `save_step` is re-created (from `0002`) to write them.
  No backfill. The `mastered_at` trigger is unchanged (set once, kept).
- `src/server/persist/rows.ts`: `SkillRow`, `kidStateFromRows`, `skillRow` map the three fields.

## Parents

Skill line (`src/server/kidRecord.ts` `skillLine`), using `isMastered` on the row's `p_known`, `attempts`,
`placed`:

| Row | Status |
|---|---|
| Mastered now, not `placed` | `Learned {mastered_at} · not checked yet` / `Learned {mastered_at} · remembered {remembered_at}` |
| Mastered now, `placed` | `Knew at start · not checked yet` / `Knew at start · remembered {remembered_at}` |
| `mastered_at` set, not mastered now | `Practicing again` |
| Otherwise | unchanged: `Learning, level N` / `Not started yet` |

Dates use the existing `monthDay` format. Same words elsewhere:

- Session line and week summary: `Learned: …` (was `Mastered: …`).
- Weekly email: `Learned this week: …` (was `Mastered this week: …`).
- Data download "about" text: one line saying skill rows include when the next recall is due and when the
  child last remembered the skill.

## Privacy

Same kind of data as today (skill progress). No new place it goes. Lawyer brief unchanged.

## Out of scope

Anything the kid sees about recall, rewards/sticker changes, per-skill gap tuning, avoiding templates across
sessions, parent-tunable schedule.

## Testing

- Unit: `recallTarget` (due, not due, seen this session, null `checkDue`, ordering), `reviewTarget` skips due
  skills, every scoring row, Help 1 as a miss, retry not scored, recall finishes before end, no recall in a
  placement session, old states/sessions without the new fields.
- Sim: a forgetful bot (forgets a skill after N days away) — forgotten skills return to practice; a
  remembering bot climbs to the 21-day gap; one slip never drops mastery during a recall.
- Rows: round-trip of the three fields. db: `save_step` saves them.
- Parent: every table row in `kidRecord` tests; email and summary words.
- e2e: seed a skill mastered 2 days back, play to the review slot, see two problems of it, then the parent
  page shows `remembered`.

## Build order (Codex tasks)

- **T13** model + engine + sims. **T14** migration, rows, parent words, email, download text. **T15** e2e.
