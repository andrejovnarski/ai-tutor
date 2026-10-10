# Plan 5b — Speech Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kids answer Nova by speaking (tap the mic, it stops by itself), and Nova's lines are read aloud with Azure's Ava voice. The kid's name never goes to Azure, and text stays on screen at all times.

**Architecture:**
- **Server, `src/server/speech/`:** a config switch (`SPEECH=azure|fake|off`), Azure REST clients for STT and TTS (each with a fake), a pure `speakable()` that strips `{name}`, and an HMAC token so `/speak` only voices text the server issued.
- **Domain:** a pure `routeHeard()` decides answer / confirm / say from the STT result.
- **Two new routes:** `/listen` and `/speak`. Every Nova line in a play response gains a `speech` field, pointing at a pre-made clip when one exists.
- **Tablet:** the browser records PCM, encodes a 16 kHz WAV, and stops on silence. Pure reducers drive the mic and the audio player.

**Tech Stack:** Next.js 16 route handlers, Web Audio (`AudioContext` + `ScriptProcessorNode` for Safari reach), Azure AI Speech REST (short-audio STT, TTS), Node `crypto` HMAC, Vitest, Playwright (Chromium fake media devices).

**Spec:** `docs/superpowers/specs/2026-10-10-speech-design.md` (extends `docs/superpowers/specs/2026-10-08-adaptive-tutor-design.md` §5, §7–§9). Read both.

## Global Constraints

- **The name never reaches Azure.** Only `speakable(line.say)` (no `{name}`, no nickname) is synthesised. The nickname is filled into the screen text only, by `forKid`, as today.
- **Audio is never stored or logged.** Not on disk, not in the DB, not in `console.*`. Never set `storeAudio=true`. The recognised text is never logged. `/say` keeps its existing rule: only distress lines are kept.
- `SPEECH` takes `azure`, `fake` or `off`. Unset or a bad value means `off`, warned once, the same pattern as `env.tutorVoice`. `azure` without `AZURE_SPEECH_KEY`/`AZURE_SPEECH_REGION` means `off`. With `off`, the play screen behaves exactly as Plan 5a: no mic, no audio, no `speech` field.
- **Azure details:**
  - Voice is `en-US-AvaNeural` at prosody rate `-5%`, in one exported constant `NOVA_VOICE`.
  - Language is `en-US`.
  - STT is the short-audio REST API with `format=detailed&profanity=raw`, body `audio/wav; codecs=audio/pcm; samplerate=16000`.
  - TTS output is `audio-24khz-48kbitrate-mono-mp3`.
  - Server-side timeout is 4 s for each call.
- **Recording:**
  - Mono, 16 kHz, 16-bit PCM WAV.
  - Speech starts when RMS ≥ 0.02 for 100 ms or more. It stops after 1000 ms below that once started. Hard stop at 6000 ms.
  - Nothing is sent if speech never started.
  - Body cap on `/listen` is 256 KB.
- **Thresholds:** answer when confidence ≥ 0.6 and every alternative that parses to a number agrees. A lower-confidence number gets confirm. No number goes to say.
- **`/speak`:** text of 300 characters or fewer, plus a valid token for this kid. `Cache-Control: private, max-age=86400`.
- **Copy (exact):**
  - "Did you say {n}?"
  - "Let's try again."
  - "I didn't catch that. Try again or tap your answer."
  - "I couldn't hear. Tap your answer."
  - "I heard: {text}"
- **Touch targets:** mic, ✓ and ✗ are 88 px or larger. Focus rings follow Plan 5a (ink on tray/bubble, chalk on felt).
- **Unchanged:** the domain/session engine and the API shapes of `turn` and `answer`, except the added optional `speech` on lines.
- **Commits:** end each with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never stage `vault/.obsidian/**` or `vault/05 Roadmap/Roadmap.canvas` (the owner's uncommitted changes).
- **Docker:** run Docker-touching commands as `echo '<cmd>' | newgrp docker`.

## Review Focus

1. **A recording or STT result for a problem that has since changed** (the kid tapped a tile mid-listen, or a retry adopted a 409). The result must be dropped, not answered against the new problem. Owner: Task 6 (`micReducer` keyed by version) and Task 7.
2. **A tile tap or pad OK while `/listen` is in flight, or a ✓ double-tap.** Exactly one attempt must be saved. Owner: Task 7 (reuse `usePlay.answer`'s busy guard; e2e double ✓).
3. **Nova talking while the mic listens.** The mic must not record Nova. Starting the mic stops playback, and no line auto-plays while listening; a line that arrives then plays after. Owner: Task 6 (`audioReducer`).
4. **iPad Safari.**
   - `AudioContext` is created or resumed inside the tap handler.
   - The capture rate is 44.1 or 48 kHz and must be downsampled to 16 kHz.
   - Mic tracks are stopped after every recording, so the red recording indicator goes off.
   - Owner: Task 5 (`downsample` tests at 44100 and 48000) and Task 7 (track stop on every exit path).
5. **The kid leaves mid-recording or mid-`/listen`.** Nothing is sent after unmount, and the mic stream is released. Owner: Task 7 (abort on unmount; component test).

---

### Task 1: Speakable text, speech token, heard router (pure)

**Files:**
- Create: `src/server/speech/speakable.ts`, `src/server/speech/speakable.test.ts`
- Create: `src/server/speech/token.ts`, `src/server/speech/token.test.ts`
- Create: `src/domain/checker/heard.ts`, `src/domain/checker/heard.test.ts`
- Modify: `src/server/tutor/canned.ts` (export `allCannedSays(): string[]`, every `say` template in `TABLE` and `EXPLAIN_HIDDEN`, unfilled)

**Interfaces:**
- Produces:
  - `speakable(say: string): string`: removes `{name}` with its neighbouring comma and space, then tidies the punctuation. Input is a line whose `{answer}` is already filled (canned and Claude lines reach `forKid` like that).
  - `speechToken(secret: string, kidId: string, text: string): string`: HMAC-SHA256 over `kidId + "\n" + text`, base64url.
  - `checkSpeechToken(secret, kidId, text, token): boolean`: constant-time compare.
  - `type Heard = { text: string; confidence: number; alternatives: string[] }`.
  - `type HeardRoute = { kind: "answer"; n: number } | { kind: "confirm"; n: number } | { kind: "say"; text: string } | { kind: "nothing" }`.
  - `routeHeard(h: Heard): HeardRoute`: uses `parseSpokenNumber`. Empty or whitespace text gives `nothing`.

- [ ] **Step 1: Write the failing tests**

```ts
// speakable.test.ts
it.each([
  ["Great thinking, {name}!", "Great thinking!"],
  ["Here we go, {name}! Take your time.", "Here we go! Take your time."],
  ["{name}, look at this!", "Look at this!"],
  ["Not quite, {name}, but that's okay.", "Not quite, but that's okay."],
  ["Here's how it works, {name}: the answer is 7.", "Here's how it works: the answer is 7."],
  ["Hmm, a puzzle for us! Ready, {name}?", "Hmm, a puzzle for us! Ready?"],
])("%s → %s", (a, b) => expect(speakable(a)).toBe(b));
it("every canned template speaks cleanly", () => {
  for (const t of allCannedSays()) {
    const s = speakable(t.replaceAll("{answer}", "12"));
    expect(s).not.toMatch(/[{}]|\s{2}|\s[,.!?:]|,[.!?]|^[,\s]|^[a-z]/);
  }
});
// token.test.ts — round trip true; changed text false; changed kidId false; wrong secret false; garbage token false (no throw)
// heard.test.ts
const h = (text: string, confidence = 0.9, alternatives: string[] = []) => ({ text, confidence, alternatives });
it("confident single number answers", () => expect(routeHeard(h("twelve"))).toEqual({ kind: "answer", n: 12 }));
it("low confidence confirms", () => expect(routeHeard(h("twelve", 0.59))).toEqual({ kind: "confirm", n: 12 }));
it("0.6 exactly answers", () => expect(routeHeard(h("12.", 0.6))).toEqual({ kind: "answer", n: 12 }));
it("alternative that disagrees confirms", () => expect(routeHeard(h("twelve", 0.95, ["twenty"]))).toEqual({ kind: "confirm", n: 12 }));
it("non-number alternatives don't block", () => expect(routeHeard(h("eight", 0.9, ["ate", "hey"]))).toEqual({ kind: "answer", n: 8 }));
it("no number is say", () => expect(routeHeard(h("I like cats"))).toEqual({ kind: "say", text: "I like cats" }));
it("empty is nothing", () => expect(routeHeard(h("  "))).toEqual({ kind: "nothing" }));
it("two different numbers are ambiguous → say", () => expect(routeHeard(h("five six")).kind).toBe("say"));
```

Note on the last case: `parseSpokenNumber` returns null for ambiguous input, so it goes to say. `/say` steers back to the problem, which is the right reply to "five six".

Note on "ate" in the alternatives: `parseSpokenNumber("ate")` is 8, so it agrees. "hey" is null and is ignored.

- [ ] **Step 2: Run** `npx vitest run src/server/speech src/domain/checker/heard.test.ts`. Expect FAIL (modules missing).
- [ ] **Step 3: Implement** the three modules and `allCannedSays`. `speakable` capitalises the first letter if removing the name exposed a lowercase start.
- [ ] **Step 4: Run** the same command. Expect PASS. Then run `npm test && npm run typecheck`. Expect PASS.
- [ ] **Step 5: Commit** `feat: speakable lines, speech tokens and the heard router`

---

### Task 2: Speech config and Azure clients (with fakes)

**Files:**
- Modify: `src/server/env.ts` (add `speech()`, `azureSpeechKey()`, `azureSpeechRegion()`, `speechTokenSecret()`), `.env.example` (`SPEECH=off`, `AZURE_SPEECH_KEY=`, `AZURE_SPEECH_REGION=`, `SPEECH_TOKEN_SECRET=`)
- Create: `src/server/speech/config.ts`, `src/server/speech/stt.ts`, `src/server/speech/tts.ts`, `src/server/speech/clients.test.ts`
- Create: `scripts/speech-smoke.ts`, `tests/fixtures/twelve.wav` (see Step 5), `package.json` script `"speech:smoke": "tsx scripts/speech-smoke.ts"`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  - `NOVA_VOICE = { name: "en-US-AvaNeural", rate: "-5%" } as const`.
  - `speechMode(): "azure" | "fake" | "off"` (in `config.ts`; `azure` without a key or region gives `off`, warned once).
  - `interface Stt { recognize(wav: Uint8Array, signal: AbortSignal): Promise<Heard | null> }`. `null` means Azure heard no speech (`NoMatch`, `InitialSilenceTimeout`). It throws `SpeechError` on HTTP or network failure, or on timeout.
  - `interface Tts { synthesize(text: string, signal: AbortSignal): Promise<Uint8Array> }`. MP3 bytes. Throws `SpeechError`.
  - `class SpeechError extends Error { reason: "timeout" | "error" }`.
  - `azureStt(key, region, fetchFn = fetch): Stt`, `azureTts(key, region, fetchFn = fetch): Tts`.
  - `fakeStt(): Stt`: always `{ text: "twelve", confidence: 0.95, alternatives: [] }`.
  - `fakeTts(): Tts`: a constant valid tiny silent MP3 (a short hard-coded byte array, about 1 frame).
  - `getStt(): Stt | null` and `getTts(): Tts | null` (null when mode is `off`).
  - `SPEECH_TIMEOUT_MS = 4000`.

- [ ] **Step 1: Write the failing tests** (`clients.test.ts`, with an injected `fetchFn` spy)
  - **STT request:** URL `https://westus.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed&profanity=raw`. It must not include `storeAudio`. Headers include `Ocp-Apim-Subscription-Key`, `Content-Type: audio/wav; codecs=audio/pcm; samplerate=16000`, `Accept: application/json`. The body is the WAV bytes.
  - **STT response mapping:**
    - `{RecognitionStatus:"Success", NBest:[{Confidence:0.82, Lexical:"twelve", Display:"12."},{Confidence:0.4, Lexical:"twenty", Display:"20."}]}` maps to `{ text: "12.", confidence: 0.82, alternatives: ["twenty"] }`. That is `text` = top Display, `alternatives` = Lexical of NBest[1..].
    - `NoMatch` maps to `null`.
    - A 500 rejects with `SpeechError("error")`. An abort or timeout rejects with `SpeechError("timeout")`.
  - **TTS request:** URL `https://westus.tts.speech.microsoft.com/cognitiveservices/v1`. Headers include `Content-Type: application/ssml+xml`, `X-Microsoft-OutputFormat: audio-24khz-48kbitrate-mono-mp3`, and `User-Agent`. The SSML contains `<voice name="en-US-AvaNeural"><prosody rate="-5%">` and the text XML-escaped (`Tom & "Jo" <3` gives `Tom &amp; &quot;Jo&quot; &lt;3`).
  - **`speechMode`:** unset gives `off`; `"azure"` without a key gives `off`; `"bogus"` gives `off`; `"fake"` gives `fake`.
- [ ] **Step 2: Run** `npx vitest run src/server/speech/clients.test.ts`. Expect FAIL.
- [ ] **Step 3: Implement.**
  - Each call gets `AbortSignal.any([signal, AbortSignal.timeout(SPEECH_TIMEOUT_MS)])`.
  - Never log bodies or text; log only the status code.
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expect PASS.
- [ ] **Step 5: Smoke script and fixture.**
  - `tests/fixtures/twelve.wav`: 16 kHz mono PCM of a voice saying "twelve". If no TTS or recorder is available offline, the script generates the fixture on first run with `azureTts` and the `riff-16khz-16bit-mono-pcm` output format, writes it, then recognises it.
  - `npm run speech:smoke` loads `.env.local` and refuses to run unless `SPEECH=azure` and a key are set. It prints the recognised text and confidence, then synthesises "Hello from Nova!" to `scripts/.out/smoke.mp3` (gitignored).
  - Expected with a key: it prints `twelve`/`12` with confidence > 0.6. Without a key it exits 1 with a clear message, and that is what CI and the tests see.
- [ ] **Step 6: Commit** `feat: speech config and Azure STT/TTS clients with fakes`

---

### Task 3: Line speech payloads and the listen and speak routes

**Files:**
- Modify: `src/server/playApi.ts`
  - `forKid(line, nickname, kidId)` adds `speech` when the mode isn't `off`.
  - New helper `speechFor(kidId, say): LineSpeech | undefined`.
- Modify: the `turn`, `answer` and `say` routes, to pass `kidId`. `/say` also returns `replySpeech`, including for `DISTRESS_REPLY`.
- Create: `src/app/api/kids/[kidId]/listen/route.ts`, `src/app/api/kids/[kidId]/speak/route.ts`
- Create: `src/server/speech/clips.ts` (reads `public/audio/nova/manifest.json` if present; empty map otherwise)
- Create: `tests/db/speech.db.test.ts`
- Modify: `src/app/play/playMachine.ts`, adding the client type `TutorLine.speech?: LineSpeech` (type only)

**Interfaces:**
- Consumes: Task 1 `speakable`, `speechToken`, `checkSpeechToken`, `routeHeard`. Task 2 `getStt`, `getTts`, `speechMode`, `NOVA_VOICE`, `SpeechError`.
- Produces:
  - `type LineSpeech = { text: string; token: string; clip?: string }`. `clip` is `/audio/nova/<sha256hex>.mp3` when the manifest has `clipKey(text)`.
  - `clipKey(text: string): string` = sha256 hex of `NOVA_VOICE.name + "|" + NOVA_VOICE.rate + "|" + text`.
  - `POST /api/kids/[kidId]/listen`:
    - Body: raw WAV, `content-type: audio/wav`.
    - 200 `{ heard: string, route: HeardRoute, speech?: LineSpeech }`. `heard` is the STT text, or "" for nothing. `speech` is present only for a confirm route, and voices "Did you say {n}?".
    - 413 over 256 KB. 400 on an empty body or a non-RIFF body.
    - 404 for a signed-out caller or another family's kid.
    - 503 `{ error: "stt" }` on `SpeechError`.
    - 404 when the mode is `off`.
  - `POST /api/kids/[kidId]/speak`:
    - Body: JSON `{ text, token }`.
    - 200 `audio/mpeg`.
    - 400 when the text is over 300 characters or the token is bad.
    - 404 for auth or kid failures, and when the mode is `off`.
    - 503 on `SpeechError`.
  - `/say` 200 body is now `{ reply, replySpeech? }`.
  - `speechCues(kidId): Record<"tryAgain" | "notCaught" | "cantHear", LineSpeech> | undefined` returns the three fixed notices ("Let's try again.", "I didn't catch that. Try again or tap your answer.", "I couldn't hear. Tap your answer."), so the tablet can speak them.

- [ ] **Step 1: Write the failing DB tests** (`tests/db/speech.db.test.ts`, same harness as `api.db.test.ts`, with `vi.stubEnv("SPEECH","fake")` and `SPEECH_TOKEN_SECRET`)
  - `turn` returns `line.speech.text` with no nickname: the kid is "Ann", and `line.speech.text` must not contain "Ann" while `line.say` may. `line.speech.token` verifies.
  - **Listen:**
    - Fake STT on a minimal valid 16 kHz WAV gives 200 `{ heard: "twelve", route: { kind: "answer", n: 12 } }`. The attempts count is unchanged, because listening never answers.
    - With fake STT stubbed to confidence 0.3, the body has `speech.text === "Did you say 12?"` and a valid token.
    - Listen with 300 KB gives 413. A non-RIFF body gives 400. Another family's kid gives 404.
  - **Speak:**
    - The token from `turn` gives 200 `audio/mpeg`, with `cache-control` containing `private`.
    - Tampered text gives 400. A token minted for kid A, used on kid B (same parent), gives 400.
    - Text over 300 characters gives 400.
  - `SPEECH=off`: `turn` has no `speech`, and both new routes give 404.
  - `/say` with a distress phrase returns `replySpeech.text === DISTRESS_REPLY`.
  - **Privacy:** spy on `console.log/info/warn/error` during listen and speak, and assert no call contains "twelve" or the WAV bytes.
- [ ] **Step 2: Run** `npm run test:db -- speech`. Expect FAIL.
- [ ] **Step 3: Implement.**
  - Read the body with `req.arrayBuffer()` after checking `content-length` (when present) against 256 KB, and check the length again after reading.
  - The route hands the bytes to `recognize` and lets them go out of scope: no buffering anywhere else.
- [ ] **Step 4: Run** `npm test && npm run test:db && npm run typecheck`. Expect PASS. The existing `api.db.test.ts` stays green because `speech` is optional.
- [ ] **Step 5: Commit** `feat: line speech payloads, listen and speak routes`

---

### Task 4: Pre-made audio for canned lines

**Files:**
- Create: `scripts/premake-audio.ts`, plus `package.json` script `"speech:premake": "tsx --conditions=react-server scripts/premake-audio.ts"`
- Create: `public/audio/nova/manifest.json` (committed, `{ "voice": "...", "rate": "...", "clips": {} }` until the owner runs the script)
- Create: `scripts/premake-audio.test.ts` (or a `src/server/speech/premake.test.ts` that tests an exported pure `premakeList()`)

**Interfaces:**
- Consumes: `allCannedSays()` (Task 1), `speakable` (Task 1), `clipKey` (Task 3), `azureTts` and `NOVA_VOICE` (Task 2).
- Produces: `premakeList(): string[]`. These are the unique speakable texts of every canned template without `{answer}`, plus `DISTRESS_REPLY` and the fixed tablet copy that Nova speaks: "Did you say {n}?" is excluded because it has a number; "Let's try again.", "I didn't catch that. Try again or tap your answer." and "I couldn't hear. Tap your answer." are included.
  - The script writes `public/audio/nova/<clipKey>.mp3` for each text and rewrites `manifest.json` (`clips: { [clipKey]: true }`).
  - It skips files that already exist and deletes clips no longer in the list.

- [ ] **Step 1: Write the failing tests**
  - `premakeList()` contains no `{`, no digits, and no duplicates. It includes `DISTRESS_REPLY`.
  - Its length equals the number of unique speakable templates without `{answer}`, plus 4.
  - `clipKey` is stable: hard-code one expected hex for "Let's try again." computed in the test from `node:crypto`.
- [ ] **Step 2: Run** the test. Expect FAIL.
- [ ] **Step 3: Implement** the script.
  - It refuses unless `SPEECH=azure` and a key are set.
  - It runs 4 TTS calls at a time and prints the count made and skipped.
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expect PASS. Do not run the script: it needs the owner's key.
- [ ] **Step 5: Commit** `feat: pre-made Nova audio script and manifest`

---

### Task 5: Tablet recording, WAV encoding and the silence gate (pure plus a thin hook)

**Files:**
- Create: `src/app/play/speech/wav.ts`, `src/app/play/speech/wav.test.ts`
- Create: `src/app/play/speech/silence.ts`, `src/app/play/speech/silence.test.ts`
- Create: `src/app/play/speech/recorder.ts` (browser-only; not unit-tested beyond the pure parts)

**Interfaces:**
- Produces:
  - `downsample(input: Float32Array, fromRate: number, toRate = 16000): Float32Array`. Averages over each output step, with no aliasing tricks needed for speech.
  - `encodeWav(samples: Float32Array, rate = 16000): Uint8Array`. RIFF/WAVE, PCM 16-bit mono, clamps to [-1, 1].
  - `rms(frame: Float32Array): number`.
  - `type GateState = { ms: number; speechMs: number; quietMs: number; started: boolean }`.
  - `gateStep(s: GateState, frameRms: number, frameMs: number): { s: GateState; verdict: "go" | "stop" | "nothing" }`. The constants are as in Global Constraints. `"nothing"` comes at 6000 ms if speech never started. `"stop"` comes after 1000 ms quiet once started, or at 6000 ms.
  - `startRecording(opts: { signal: AbortSignal; onLevel?: (rms: number) => void }): Promise<Uint8Array | null>`. Resolves the WAV, or `null` for nothing. Rejects `DOMException` `NotAllowedError` / `NotFoundError` on permission or device failure.
    - It must be called synchronously from the tap handler (Safari): it creates or resumes the `AudioContext` before its first `await`.
    - It always stops every `MediaStreamTrack` and closes the context, whether it resolves, rejects or is aborted.

- [ ] **Step 1: Write the failing tests**
  - **`encodeWav`:** 1600 samples give byte length 44 + 3200. The header reads `RIFF`, `WAVE`, `fmt `, PCM 1, channels 1, rate 16000, bits 16, `data` size 3200. A sample of 1.5 is clamped to 32767.
  - **`downsample`:** 48000→16000 of 4800 samples gives 1600. 44100→16000 of 4410 gives 1600 (±1). A constant 0.5 signal stays 0.5.
  - **`gateStep`** (frames of 50 ms):
    - Quiet for 6000 ms gives `nothing`.
    - Loud for 100 ms then quiet for 1000 ms gives `stop` at 1100 ms.
    - Loud for 50 ms only (under 100) then quiet for 6000 ms gives `nothing`.
    - Loud the whole time gives `stop` at 6000 ms.
- [ ] **Step 2: Run** `npx vitest run src/app/play/speech`. Expect FAIL.
- [ ] **Step 3: Implement.**
  - `recorder.ts` uses `getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })`, a `ScriptProcessorNode(2048, 1, 1)` and the gate.
  - `ScriptProcessorNode` is chosen over an AudioWorklet so there is no extra module file to serve and older iPads work. Comment this choice in one line.
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expect PASS.
- [ ] **Step 5: Commit** `feat: tablet recording, 16 kHz WAV encoding and silence gate`

---

### Task 6: Mic and Nova-audio state machines (pure)

**Files:**
- Create: `src/app/play/speech/micMachine.ts`, `src/app/play/speech/micMachine.test.ts`
- Create: `src/app/play/speech/audioMachine.ts`, `src/app/play/speech/audioMachine.test.ts`

**Interfaces:**
- Consumes: `HeardRoute` (Task 1, imported as a type from `src/domain/checker/heard.ts`).
- Produces:
  - `type MicState = { phase: "idle" | "listening" | "thinking" | "confirm"; version?: number; heard?: string; n?: number; notice?: string; failures: number; hidden: boolean }`.
  - `type MicEvent`:
    - `{ type: "start"; version }`, `{ type: "sent" }`.
    - `{ type: "result"; version; heard; route }`, `{ type: "nothing" }`, `{ type: "failed" }`, `{ type: "denied" }`.
    - `{ type: "yes" }`, `{ type: "no" }`, `{ type: "problem"; version }` (a new problem was shown), `{ type: "cancel" }`.
  - `micReducer(s, ev): MicState` and `micEffect(prev, next): { answer?: number; say?: string } | null` (what the screen must do after a transition).
  - `type AudioState = { playing?: LineKey; queue: LineSpeech[]; listening: boolean }`. Here `LineKey = string`, the `token` of the line.
  - `audioReducer(s, ev): AudioState`, with events `{ type: "lines"; lines: LineSpeech[] }` (replaces the queue, stops the current one), `{ type: "ended" }`, `{ type: "replay"; line }`, `{ type: "mic"; on: boolean }`, `{ type: "failed" }`.
  - `nowPlaying(s): LineSpeech | undefined`.

- [ ] **Step 1: Write the failing tests**
  - **Mic:**
    - `start` from idle gives listening (version kept). `start` when `hidden` stays idle.
    - A `result` with route answer for the same version gives idle and effect `{ answer: n }`. The same result with a **different version** gives idle with **no effect** (Review Focus 1).
    - `confirm` route gives phase confirm, `n`, heard. `yes` gives idle plus effect `{ answer: n }`. `no` gives idle, notice "Let's try again.".
    - `say` route gives idle plus effect `{ say: text }`, heard kept for "I heard:".
    - `nothing` gives idle, notice "I didn't catch that. Try again or tap your answer.".
    - `failed` once gives notice "I couldn't hear. Tap your answer." with failures 1. Failed twice in a row gives hidden true. A success in between resets failures.
    - `denied` gives hidden true.
    - `problem` with a new version gives idle and clears heard, n and notice (failures kept).
    - `yes` twice gives only one answer effect (Review Focus 2).
  - **Audio:**
    - `lines [a,b]` plays a, then `ended` plays b, then `ended` gives nothing playing.
    - `mic on` stops playback and holds new `lines` until `mic off`, then plays them (Review Focus 3).
    - `replay` puts that line in front.
    - `failed` skips to the next line.
- [ ] **Step 2: Run** `npx vitest run src/app/play/speech/*Machine.test.ts`. Expect FAIL.
- [ ] **Step 3: Implement** both reducers. No timers, React or fetch.
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expect PASS.
- [ ] **Step 5: Commit** `feat: mic and Nova audio state machines`

---

### Task 7: Play screen speech: mic button, "Did you say", Nova speaking, e2e

**Files:**
- Modify: `src/app/play/[kidId]/page.tsx` (pass `speech={speechMode() !== "off"}` and `cues={speechCues(kidId)}`)
- Modify: `src/app/play/PlayScreen.tsx`, `src/app/play/usePlay.ts` (add `say(text)` and a `"said"` event), `src/app/play/playMachine.ts`
- Modify: `src/app/play/bubble.ts` and `bubble.test.ts`, `src/app/play/play.module.css`
- Create: `src/app/play/speech/useMic.ts`, `src/app/play/speech/useNovaAudio.ts`, `src/app/play/speech/MicButton.tsx`, `src/app/play/speech/ConfirmHeard.tsx`, `src/app/play/speech/speech.test.tsx`
- Modify: `playwright.config.ts`
  - Chromium `launchOptions.args`: `--use-fake-ui-for-media-stream`, `--use-fake-device-for-media-stream`, `--autoplay-policy=no-user-gesture-required`.
  - `webServer.env`: `{ SPEECH: "fake", SPEECH_TOKEN_SECRET: "e2e-secret" }`.
- Create: `tests/e2e/speech.spec.ts`
- Modify: `vault/05 Roadmap/Roadmap.md` (mark "5b speech" done), `vault/02 Decisions/Decision - Stack.md` (voice row: "Azure AI Speech, Ava (en-US), name never sent").

**Interfaces:**
- Consumes:
  - `startRecording` (Task 5) and `micReducer`, `micEffect`, `audioReducer`, `nowPlaying` (Task 6).
  - `/listen`, `/speak`, `LineSpeech`, `replySpeech` (Task 3).
  - `usePlay().answer` (5a).
- Produces:
  - `PlayEvent` gains `{ type: "said"; line: TutorLine }`. The reply shows as `message` (lead) above the current line, `correct: false`, problem unchanged, phase unchanged.
  - `usePlay` returns `{ state, answer, retry, say }`. `say(text)` POSTs `/say` with the same abort signal and no retries (one try; a failure is silent because the problem is still there).
  - `PlayScreen` props gain `speech: boolean` and `cues?: Record<"tryAgain" | "notCaught" | "cantHear", LineSpeech>`.

- [ ] **Step 1: Write the failing component tests** (`speech.test.tsx`, static markup plus reducer-driven props, the 5a pattern)
  - `speech=false` renders no mic.
  - `speech=true` renders a `button` named "Talk to Nova", 88 px or larger by class token.
  - The confirm state renders "Did you say 12?" with buttons named "Yes" and "No".
  - The heard text renders "I heard: twelve".
  - The `said` event: `bubbleView` returns `lead` = the reply and `say` = the problem line.
- [ ] **Step 2: Write the failing e2e** (`tests/e2e/speech.spec.ts`, reusing `setUpMia` / helpers from `play.spec.ts`; move them to `tests/e2e/helpers.ts` if needed)
  1. **Real path, fake STT:** tap "Talk to Nova". The fake mic beeps, so the gate stops at 6 s at most. `/listen` returns twelve as an answer, and the attempts count goes up by 1 with `given = 12`.
  2. **Confirm ✓:** stub `/listen` with `page.route` to `{heard:"twelve", route:{kind:"confirm",n:12}}`. "Did you say 12?" shows. Tap Yes **twice quickly**, and the attempts count goes up by exactly 1.
  3. **Confirm ✗:** stub confirm, then tap No. "Let's try again." shows, the attempts count is unchanged, and the mic is enabled.
  4. **Say:** stub `{heard:"I like cats", route:{kind:"say",text:"I like cats"}}`. A request to `/say` is made, Nova's reply shows above the problem line, and the attempts count is unchanged.
  5. **Mic denied:** in a context without the fake-UI flag, override `navigator.mediaDevices.getUserMedia` via `addInitScript` to reject `NotAllowedError`. Tap the mic and it disappears; the tiles still answer.
  6. **Nova speaks:**
     - On load, a request to `/speak` (no manifest clips in test) or `/audio/nova/` is made for the first line.
     - The `/speak` body text does not contain "Mia".
     - Tapping Nova makes a second request for the same text.
  7. **Leaving mid-listen:** stub `/listen` to hang, tap the mic, wait for `thinking`, click "I'm done for now". No `/answer` request is made afterwards (Review Focus 5).
  8. **Problem changed mid-listen:** stub `/listen` to resolve after 1.5 s with answer 12. Tap the mic, then tap a tile at once. Exactly one attempt is saved, the answer from the tile (Review Focus 1).
- [ ] **Step 3: Run** `npx vitest run src/app/play && npm run test:e2e -- speech`. Expect FAIL.
- [ ] **Step 4: Implement.**
  - **Layout:** the mic sits at the tray's leading edge on every problem when `speech` is true and the mic isn't hidden. The tray keeps 5a's no-scroll fit at 1024×768 and 768×1024; the screen.spec fit tests must still pass with the mic present.
  - **While listening:**
    - The mic pulses; under reduced motion it shows a static ring instead.
    - The tiles and pad stay enabled. A tap sends `cancel` to the mic and aborts the recording or `/listen`.
  - **Confirm card:** `ConfirmHeard` replaces the "I heard" line inside the tray area above the tiles.
  - **Nova's audio:**
    - `useNovaAudio` feeds `audioReducer` with `[messageSpeech?, lineSpeech]` whenever `state.version` changes, and with the reply's speech on `said`.
    - It plays via one reused `HTMLAudioElement`: the `clip` URL when present, else a blob URL from `POST /speak` (revoked on end).
    - On error it tries `/speak` once if it was a clip, otherwise it skips.
    - Tapping Nova (the SVG is wrapped in a `button` named "Hear Nova again") sends `replay`.
    - Mic notices play their cue (`cues`). A confirm plays the `speech` returned by `/listen`, so a kid who can't read still hears "Did you say 12?".
  - **Message speech:** to carry it, `PlayState` gains `messageSpeech?: LineSpeech`, set wherever `message` is set.
  - **Cleanup:** on unmount, abort `/listen`, stop the recorder and pause the audio.
- [ ] **Step 5: Run** `npm test && npm run test:db && npm run test:e2e && npm run typecheck`. Expect all PASS. Run e2e twice in a row; the second run must also be green.
- [ ] **Step 6: Update the vault** (only the two files listed) and **commit** `feat: kids talk to Nova and hear Nova — mic, did-you-say, spoken lines`

---

## Owner steps after merge (not tasks)

1. Create an Azure Speech resource. Set `SPEECH=azure`, `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` and `SPEECH_TOKEN_SECRET` in `.env.local` (and on Vercel later).
2. Run `npm run speech:smoke` (about $0.01), then `npm run speech:premake`. Commit `public/audio/nova/`.
3. Sign Azure's data processing agreement. Add "speech service (Microsoft Azure)" to the privacy notice, with lawyer review.
