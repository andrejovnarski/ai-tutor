# Teaching style on the board: the retry picture matches the chosen style

Date: 2026-10-19. Milestone A, project 2 of 3, from `docs/improvements/learning-experience-roadmap.md` §4.

## Problem

After a wrong first try the engine picks a teaching style for the retry (`pickStyle` in `src/domain/kid/style.ts`,
saved as `pending.style`). The style reaches Nova's wording plan (`src/server/tutor/plan.ts`) but the board keeps
drawing the problem's original picture (`problem.prompt.show`). A line about a number line next to a picture of
dots is hard to follow, and the style adaptation is invisible to the child.

## Decisions (owner, 2026-10-19)

- Start with **simple sums within 10**: the six "a + b" templates in `src/domain/curriculum/add-within-10.ts` —
  `add-objects-10`, `add-ten-frame-10` (skill Add with pictures), `add-facts-5`, `add-line-5` (Add within 5),
  `count-on-bigger-first`, `count-on-smaller-first` (Count on). Make 10 and Missing number keep their picture.
- Approach: the problem carries its two numbers; one builder draws the picture for a style. No conversion of
  existing pictures, no AI-made quantities.

## Design

### Domain

- `Problem` (`src/domain/types.ts`) gains an optional `sum?: [number, number]`: the two addends, with
  `answer === sum[0] + sum[1]`. The six templates set it; no other template does.
- New `src/domain/problems/styleView.ts`: `styleView(style: Style, sum: [number, number]): Visual | null`.

  | Style | Visual |
  |---|---|
  | `drawing` | `{ kind: "objects", icon: "apple", groups: [a, b] }` |
  | `ten-frame` | `{ kind: "ten-frames", first: a, second: b }` |
  | `number-line` | `{ kind: "number-line", from: 0, to: 10, marks: [a], jump: { from: a, by: b } }` |
  | `blocks` | `{ kind: "blocks", groups: [{ tens: 0, ones: a }, { tens: 0, ones: b }] }` |
  | `story` | `null` (no story picture yet: keep the original) |

  These are the same picture kinds the curriculum already uses as its easiest scaffolds, so a retry picture shows
  no more of the answer than a level-1 problem does today.
- The problem turn (`Turn` kind `"problem"`, `src/domain/session/types.ts`) carries `style: Style | null` from its
  pending problem, so the server and a reload both know the retry style.

### Server

- `publicTurn` (`src/server/publicTurn.ts`): for a problem turn with `try === 2`, a `style`, a `problem.sum`, and a
  non-null `styleView(style, sum)`, send that view as `prompt.show`. Otherwise send the original `prompt.show`.
  `prompt.say`, `input` and `choices` are unchanged; `sum` and `style` are never sent (the answer is their total).
- Nova (`src/server/tutor/plan.ts`): a wrong/explain plan includes `style` only when the board shows that style,
  i.e. `styleView(style, problem.sum)` is non-null. With no switched picture there is no style in the plan, so an
  AI line cannot name a picture that is not on the board. Canned lines already say "the picture" and need no change.
- Reload: the pending problem and its style are already stored in the session state, so a reloaded retry gets the
  same picture and its stored line. No migration.

### Client

No change: the board already renders every picture kind, and each kind has a screen-reader description
(`src/app/play/visuals/describe.ts`).

## Out of scope

Story pictures, Make 10 and Missing number, subtraction, interactive pictures (roadmap §8), animating the switch.

## Testing

- **Unit (`styleView`):** for every a, b ≥ 0 with a + b ≤ 10 and each supported style, the view's quantities add
  up to a + b (objects groups, ten-frame first + second, number-line jump end, blocks ones); `story` is null.
- **Unit (templates):** each of the six templates sets `sum` with `sum[0] + sum[1] === answer` across levels and
  seeds; the other add-within-10 templates do not set it.
- **Unit (`publicTurn`):** try 2 with a supported style sends the style view; try 1 sends the original; story and a
  problem without `sum` send the original; `sum` and `style` never appear in the output.
- **Unit (plan):** a wrong plan carries `style` for a supported view and omits it for story or no `sum`.
- **Unit (play):** after a wrong first answer on a sum problem, the answer response's `next.prompt.show` is the
  style view, and `playTurn` (reload) returns the same view.
- **Browser (`tests/e2e`):** a placed kid on a sum problem answers wrong once; the retry board renders the picture
  the server sent for try 2 (its kind is one of the table's, or the original for story), and a reload shows the same
  picture. The style is chosen at random, so which picture appears is pinned by the unit tests, not the browser test.
  Note `drawing` on an `add-objects-10` problem draws counters again: same kind, possibly a different icon.
