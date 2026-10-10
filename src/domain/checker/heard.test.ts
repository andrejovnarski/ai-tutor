import { routeHeard } from "./heard";

const h = (text: string, confidence = 0.9, alternatives: string[] = []) => ({ text, confidence, alternatives });

describe("routeHeard", () => {
  it("confident single number answers", () => expect(routeHeard(h("twelve"))).toEqual({ kind: "answer", n: 12 }));
  it("low confidence confirms", () => expect(routeHeard(h("twelve", 0.59))).toEqual({ kind: "confirm", n: 12 }));
  it("0.6 exactly answers", () => expect(routeHeard(h("12.", 0.6))).toEqual({ kind: "answer", n: 12 }));
  it("alternative that disagrees confirms", () => expect(routeHeard(h("twelve", 0.95, ["twenty"]))).toEqual({ kind: "confirm", n: 12 }));
  it("non-number alternatives don't block", () => expect(routeHeard(h("eight", 0.9, ["ate", "hey"]))).toEqual({ kind: "answer", n: 8 }));
  it("no number is say", () => expect(routeHeard(h("I like cats"))).toEqual({ kind: "say", text: "I like cats" }));
  it("empty is nothing", () => expect(routeHeard(h("  "))).toEqual({ kind: "nothing" }));
  it("two different numbers are ambiguous → say", () => expect(routeHeard(h("five six")).kind).toBe("say"));
});
