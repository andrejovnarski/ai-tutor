// Live eval for Nova's voice. Usage: npm run eval:tutor -- [--yes] [--limit N]
// Without --yes it only prints the case count and a cost estimate; it never calls the API.
// Run via `tsx --conditions=react-server` (see package.json): that condition makes `server-only`
// resolve to its empty module, so the real server modules load unchanged outside Next.
import { readFileSync, writeFileSync } from "node:fs";
import { buildReport, estimateCost, renderMarkdown, type EvalResult } from "../src/server/tutor/eval-report";
import type { TurnPlan } from "../src/server/tutor/types";

const args = process.argv.slice(2);
const yes = args.includes("--yes");
const li = args.indexOf("--limit");
const limit = li >= 0 ? Number(args[li + 1]) : Infinity;
if (li >= 0 && !(Number.isInteger(limit) && limit > 0)) {
  console.error("--limit needs a positive integer");
  process.exit(2);
}

const all = JSON.parse(readFileSync(new URL("../evals/tutor/cases.json", import.meta.url), "utf8")) as (TurnPlan & { id: string })[];
const cases = all.slice(0, limit);

console.log(`${cases.length} cases. Estimated cost: $${estimateCost(cases.length).toFixed(2)} ` +
  `(per case ~1,500 cached + 300 uncached input + 1,000 output tokens at $4/MTok input, $0.20/MTok cache read, $20/MTok output).`);
if (!yes) {
  console.log("Not calling the API. Re-run with --yes to spend that.");
  process.exit(0);
}

const { default: Anthropic } = await import("@anthropic-ai/sdk");
const { claudeVoice, speak } = await import("../src/server/tutor/voice");
const voice = claudeVoice(new Anthropic({ maxRetries: 0 })); // SDK default credential resolution; no key is read or printed here

const results: EvalResult[] = [];
for (const { id, ...plan } of cases) {
  let obs: { outcome: string; ms: number; cacheRead: number; guardReasons: string[] } | undefined;
  const { line } = await speak(plan, { voice, seed: 0, onResult: (r) => (obs = r) });
  const o = obs ?? { outcome: "unknown", ms: 0, cacheRead: 0, guardReasons: [] };
  results.push({ id, event: plan.event, ...o, say: line.say });
}

const rep = buildReport(results);
const date = new Date().toISOString().slice(0, 10);
const file = new URL(`../evals/tutor/report-${date}.md`, import.meta.url);
writeFileSync(file, renderMarkdown(date, results, rep));
console.log(`${rep.pass ? "PASS" : "FAIL"}: ${rep.cannedCount}/${rep.total} canned, p50 ${rep.p50} ms, p95 ${rep.p95} ms. Report: evals/tutor/report-${date}.md`);
process.exit(rep.pass ? 0 : 1);
