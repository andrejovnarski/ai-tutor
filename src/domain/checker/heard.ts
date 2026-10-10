import { parseSpokenNumber } from "./parseSpoken";

export type Heard = { text: string; confidence: number; alternatives: string[] };
export type HeardRoute =
  | { kind: "answer"; n: number }
  | { kind: "confirm"; n: number }
  | { kind: "say"; text: string }
  | { kind: "nothing" };

const CONFIDENT = 0.6;

export function routeHeard(h: Heard): HeardRoute {
  const text = h.text.trim();
  if (!text) return { kind: "nothing" };
  const n = parseSpokenNumber(text);
  if (n === null) return { kind: "say", text };
  const agree = h.alternatives.every((a) => {
    const m = parseSpokenNumber(a);
    return m === null || m === n;
  });
  return h.confidence >= CONFIDENT && agree ? { kind: "answer", n } : { kind: "confirm", n };
}
