import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { allCannedSays } from "../tutor/canned";
import { DISTRESS_REPLY } from "../distress/phrases";
import { NOVA_VOICE } from "./voice";
import { speakable } from "./speakable";
import { clipKey, clipsFrom } from "./clips";
import { premakeList } from "./premake";

describe("premakeList", () => {
  const list = premakeList();
  it("has no braces, digits or duplicates, and includes the distress reply", () => {
    for (const t of list) {
      expect(t).not.toMatch(/[{}]/);
      expect(t).not.toMatch(/\d/);
    }
    expect(new Set(list).size).toBe(list.length);
    expect(list).toContain(DISTRESS_REPLY);
  });
  it("includes the fixed tablet copy but not the numeric one", () => {
    expect(list).toContain("Let's try again.");
    expect(list).toContain("I didn't catch that. Try again or tap your answer.");
    expect(list).toContain("I couldn't hear. Tap your answer.");
    expect(list.some((t) => t.startsWith("Did you say"))).toBe(false);
  });
  it("length = unique speakable templates without {answer} + 4", () => {
    const uniq = new Set(allCannedSays().filter((s) => !s.includes("{answer}")).map(speakable));
    expect(list.length).toBe(uniq.size + 4);
  });
});

describe("clipKey", () => {
  it("is the stable sha256 of voice|rate|text", () => {
    const expected = createHash("sha256").update(`${NOVA_VOICE.name}|${NOVA_VOICE.rate}|Let's try again.`).digest("hex");
    expect(clipKey("Let's try again.")).toBe(expected);
  });
});

describe("clipsFrom", () => {
  it("reads the clips object", () => {
    expect(clipsFrom({ voice: "v", rate: "r", clips: { a: true, b: true } })).toEqual({ a: true, b: true });
  });
  it("treats anything malformed as empty", () => {
    for (const bad of [null, undefined, 3, "x", [], {}, { clips: null }, { clips: [] }, { clips: "x" }, { a: true }])
      expect(clipsFrom(bad)).toEqual({});
  });
  it("drops non-true entries", () => {
    expect(clipsFrom({ clips: { a: true, b: false, c: "yes" } })).toEqual({ a: true });
  });
});
