import { allCannedSays } from "../tutor/canned";
import { speakable } from "./speakable";

describe("speakable", () => {
  it.each([
    ["Great thinking, {name}!", "Great thinking!"],
    ["Here we go, {name}! Take your time.", "Here we go! Take your time."],
    ["{name}, look at this!", "Look at this!"],
    ["Not quite, {name}, but that's okay.", "Not quite, but that's okay."],
    ["Here's how it works, {name}: the answer is 7.", "Here's how it works: the answer is 7."],
    ["Hmm, a puzzle for us! Ready, {name}?", "Hmm, a puzzle for us! Ready?"],
  ])("%s → %s", (a, b) => expect(speakable(a)).toBe(b));

  it("every canned template speaks cleanly", () => {
    for (const t of allCannedSays()) {
      const s = speakable(t.replaceAll("{answer}", "12"));
      expect(s).not.toMatch(/[{}]|\s{2}|\s[,.!?:]|,[.!?]|^[,\s]|^[a-z]/);
    }
  });
});
