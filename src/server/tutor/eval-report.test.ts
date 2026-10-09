import { buildReport, estimateCost, percentile, type EvalResult } from "./eval-report";

const r = (outcome: string, ms: number, cacheRead = 0, guardReasons: string[] = []): EvalResult => ({
  id: "c", event: "present", outcome, ms, cacheRead, guardReasons, say: "hi",
});

describe("percentile", () => {
  it("uses nearest rank", () => {
    const xs = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentile(xs, 50)).toBe(50);
    expect(percentile(xs, 95)).toBe(100);
    expect(percentile([], 50)).toBe(0);
  });
});

describe("buildReport", () => {
  it("counts outcomes, guard reasons, latency, cacheRead", () => {
    const rep = buildReport([
      r("ai", 100, 1000), r("ai", 200, 1500), r("ai-retry", 300, 1500, ["numbers"]),
      r("canned:guard", 400, 0, ["word", "numbers"]), r("canned:timeout", 2500, 0),
    ]);
    expect(rep.total).toBe(5);
    expect(rep.outcomes).toEqual({ ai: 2, "ai-retry": 1, "canned:guard": 1, "canned:timeout": 1 });
    expect(rep.guardReasons).toEqual({ numbers: 2, word: 1 });
    expect(rep.cannedCount).toBe(2);
    expect(rep.p50).toBe(300);
    expect(rep.p95).toBe(2500);
    expect(rep.meanCacheRead).toBe(800);
    expect(rep.pass).toBe(false); // 40% canned
  });
  it("gate: exactly 10% canned passes, above fails", () => {
    const ok = Array.from({ length: 9 }, () => r("ai", 1));
    expect(buildReport([...ok, r("canned:error", 1)]).pass).toBe(true);
    expect(buildReport([...ok, r("canned:error", 1), r("canned:error", 1)]).pass).toBe(false);
  });
  it("empty input fails", () => {
    expect(buildReport([]).pass).toBe(false);
  });
});

describe("estimateCost", () => {
  it("is cases x (1500 cache read, 300 input, 1000 output)", () => {
    // per case: 1500*0.2/1e6 + 300*4/1e6 + 1000*20/1e6 = 0.0003 + 0.0012 + 0.02 = 0.0215
    expect(estimateCost(10)).toBeCloseTo(0.215, 6);
  });
});
