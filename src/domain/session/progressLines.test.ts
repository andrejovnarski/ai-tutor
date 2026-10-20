import { progressLines } from "./progressLines";
import { getSkill } from "../curriculum";
import type { Today, Next } from "./types";

it.each<[Today, string]>([
  [{ kind: "learned", skillId: "add-subtract-within-100.add-regroup" }, "You learned Big adding with carrying!"],
  [{ kind: "practiced", skillId: "add-subtract-within-100.add-regroup" }, "You practiced Big adding with carrying."],
  [{ kind: "kept-going" }, "You kept going and solved a tricky one!"],
  [{ kind: "placement" }, "You showed Nova what you can do!"],
])("today %j", (today, text) => expect(progressLines({ today, next: null })).toEqual({ today: text, next: null }));
it.each<[Next, string]>([
  [{ kind: "skill", skillId: "add-subtract-within-100.add-regroup" }, "Next time: Big adding with carrying"],
  [{ kind: "more", skillId: "add-subtract-within-100.add-regroup" }, "Next time: more Big adding with carrying"],
  [{ kind: "mix" }, "Next time: a mix of your skills"],
])("next %j", (next, text) => expect(progressLines({ today: null, next })).toEqual({ today: null, next: text }));
it("uses the skill name otherwise, and preserves nulls", () => {
  const skillId = "count-to-20.objects-to-10";
  expect(progressLines({ today: null, next: null })).toEqual({ today: null, next: null });
  expect(progressLines({ today: { kind: "practiced", skillId }, next: null }).today).toBe(`You practiced ${getSkill(skillId).name}.`);
});

it.each([
  ["subtract-within-10.break-apart", "Splitting numbers"],
  ["add-subtract-within-20.related-facts", "Number families"],
  ["add-subtract-within-100.add", "Adding big numbers"],
  ["add-subtract-within-100.add-regroup", "Big adding with carrying"],
  ["add-subtract-within-100.subtract", "Taking away big numbers"],
  ["add-subtract-within-100.subtract-regroup", "Big taking away with borrowing"],
  ["add-subtract-within-20.doubles", "Doubles"],
  ["place-value.ten-more-less", "Ten more, ten less"],
])("uses the exact kid name for %s", (skillId, name) => {
  expect(getSkill(skillId).kidName).toBe(name);
  expect(progressLines({ today: { kind: "practiced", skillId }, next: { kind: "more", skillId } }))
    .toEqual({ today: `You practiced ${name}.`, next: `Next time: more ${name}` });
});
