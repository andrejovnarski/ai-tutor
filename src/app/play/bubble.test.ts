import { describe, expect, it } from "vitest";
import { bubbleView, wantsHold } from "./bubble";
import { playReducer, type PlayState } from "./playMachine";

const next = { say: "Here is a new one.", tone: "curious" as const };
const moved = (over: Partial<PlayState>): PlayState => ({
  phase: "problem", version: 2, line: next, message: "Yes, 7!", messageTone: "cheer", note: null, correct: true, ...over,
});

describe("bubbleView", () => {
  it("correct answer: holds the feedback line with its own tone, then swaps to the new line", () => {
    const s = moved({});
    expect(wantsHold(s, false)).toBe(true);
    expect(bubbleView(s, { reduced: false, holdDone: false }))
      .toEqual({ say: "Yes, 7!", tone: "cheer", hop: true, holding: true });
    expect(bubbleView(s, { reduced: false, holdDone: true }))
      .toEqual({ say: "Here is a new one.", tone: "curious", hop: true, holding: false });
  });
  it("non-correct move-on: the explain line stays as a lead above the new line, the note beside it", () => {
    const s = moved({ correct: false, message: "4 more than 3 is 7.", messageTone: "calm", note: "The answer is 7." });
    expect(wantsHold(s, false)).toBe(false);
    for (const holdDone of [false, true]) {
      expect(bubbleView(s, { reduced: false, holdDone })).toEqual({
        say: "Here is a new one.", lead: "4 more than 3 is 7.", note: "The answer is 7.", tone: "curious", hop: false, holding: false,
      });
    }
  });
  it("reduced motion: a correct answer shows lead plus line, no hold and no hop", () => {
    const s = moved({});
    expect(wantsHold(s, true)).toBe(false);
    expect(bubbleView(s, { reduced: true, holdDone: false }))
      .toEqual({ say: "Here is a new one.", lead: "Yes, 7!", tone: "curious", hop: false, holding: false });
  });
  it("Nova hops only on a correct answer with motion allowed", () => {
    expect(bubbleView(moved({}), { reduced: false, holdDone: true }).hop).toBe(true);
    expect(bubbleView(moved({}), { reduced: true, holdDone: true }).hop).toBe(false);
    expect(bubbleView(moved({ correct: false }), { reduced: false, holdDone: true }).hop).toBe(false);
  });
  it("a retry (no message) shows the feedback line as Nova's line, with any note", () => {
    const s: PlayState = { phase: "problem", version: 3, line: { say: "Try again!", tone: "calm" }, note: "n", correct: false };
    expect(bubbleView(s, { reduced: false, holdDone: false }))
      .toEqual({ say: "Try again!", note: "n", tone: "calm", hop: false, holding: false });
  });
  it("the note never sits under the new problem's line alone after a swap", () => {
    const s = moved({ note: "The answer is 7." });
    expect(bubbleView(s, { reduced: false, holdDone: true }).note).toBeUndefined();
  });
  it("said: Nova's reply leads above the problem's line, no hold, no hop, no stale note", () => {
    const s = playReducer(moved({ message: undefined, note: "The answer is 7." }),
      { type: "said", line: { say: "Cats are fun! Let's count.", tone: "calm" } });
    expect(bubbleView(s, { reduced: false, holdDone: false })).toEqual({
      say: "Here is a new one.", lead: "Cats are fun! Let's count.", tone: "curious", hop: false, holding: false,
    });
  });
});
