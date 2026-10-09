// Pure report builder for the live tutor eval (scripts/eval-tutor.ts). No I/O, no SDK.

export type EvalResult = {
  id: string;
  event: string;
  outcome: string;
  ms: number;
  cacheRead: number;
  guardReasons: string[];
  say: string;
};

export const CANNED_GATE = 0.1;

export function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)]!;
}

export function buildReport(results: EvalResult[]) {
  const outcomes: Record<string, number> = {};
  const guardReasons: Record<string, number> = {};
  for (const r of results) {
    outcomes[r.outcome] = (outcomes[r.outcome] ?? 0) + 1;
    for (const g of r.guardReasons) guardReasons[g] = (guardReasons[g] ?? 0) + 1;
  }
  const total = results.length;
  const cannedCount = results.filter((r) => r.outcome.startsWith("canned")).length;
  const ms = results.map((r) => r.ms);
  return {
    total,
    outcomes,
    guardReasons,
    cannedCount,
    cannedRate: total === 0 ? 1 : cannedCount / total,
    p50: percentile(ms, 50),
    p95: percentile(ms, 95),
    meanCacheRead: total === 0 ? 0 : results.reduce((a, r) => a + r.cacheRead, 0) / total,
    pass: total > 0 && cannedCount / total <= CANNED_GATE,
  };
}

export type Report = ReturnType<typeof buildReport>;

/** Opus 5.5: $4/MTok input, $0.20/MTok cache read, $20/MTok output. Per case: ~1,500 cached + 300 uncached input + 1,000 output tokens. */
export function estimateCost(cases: number): number {
  return (cases * (1500 * 0.2 + 300 * 4 + 1000 * 20)) / 1e6;
}

export function renderMarkdown(date: string, results: EvalResult[], rep: Report): string {
  const lines = [
    `# Tutor eval ${date}`,
    "",
    `Result: **${rep.pass ? "PASS" : "FAIL"}** (${rep.cannedCount}/${rep.total} canned, gate 10%)`,
    "",
    "## Outcomes",
    ...Object.entries(rep.outcomes).sort().map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Guard reasons",
    ...(Object.keys(rep.guardReasons).length
      ? Object.entries(rep.guardReasons).sort().map(([k, v]) => `- ${k}: ${v}`)
      : ["- none"]),
    "",
    `Latency: p50 ${rep.p50} ms, p95 ${rep.p95} ms (goal 1500 ms, cap 2500 ms)`,
    `Mean cacheRead: ${rep.meanCacheRead.toFixed(0)} tokens`,
    "",
    "## Lines",
    ...results.map((r) => `- \`${r.id}\` [${r.event}] ${r.outcome}, ${r.ms} ms: ${r.say}`),
    "",
  ];
  return lines.join("\n");
}
