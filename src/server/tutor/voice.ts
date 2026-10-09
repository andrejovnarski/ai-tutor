import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { env } from "../env";
import { cannedLine } from "./canned";
import { checkLine } from "./guards";
import { SYSTEM_PROMPT, userMessage } from "./prompt";
import { TutorLineSchema, type TurnPlan, type TutorLine } from "./types";

export const MODEL = "claude-opus-5-5";
const BUDGET_MS = 2500;
const RETRY_MIN_MS = 800;

type FailReason = "refusal" | "parse" | "error" | "timeout" | "guard";

export class VoiceError extends Error {
  constructor(readonly reason: FailReason, message?: string) {
    super(message ?? reason);
    this.name = "VoiceError";
  }
}

export interface TutorVoice {
  /** Throws on API errors, a refusal or a parse failure. `timeoutMs` is the remaining budget. */
  line(plan: TurnPlan, signal: AbortSignal, timeoutMs?: number): Promise<TutorLine & { cacheRead: number }>;
}

const SYSTEM = [{ type: "text" as const, text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" as const } }];
const FORMAT = zodOutputFormat(TutorLineSchema);

export function claudeVoice(client: Anthropic): TutorVoice {
  return {
    async line(plan, signal, timeoutMs = BUDGET_MS) {
      let msg;
      try {
        msg = await client.beta.messages.parse(
          {
            model: MODEL,
            max_tokens: 2000,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            output_config: { effort: "low", format: FORMAT },
            system: SYSTEM,
            messages: [{ role: "user", content: userMessage(plan) }],
          },
          { signal, timeout: Math.max(1, Math.round(timeoutMs)), maxRetries: 0 },
        );
      } catch (e) {
        if (e instanceof Anthropic.APIUserAbortError || e instanceof Anthropic.APIConnectionTimeoutError)
          throw new VoiceError("timeout");
        if (e instanceof Anthropic.APIError) throw new VoiceError("error", `${e.status ?? "network"}`);
        // The SDK parses text blocks eagerly; anything else it throws is a structured-output parse failure.
        throw new VoiceError("parse");
      }
      if (msg.stop_reason === "refusal") throw new VoiceError("refusal");
      const parsed = TutorLineSchema.safeParse(msg.parsed_output);
      if (!parsed.success) throw new VoiceError("parse");
      return { ...parsed.data, cacheRead: msg.usage.cache_read_input_tokens ?? 0 };
    },
  };
}

export const cannedVoice: TutorVoice = {
  async line(plan) {
    return { ...cannedLine(plan, 0), cacheRead: 0 };
  },
};

/** Races one attempt against the remaining budget; aborts the request when time runs out. */
async function attempt(voice: TutorVoice, plan: TurnPlan, remainingMs: number) {
  const ac = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      ac.abort();
      reject(new VoiceError("timeout"));
    }, remainingMs);
  });
  try {
    const call = Promise.resolve().then(() => voice.line(plan, ac.signal, remainingMs));
    call.catch(() => {}); // the loser of the race must not surface as an unhandled rejection
    return await Promise.race([call, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

export async function speak(
  plan: TurnPlan,
  ctx: {
    voice: TutorVoice; seed: number; budgetMs?: number; now?: () => number;
    /** Optional observer (the eval script). Never affects the result or the monitoring log. */
    onResult?: (r: { outcome: string; ms: number; cacheRead: number; guardReasons: string[] }) => void;
  },
): Promise<{ line: TutorLine; outcome: string }> {
  const now = ctx.now ?? Date.now;
  const budget = ctx.budgetMs ?? BUDGET_MS;
  const start = now();
  let line: TutorLine | undefined;
  let outcome = "canned:config";
  let cacheRead = 0;
  const guardReasons: string[] = [];

  if (ctx.voice !== cannedVoice) {
    let reason: FailReason = "timeout";
    for (let i = 0; i < 2; i++) {
      const remaining = budget - (now() - start);
      if (remaining <= 0 || (i > 0 && remaining < RETRY_MIN_MS)) break;
      try {
        const { cacheRead: read, ...ai } = await attempt(ctx.voice, plan, remaining);
        cacheRead = read;
        const ok = checkLine(ai, plan);
        if (ok.ok) {
          line = ai;
          outcome = i === 0 ? "ai" : "ai-retry";
          break;
        }
        reason = "guard";
        if (!ok.ok) guardReasons.push(ok.reason);
      } catch (e) {
        reason = e instanceof VoiceError ? e.reason : "error";
      }
    }
    if (!line) outcome = `canned:${reason}`;
  }

  if (!line) line = cannedLine(plan, Number.isFinite(ctx.seed) ? ctx.seed : 0); // cannedLine fills {answer} for correct and explain
  try {
    console.log(JSON.stringify({ evt: "tutor", event: plan.event, outcome, ms: Math.round(now() - start), cacheRead }));
  } catch {
    // logging must never cost the child a line
  }
  try {
    ctx.onResult?.({ outcome, ms: Math.round(now() - start), cacheRead, guardReasons });
  } catch {
    // an observer must never cost the child a line
  }
  return { line, outcome };
}

let claude: TutorVoice | undefined;

export function getTutorVoice(): TutorVoice {
  if (env.tutorVoice() !== "claude") return cannedVoice;
  // SDK default credential resolution; retries are ours (one, within the budget).
  return (claude ??= claudeVoice(new Anthropic({ maxRetries: 0 })));
}
