# Rewards: cubes, levels, week goal and stickers

Date: 2026-10-19. Owner-requested gamification (XP, levels, streaks, badges), shaped to fit PRODUCT.md and
DESIGN.md ("The Math Classroom"). Overlaps roadmap §9 (personal progress journey) and keeps its acceptance criteria.

## Intent

**What the owner said:** add the full set: XP, levels, streaks and badges. Its job is all three of: bring kids back
(the v1 north star, 3+ sessions a week), show real learning progress, and make the product appealing to families.

**Order when these conflict** (from PRODUCT.md): the child's experience, then truthful learning, then coming back,
then how it demos. For example, nothing pays out for guessing, and nothing pressures a child to keep playing.

**Confirmed constraints:**
- No gamey arcade look and no cartoon clutter (DESIGN.md). Rewards are classroom objects: maths cubes and stickers.
- Nobody is punished for missing a day. Rewards never push a child to continue after a finished session.
- Placement is never shown as something earned in practice.
- Collect less: no new kind of child data.
- Nothing is competitive: no leaderboards, no comparing siblings.

## Decisions (owner, 2026-10-19)

| Question | Decision |
|---|---|
| Purpose | All of: return visits, visible learning, family appeal |
| Streaks | A weekly play goal (3 days), streak counted in weeks; a missed day never breaks anything |
| XP | Effort + learning: per problem, first-try bonus, skill mastered, session finished; nothing for speed |
| Look | XP fills a rod of 10 maths cubes (a rod = a level); badges are stickers on a sticker chart |
| Where | End card and picker only. Nothing new on screen during problems |
| Grown-ups | Rewards section on the child page; one line in the weekly email |
| Approach | Work everything out from existing session rows; no new tables (approach A) |

## Rules

All rewards are worked out from the kid's `sessions` rows, plus `skill_state.mastered_at` for topic stickers only. A session counts only if it **finished**: `ended_at` is
set (the engine ended it) and `state.problems >= 1`. A session's **day** is the New York date of
`state.lastActivity` (the same rule the end card uses, see `nyDay`).

### XP

| Event | XP | Source |
|---|---|---|
| Problem worked through (right on the first or second try, or shown after two tries) | +10 | `state.problems` |
| Right on the first try | +5 | `state.firstTryCorrect` |
| Skill mastered in practice | +100 | `state.mastered` (the engine adds a skill only when practice crosses mastery, never in placement) |
| Session finished | +20 | the session counts at all |

No XP for speed. A typical 15-problem session earns about 200–250 XP.

### Cubes and levels

- 50 XP = 1 cube. 10 cubes = 1 rod = 1 level. Level 1 is the start (0 cubes).
- The pace is the same at every level: about one level a week at 3 sessions a week.
- `level = 1 + floor(xp / 500)`, `cubesInRod = floor((xp mod 500) / 50)`.

### Week goal and week streak

- A week runs **Sunday to Saturday**, New York dates (the weekly report's week).
- A **day played** is a day with at least one finished session.
- **Week goal:** 3 days played in a week.
- **Week streak:** the number of consecutive completed weeks, ending with last week, that met the goal, plus 1 if
  this week has already met it. The week in progress never breaks the streak. A missed week starts the count again
  and nothing anywhere says something was lost.

### Stickers

Earned once, never removed. Each has a date (the day of the session that earned it).

| Sticker | Earned when | Art |
|---|---|---|
| First game | the first finished session | a star |
| Skill (one per skill, named after it, e.g. "Make 10") | that skill is in a finished session's `mastered` | the cluster's picture (ten-frame, number line, cube rod, counters) |
| Topic (one per cluster, e.g. "Add within 10") | every skill in the cluster is mastered (`skill_state.mastered_at` set, by practice or placement) **and** at least one of them earned a skill sticker in practice. Dated at the later of the two. A cluster known only from placement earns nothing | a cube rod |
| Great weeks: 1, 4, 10 | the total number of weeks that met the goal reaches 1, 4, 10 (total, not in a row) | a calendar page |
| Kept trying: 10, 50, 150 | the running total of `problems - firstTryCorrect` reaches 10, 50, 150 | a pencil |

The catalogue is built from `CLUSTERS` / `SKILLS` in `src/domain/curriculum`, so new skills get stickers automatically.

### Invariants (enforced by tests)

1. Adding any finished session never lowers XP or level and never removes a sticker.
2. Reward values may be raised but never lowered: a test pins the current values as minimums.
3. Skills marked known by placement never earn XP or stickers.
4. Rewards never change which problem comes next, how a session ends, or anything the kid model sees.
5. No reward text mentions losing, missing or breaking anything.

## What children see

### End card

Under "Great work today!" and the existing counts:

- **XP and rod:** "+215" and this level's rod of 10 cube outlines. The cubes earned this session drop in one after
  another (about 1 s total, ease-out). Under `prefers-reduced-motion`, the rod shows its final state at once.
- **Level up:** when the rod fills, the finished rod steps aside, a new empty rod starts, and the card says
  "Level 5!". No confetti.
- **New stickers:** up to 3 stickers (round, drawn SVG, short label under each), then "+N more".
- **The week:** 7 day dots for this week, filled for days played, and either "1 more day for your week goal",
  "2 more days for your week goal" or "Week goal done!".
- Play again and Back to kids are unchanged. No text suggests playing more right now.
- Restoring the end card (reload, or tapping the name again the same day) shows the same rewards.
- Narrow screens (600 px or less): the rewards stack under the counts and the rod scales to the card width.

### Picker

Each kid card adds a small "Lv 4", a mini rod (10 cube outlines, the earned ones filled) and this week's 7 dots. The
card width does not change.

### During problems

Nothing new. The existing Nova line on a mastered skill stays as it is.

## What grown-ups see

- **Child page:** a "Rewards" section between "this week" and "Progress", in the exercise-book style: level and rod,
  the week streak ("Week goal met 4 weeks in a row" or, at 0, "Week goal: 3 days a week"), and the sticker chart as
  a list with dates and plain words ("Make 10 — mastered in practice, Oct 14").
- **Weekly email:** one line, e.g. "Mia reached level 5, earned 2 stickers, and has met her week goal 4 weeks in a
  row." Each part appears only if it is true for that week. With nothing to say, the line is left out.

## Architecture

| Unit | Does | Depends on |
|---|---|---|
| `src/domain/rewards/rules.ts` | Reward values, `XP_PER_CUBE`, `CUBES_PER_LEVEL`, `WEEK_GOAL_DAYS` | nothing |
| `src/domain/rewards/stickers.ts` | The sticker catalogue (id, kind, label, art), from the curriculum | curriculum |
| `src/domain/rewards/progress.ts` | `progress(sessions, masteredAt, today) -> Progress` and `gained(before, after) -> Gained` | rules, stickers, `nyDay` |
| `src/server/rewards.ts` | Loads a kid's (or a parent's kids') finished-session rows, selecting only `ended_at`, `state->problems`, `state->firstTryCorrect`, `state->mastered`, `state->lastActivity`, and `skill_state` `skill_id, mastered_at`; calls `progress` | supabase client (the grown-up's, so RLS applies) |
| `src/app/play/RewardsStrip.tsx` | End-card rewards: XP, rod, level up, stickers, week dots | `StickerArt` |
| `src/app/MiniRewards.tsx` | Picker card level, mini rod, week dots | none |
| `src/app/parent/ui/RewardsSection.tsx` | Child-page rewards section | `StickerArt` |
| `src/app/rewards/StickerArt.tsx` | Drawn sticker SVGs, chalk/ink strokes in the DESIGN.md palette | none |
| `src/server/report/*` | Adds the one email line | `progress` |

`Progress = { xp, level, cubesInRod, week: { days: boolean[7], played, goalMet }, weekStreak, stickers: { id, at }[] }`.
`Gained = { xp, levelBefore, levelAfter, cubesBefore, cubesAfter, newStickers }`.

**Data flow (end card):** when the engine ends a session, `commit()` saves the step as now. The end turn then gets
`rewards`: progress over the finished sessions **before** this one, progress **including** it, and the difference.
`summaryOf` and the restored end card (`current` on the same day) go through the same path, so a reload shows the
same rewards. The picker and the child page call the loader for each kid. The email builder calls `progress` with the
report's week.

**Flag:** `REWARDS=on|off` (default **off**), read in `src/server/env.ts`. Off: no rewards in the end turn, picker or
child page, and no email line. This lets the code ship before the lawyer answers (below).

## Privacy

- No new tables, columns or stored fields. Nothing new is sent to Claude or any other vendor.
- The data export already holds the source rows (sessions, skill_state). No change.
- Privacy notice: add "Rewards (cubes, levels and stickers) are worked out from your child's answers. We don't keep
  anything extra for them." This makes a new notice version.
- **Lawyer question (added to `docs/lawyer-brief.md`):** does a notice change that adds no new data and no new
  vendor need fresh consent from families who consented to the earlier version? `REWARDS` stays off in production
  until it is answered.

## Failures

- If loading rewards fails (query error, timeout), the end card, picker and child page render without rewards and
  the server logs the error with the kid id only, no name. Play is never blocked.
- A malformed or missing `state` field counts as 0 / empty, never as an error.

## Testing (test-first)

- **Unit, `progress`:** a table of cases for each rule: XP sums, cube and level boundaries (499/500/550), week
  boundaries on Saturday/Sunday in New York (including the DST weeks), streak with a missed week, the week in
  progress, every sticker kind and its date, placement-only skills earning nothing, a topic finished partly by placement
  earning its sticker and a topic known only from placement earning nothing, unfinished sessions ignored.
- **Property (fast-check):** for random session histories, appending a finished session never lowers XP or level
  and never removes a sticker; `gained` is never negative.
- **Pinned values:** a test fails if any reward value in `rules.ts` drops below today's value.
- **Copy:** no reward string contains "lose", "lost", "miss", "break" or "broke".
- **Server:** the loader selects only the listed fields; `commit()` attaches rewards when `REWARDS=on` and not when
  off; the restored end card's rewards equal the original's.
- **E2E:** finish a session and see XP, rod and week dots; reload and see the same; picker shows the level; child
  page shows the sticker chart; reduced motion shows the final rod; `REWARDS=off` shows none of it.
- **Report:** the email line appears, is partial when only some parts are true, and is absent when nothing is new.
- **Screens:** `kid-shots` and `grownup-shots` cover the new end card, picker and child page at all sizes.

## Out of scope

- XP or anything else on screen during problems.
- A separate kid "My stickers" page (the grown-up child page has the full chart).
- Nova lines about rewards.
- Leaderboards, sibling comparison, rest days, purchases, unlockable themes or avatars.
- Storing rewards (approach B or C). Revisit only if reads get slow in the pilot.
