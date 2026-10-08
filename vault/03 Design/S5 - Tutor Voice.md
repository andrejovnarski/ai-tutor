---
tags: [design]
status: approved
date: 2026-10-08
---
# Section 5: Tutor voice (the AI part)

The only part that uses AI. It **never decides** anything — the engine decides, the AI says it nicely.

## In: a "turn plan" from the engine
```ts
type TurnPlan = {
  event: "present" | "correct" | "wrong" | "hint" | "explain" | "celebrate" | "kid-said";
  ageBand: "5-7" | "8-11";
  skill: string;              // "Make 10"
  problem: string;            // "8 + 5"
  answer: number;             // from code, always
  kidAnswer?: number;
  mistakeTag?: string;        // "off-by-one-counting"
  style?: Style;              // chosen by kid model
  kidSaid?: string;           // free speech from STT, if any
  recentLines: string[];      // to avoid repeating itself
};
```

## Out: structured JSON (`output_config.format`)
```ts
type TutorLine = {
  say: string;                // ≤ 25 words (5–7), ≤ 40 words (8–11)
  show?: VisualCue;           // from a fixed list, e.g. "highlight-ten-frame"
  tone: "cheer" | "calm" | "curious";
};
```

## Model and speed
- **Claude Opus 5.5**, effort `low` (default model; fast, short output). Sonnet 5.5 / Haiku 4.5 are options if latency or cost needs it — measure first, your call.
- **Streaming** → text goes to TTS as it arrives. Target: first sound in ~1.5 s.
- **Prompt caching:** fixed system prompt (persona, rules, how to explain each style, examples) cached; only the turn plan changes.
- **Refusal fallback** enabled (server-side `fallbacks: "default"`); any refusal → canned line.

## Guards (code checks every line before the kid hears it)
1. **Numbers check:** every number in `say` must be in the problem / answer / kid answer. Else reject.
2. **No early answer:** answer may not appear unless event is `explain` after 2 tries, or `correct`.
3. **Length and word list** by age band.
4. Fail → retry once → **canned line** for that event.
5. **Timeout 2.5 s** → canned line. Canned lines also cover API outages.

## Privacy
- Kid's name **never sent**. AI writes `{name}`; code fills it in.
- Only the turn plan is sent — no account data, no audio.

## Kid says off-topic things
- AI kindly steers back to the problem; no open chat.
- Words that may mean distress (hurt, scared, sad at home…) → fixed caring line + flag for parent. Exact rule set in [[S6 - Parent Side and Privacy]].

## Persona
One friendly guide character (name and look TBD). Same voice every session.

## Testing
An eval set of turn plans (all events × both ages × styles). Automated checks for the guards; spot-read for tone.

Related: [[S2 - System Parts]], [[S4 - Kid Model]], [[Decision - Stack]]
