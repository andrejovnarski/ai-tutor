import { describe, it, expect } from "vitest";
import { detectDistress } from "./detect";
import { DISTRESS_REPLY } from "./phrases";

describe("detectDistress", () => {
  it.each(["I want to DIE", "i  want   to die!!", "sometimes I want to die.", "my brother hits me", "I'm scared at home"])("hits %s", (t) => {
    expect(detectDistress(t).hit).toBe(true);
  });
  it.each(["skill", "I killed it at math", "die roll", "a hit song"])("does not hit %s", (t) => {
    expect(detectDistress(t)).toEqual({ hit: false });
  });
  it("reply is the spec text", () => {
    expect(DISTRESS_REPLY).toBe("That sounds hard. Please tell a grown-up you trust.");
  });
});
