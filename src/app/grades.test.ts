import { describe, expect, it } from "vitest";
import { gradeName } from "./grades";

describe("gradeName", () => {
  it("spells out K and numbers the rest", () => {
    expect([gradeName("K"), gradeName("3")]).toEqual(["Kindergarten", "Grade 3"]);
  });
});
