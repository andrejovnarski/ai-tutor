# Adaptive Tutor: Learning Experience Improvements and Feature Roadmap

Review date: October 19, 2026

This document turns the code review into a practical improvement roadmap. It describes the original findings, why each change matters, the proposed behavior, and how to decide whether the work is complete. Some improvements have since been implemented; the status updates below take precedence over historical descriptions.

## Implementation status update — October 21, 2026

This update supersedes the October 19 audit below for the rows it lists. As before, "Implemented" means the code and automated tests are present; no real-child playtest has been observed yet.

| Roadmap item | Status | Evidence and remaining work |
| --- | --- | --- |
| §5 Placement by skill branch | Partly addressed | Placement still searches one ordered list, but each probe can now move at most `MAX_STEP = 6` skills (`src/domain/kid/placement.ts`), so a young child no longer jumps to hard sums after two right answers. Simulations are grade-matched. Branch-specific probes are still outstanding. |
| §7 Child-requested help | Implemented | Help me button on every problem: Help 1 = hint + teaching picture, Help 2 = Nova shows how and the child types the answer. Stored as `helped` (migration `0009_helped_attempts.sql`), scored like a wrong first try with no visible penalty. Spec `docs/superpowers/specs/2026-10-20-help-me-design.md`. Voice "help" is later work. |
| §8 Interactive math objects | First interaction implemented | Fill the frame on Make 10: tap empty ten-frame cells to add counters, undo, Start over; a helping tool only, tiles still answer. Spec `2026-10-20-fill-the-frame-design.md`. Needs playtesting with 2–3 children before more interactions. |
| §9 Personal progress journey | Implemented (short form) | End card shows a "Today" line (learned / kept going / practiced) and a "Next time" line. Spec `2026-10-20-progress-lines-design.md`. Open: placement + Help 1 rescue shows "kept going"; "practiced" counts problems served, not answered. The Pocket Planet island map (flags per mastered skill) adds a look-only journey view. |
| §10 Delayed mastery checks | Implemented | Recall checks at growing gaps of 1, 3, 7, 21 days (a "day" is 20 hours), two problems per recall (migration `0010_recall.sql`). Spec `2026-10-20-recall-checks-design.md`. |
| §11 Actionable parent reports | Improved | Child page now says `Learned … · not checked yet`, `remembered …`, or `Practicing again`, and session lines count helped problems. Since October 22 it stays short: up to 3 "Needs a hand" skills, then one closed fold per island with a one-line summary ("2 of 5 learned · working on …"); newest 5 sessions open, older ones folded; stickers as a tile row with reasons folded (T25). Weekly email home tip is still chosen per family. |
| §12 Observed child pilot | Not done | Owner-run playtests (Milestone B) are next. |

Also built since October 19 (outside the numbered items): rewards (XP, levels, streaks, stickers; `2026-10-19-rewards-design.md`), the Pocket Planet look for kid screens (`2026-10-20-pocket-planet-design.md`) and the matching grown-up Logbook look (`2026-10-21-grownup-logbook-design.md`). October 22: the number-line jump is redrawn as a hop that lands straight down on the answer's tick (`DESIGN.md`, "Number-line jump").

Last full run on `main` (October 22, after T25): unit 1,460 passed, database 136, browser 67, typecheck clean. Migrations `0009` and `0010` must be pushed to hosted Supabase before the next deploy.

## Implementation status audit — October 19, 2026

Statuses reflect the current source code and test coverage. “Implemented” means the code is present; it does not establish that real-child playtests or every original acceptance criterion have been completed.

| Roadmap item | Status | Evidence and remaining work |
| --- | --- | --- |
| §3 Clear session endings | Implemented | `src/server/play.ts` returns the end turn, restores a same-day summary, and exposes explicit `playAgain`. The client calls `/play-again`. Unit tests cover reloads, day boundaries, duplicate answers, racing requests, and offline retry. Database and browser regression tests are also present. |
| §4 Teaching styles on the board | Initial scope implemented; broader support outstanding | `src/domain/problems/styleView.ts` and `src/server/publicTurn.ts` switch retry visuals for six simple-sum templates within 10. Supported representations are counters, ten-frames, number lines, and blocks. Stored retries restore the same visual. Story, Make 10, Missing number, subtraction, and other curriculum templates still use their original pictures. This meets the explicitly scoped first slice in the newer style-on-board spec. |
| §5 Placement by skill branch | Outstanding | `src/domain/kid/placement.ts` still searches one ordered list and marks the prefix below `lo` as known through placement. Branch-specific probes and the proposed distinction in parent-facing confidence labels are not implemented. |
| §6 Audience and curriculum alignment | Copy changes implemented | `src/app/about.ts` defines K–2 foundations messaging and welcomes older children. Sign-in lists the actual curriculum clusters; add-child shows the grade-coverage hint; page metadata uses the updated description. Whether the experience feels appropriate to older children still needs observation. |
| §7 Child-requested help | Outstanding | The play screen has answer and speech controls but no explicit Help me action or assisted-answer model. Automatic support after an incorrect attempt already exists. |
| §8 Interactive math objects | Outstanding | Math visuals are SVG renderers, without the proposed counter manipulation, tap-to-place, reset, or undo flow. |
| §9 Personal progress journey | Outstanding | The completion card shows problem counts and first-try correctness. It does not show a skill journey, a specific learned milestone, or a next-visit preview. |
| §10 Delayed mastery checks | Outstanding | `reviewTarget` selects the oldest mastered skill for the existing review cadence. There are no elapsed-time due intervals or separate retention indicators. |
| §11 Actionable parent reports | Partially covered by existing functionality | Weekly emails already include named skills, plain-language stuck points, and a home tip. The tip is selected across the family, not separately for every child. Placement estimates, assisted success, and retained knowledge are not clearly distinguished; assistance and retention models are still outstanding. |
| §12 Observed child pilot | Not verified | The repository includes browser tests and a temporary automated rehearsal, but these do not establish that 3–5 children were observed. No completed observation record was found in the reviewed documentation. |

### Audit verification

- `npm test -- --reporter=dot`: **69 test files passed; 1,142 tests passed.**
- `npm run typecheck`: **passed.**
- Database and browser regression tests were inspected but not executed during this audit.
- No live speech-provider calls or real-child playtests were performed.

### Next outstanding work

The first implementation milestone now has its three scoped changes in code: session endings, simple-addition visual adaptation, and audience copy. Confirm the browser and database checks and observe the pilot before treating the full learning experience as validated. Branch-aware placement remains the largest unchanged adaptation concern. Use pilot findings to prioritize requested help, interactive objects, and progress feedback.

## 1. Overall assessment

Adaptive Tutor has a strong technical foundation: deterministic problem generation and grading, adaptive difficulty, mistake tags, teaching-style selection, speech input and output, parent reporting, and privacy controls.

Keep the existing separation of responsibilities: application code decides whether an answer is correct and what to teach next; AI expresses the tutor's response. Proposed features should preserve that separation.

The next milestone should improve the quality and completeness of the learning loop before substantially expanding the product. The highest priorities are clear session endings, explanations that match the board, and placement that recognizes uneven knowledge.

### Evidence and limits of this review

- The review covered source code and design documents.
- The unit test suite passed: 65 test files and 1,031 tests.
- The TypeScript check passed.
- Browser end-to-end tests and database integration tests were not run as part of this review.
- The running interface was not visually evaluated, and no real-child playtest was conducted.
- Passing automated tests demonstrates consistency with existing expectations; it does not establish educational effectiveness or engagement.

## 2. Priority overview

| Order | Improvement | Intended result |
| --- | --- | --- |
| 1 | Return completed sessions to the child | A clear finish, summary, and explicit choice to continue |
| 2 | Connect teaching styles to board visuals | Explanations that children can follow visually |
| 3 | Make placement sensitive to skill branches | Starting work that reflects uneven knowledge |
| 4 | Align product positioning with curriculum | Clear expectations for families |
| 5 | Run observed playtests | Evidence for the next product decisions |
| 6 | Add requested hints and one interactive visual | More effective support during difficulty |
| 7 | Improve progress feedback and delayed checks | Visible progress backed by evidence of retention |

These priorities are recommendations, not a commitment to implement every feature before a pilot.

## 3. Improvement: give sessions a clear ending

Status: **Implemented.** See the audit above and `docs/superpowers/specs/2026-10-19-session-ending-design.md`.

### Original behavior

The domain engine can end a session and generate a summary. The client also has an end card, but the server's `commit` function immediately starts a fresh session when the engine returns an end turn. That replaces the end turn before it reaches the normal client flow.

Relevant files:

- `src/server/play.ts`: session commit and rollover behavior.
- `src/domain/session/engine.ts`: session completion rules and summary generation.
- `src/app/play/EndCard.tsx`: existing completion UI.
- `src/app/play/playMachine.ts`: client support for end turns.
- `src/server/play.test.ts`: existing tests explicitly expect automatic rollover.

### Why change it

Children should be able to recognize that they finished a session. A visible stopping point also makes the app's intended session duration meaningful. Starting another session automatically can make practice feel endless.

### Proposed behavior

1. Save the completed session and its learning updates.
2. Return the end turn and summary to the client.
3. Display the completion card.
4. Let the child choose “Play again” or return to the child picker.
5. Start another session only through a defined new-session action or a later intentional visit.

Define reload and multi-tab behavior explicitly. A repeated answer request must not create another session, and refreshing the completion screen should have a predictable result.

### Acceptance criteria

- A normal session completion displays the end card instead of another problem.
- The summary belongs to the session that just finished.
- “Play again” starts exactly one new session.
- Leaving the completion screen does not automatically begin another session.
- Duplicate requests and competing tabs preserve the existing version and persistence guarantees.
- Unit and end-to-end coverage exercises the complete finish → summary → play-again flow.

## 4. Improvement: make teaching-style changes visible

Status: **Initial simple-addition scope implemented.** Broader curriculum coverage remains outstanding. See `docs/superpowers/specs/2026-10-19-style-on-board-design.md`.

### Original behavior

The engine selects an explanation style after a wrong answer. That style is passed into the tutor's wording plan, but the board renders the visual stored in the original problem. Tutor output supports visual cues, but the board does not use those cues to switch representations.

Relevant files:

- `src/domain/kid/style.ts`: explanation-style selection.
- `src/domain/session/engine.ts`: retry and explanation behavior.
- `src/server/tutor/plan.ts`: style context for tutor responses.
- `src/server/tutor/types.ts`: tutor visual cues.
- `src/server/publicTurn.ts`: browser-visible problem data.
- `src/app/play/Board.tsx` and `src/app/play/visuals/`: visual rendering.

### Why change it

An explanation that asks a child to use blocks is harder to follow when the board still shows an equation or an unrelated picture. Visual adaptation would make the product's teaching-style adaptation concrete.

### Proposed behavior

- Build supported explanation visuals deterministically from structured problem data.
- Send the selected representation to the client with the corresponding explanation.
- Keep the same mathematical problem and intended answer while changing its representation.
- Coordinate the board and speech so the child sees what Nova describes.
- Begin with a small supported subset, such as addition within 10 shown with counters, a ten-frame, or a number line.

Do not rely on AI to invent visual quantities or arithmetic. Some templates may need additional structured operands or teaching metadata; inspect that requirement before implementing generic conversions.

### Acceptance criteria

- A supported style switch visibly changes the board to the selected representation.
- Spoken instructions refer to objects or actions present on the board.
- Quantities and operations remain mathematically equivalent across representations.
- Hints preserve the intended answer-reveal policy; final explanations can show the completed solution.
- Unsupported conversions use a coherent fallback explanation.
- Reloading a retry restores the matching visual and tutor line.
- Visual descriptions remain available to screen readers.

## 5. Improvement: place children by skill branch

Status: **Partly addressed** (step cap, October 20). Branch-specific probes are still outstanding.

### Current behavior

Placement performs a binary search over the ordered curriculum list. At completion, it marks skills below the inferred boundary as mastered by placement. This assumes knowledge approximately follows a single ordered progression.

Relevant files:

- `src/domain/kid/placement.ts`: probes and inferred mastery.
- `src/domain/kid/bkt.ts`: mastery rules, including placement status.
- `src/domain/curriculum/index.ts`: ordered skills and clusters.
- `src/domain/sim/sim.test.ts`: placement simulations, primarily based on known skill prefixes.

### Why change it

A child may be strong in addition and weak in subtraction or place value. A single boundary can hide those gaps or send the child through work they already know.

### Proposed behavior

- Use short probes across relevant branches of the prerequisite graph.
- Treat grade as a starting suggestion rather than evidence of mastery.
- Probe uncertain prerequisite skills when needed.
- Distinguish knowledge inferred during placement from mastery demonstrated through independent practice.
- Revisit uncertain inferences during ordinary sessions so initial placement remains brief.

The exact probe count and confidence rules require design and simulation. Avoid replacing the current short assessment with a long examination.

### Acceptance criteria

- Simulations include uneven profiles: strong addition with weak subtraction, strong computation with weak word problems, and missing place-value prerequisites.
- Passing one branch does not automatically master unrelated branches.
- A single slip or lucky guess does not cause a large unsupported placement jump.
- Placement remains bounded and supports interruption and resumption.
- Parent-facing language distinguishes estimated knowledge from demonstrated progress.
- Existing accounts and persisted placement state have a defined migration or compatibility strategy.

## 6. Improvement: align audience and curriculum

Status: **Copy changes implemented; audience fit still needs playtesting.**

### Current situation

The design targets ages 5–7 and 8–11, while the implemented curriculum focuses on K–2 number sense, addition, subtraction, place value, and word problems. That can serve older children needing foundational practice, but it does not provide the full math curriculum typically implied by the wider age range.

### Recommendation

Initially describe the product around early math foundations and children who need those skills. Be explicit about covered topics. Use family feedback and observed curriculum limits to decide when to add multiplication, division, fractions, or other strands.

### Acceptance criteria

- Product descriptions clearly identify the covered math topics.
- Onboarding does not imply broad grade-level coverage beyond the available curriculum.
- Older children can use foundational material without unnecessarily childish language or presentation.
- Curriculum expansion follows evidence of demand and a reviewed prerequisite plan.

## 7. New feature: child-requested help

Status: **Implemented** (October 20). See `docs/superpowers/specs/2026-10-20-help-me-design.md`.

### Purpose

Let children ask for support before submitting an incorrect answer. The current retry-based explanation loop should be complemented by an explicit help action.

### Suggested experience

1. The child taps a large “Help me” control.
2. Nova gives a short strategy hint with matching visual support.
3. If needed, the child requests a more explicit demonstration.
4. The child attempts the answer or completes a supported step.

### Learning-model requirements

- Record assistance separately from independent performance.
- Decide how assisted answers affect mastery before shipping the feature.
- Do not treat a correct answer after a full demonstration as equivalent evidence to an independent correct answer.
- Keep help accessible through touch, keyboard, and speech output.

### Acceptance criteria

- Help is available before an incorrect attempt.
- Initial hints support thinking without immediately stating the answer.
- Repeated help requests have a defined, bounded progression.
- Help events and assisted attempts are represented consistently in persistence and reports.
- Requesting help has no punitive visual treatment.

## 8. New feature: interactive math objects

Status: **First interaction implemented** (Fill the frame on Make 10, October 20). See `docs/superpowers/specs/2026-10-20-fill-the-frame-design.md`.

### Purpose

Allow children to act on mathematical representations rather than only inspect pictures and submit numbers.

### Candidate interactions

- Move counters into groups for addition.
- Fill a ten-frame to explore making ten.
- Make individual jumps on a number line.
- Exchange a ten rod for ten ones during regrouping.

Start with one skill and one interaction. Making ten is a useful candidate because a ten-frame provides a clear, bounded task.

### Acceptance criteria

- Interaction state and grading are deterministic.
- Touch targets work on the intended tablet viewport.
- A tap-based alternative exists for drag actions.
- Keyboard and screen-reader users have an equivalent way to complete the task.
- Children can reset or undo an action.
- Reload and network recovery behavior is defined.
- Playtests establish that children understand the interaction without adult instruction.

## 9. New feature: a personal progress journey

Status: **Implemented in short form** (Today / Next time lines, October 20). See `docs/superpowers/specs/2026-10-20-progress-lines-design.md`.

### Purpose

Give children a simple view of what they have learned and what comes next.

### Suggested experience

- Show a small sequence of learning milestones rather than the full prerequisite graph.
- Celebrate a concrete achievement, such as solving a new type of problem or practicing a difficult strategy.
- At session end, show one meaningful accomplishment and a preview of the next visit.
- Recognize persistence and useful help-seeking alongside correctness.

### Acceptance criteria

- Progress comes from recorded learning events.
- Placement estimates are not presented as achievements earned during practice.
- Children are not punished for missing a day.
- Rewards do not pressure children to continue beyond a completed session.
- A child can understand the next step without reading a complex dashboard.

## 10. New feature: delayed mastery checks

Status: **Implemented** (recall checks, October 20). See `docs/superpowers/specs/2026-10-20-recall-checks-design.md`.

### Current behavior

The engine already reviews mastered skills approximately every fifth problem and selects the least recently seen eligible skill. This proposal refines that behavior rather than adding review from scratch.

### Proposed behavior

- Schedule checks after meaningful elapsed time, including later visits.
- Use a different template or representation when possible.
- Separate immediate success from evidence that knowledge persisted.
- Use check results to adjust review timing and the learning model.

### Acceptance criteria

- Review selection accounts for elapsed time as well as problem counts.
- A delayed check measures independent work rather than a just-demonstrated answer.
- Poor recall results in supportive practice.
- Parent reports can distinguish recent acquisition from retained knowledge without overstating certainty.
- Simulations cover returning after inactivity and forgetting previously demonstrated skills.

## 11. Refinement: make existing parent reports more actionable

Status: **Improved** (learned vs remembered, helped counts, October 20). The home tip is still chosen per family; see the October 21 update.

The application already has weekly reporting and parent progress screens. Improve those before adding another dashboard.

Each report should answer:

1. What improved this week?
2. What remains difficult?
3. What can we try together for two minutes?

For example, a report could explain that a child is becoming more confident adding within 10, still mixes up subtraction with addition, and could practice taking away counters from a small group at home. Only make claims supported by the recorded attempts.

### Acceptance criteria

- Reports name concrete skills and explain mistake patterns in everyday language.
- Each report offers one short activity tied to an observed need.
- Limited data produces appropriately cautious wording.
- Placement estimates, assisted success, and independent mastery remain distinguishable.
- Families do not need to interpret probabilities or internal mistake tags.

## 12. Recommended delivery sequence

### Milestone A: complete the existing experience

- Fix session completion and explicit play-again behavior.
- Connect one explanation style to a matching board representation.
- Review audience and curriculum descriptions.
- Add meaningful regression coverage for the changed flows.

### Milestone B: observe a small pilot

Run sessions with 3–5 children and a parent present. Observe without helping unless necessary. Record where children need adult help, misunderstand Nova, struggle with controls, lose interest, or cannot tell whether they have finished.

Suggested observation questions:

- Can the child start and answer the first problem independently?
- Does a wrong-answer explanation help them understand the next attempt?
- Does the child understand the visual representation?
- Are speech recognition and playback usable on the family's actual device?
- Does the child notice the session ending?
- Do they choose to return on another day?
- Can the parent explain the child's progress after reading the report?

Use observations to choose the next feature. A usability failure in the basic loop should take priority over additional rewards or curriculum breadth.

### Milestone C: strengthen adaptation and support

- Improve placement using uneven-knowledge simulations and pilot findings.
- Add child-requested help with explicit assisted-answer semantics.
- Build one interactive representation if observations support it.
- Introduce delayed checks and clearer parent reporting.
- Add the progress journey once its milestones reflect trustworthy learning evidence.

## 13. Measures for judging progress

The existing design identifies children returning at least three times per week as its initial success target. Evaluate that alongside learning and usability signals.

| Signal | What it helps assess |
| --- | --- |
| Days practiced per child per week | Whether children and families return |
| Adult interventions during observed sessions | Whether the experience is independently usable |
| Session completion and voluntary stopping | Whether the session structure is understandable |
| Independent first-try success by skill | Whether challenge is appropriate |
| Success after help or explanation | Whether support appears useful in the moment |
| Independent success on delayed checks | Whether learning persists |
| Speech failures, response latency, and fallback frequency | Whether the technical experience interrupts learning |
| Parent understanding of reports | Whether reports communicate useful progress |

These measures require careful definitions. In particular, retries, assisted answers, and independent attempts should not be combined into a single misleading accuracy number. Use minimal first-party instrumentation consistent with the project's existing privacy design.

## 14. Work to defer until evidence supports it

- Broad curriculum expansion before the foundational experience is validated.
- Another parent dashboard duplicating existing reports.
- Competitive leaderboards or rewards that encourage endless sessions.
- Open-ended child chat that changes the current bounded tutor model.
- Native apps, school administration, and other major platform expansions during the initial learning-loop improvements.

The immediate objective is a complete, understandable session in which a child receives useful support, finishes with a sense of progress, and wants to return.
