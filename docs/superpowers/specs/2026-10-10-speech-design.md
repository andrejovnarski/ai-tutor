# Speech (Plan 5b) — design

Date: 2026-10-10. Extends the main spec (`2026-10-08-adaptive-tutor-design.md`, §5, §7, §8, §9). Builds on Plan 5a's play screen.

## Goal

Kids can answer Nova by speaking, and hear Nova's lines read aloud. Text stays on screen at all times, and tapping still works whenever speech is unavailable.

## Owner decisions (2026-10-10)

| Question | Decision |
|---|---|
| Vendor | Azure AI Speech, for both speech-to-text (STT) and text-to-speech (TTS) |
| Nova's voice | Warm adult US voice: `en-US-AvaNeural`, set in one config constant |
| Kid's name in audio | Left out. The text on screen keeps the name; the spoken copy drops it. The name never goes to Azure. |
| Mic style | Tap to talk, stops by itself (about 1 s of silence, 6 s maximum) |
| Who gets the mic | Every age, every problem, next to the tiles and the number pad |

## Architecture

```
tablet mic ─16 kHz WAV─▶ POST /api/kids/[kidId]/listen ─▶ Azure STT (short-audio REST, format=detailed)
                                   │ text + confidence (audio held in memory only)
                                   ▼
                     route: number? confident? → answer | confirm | say

Nova line ─▶ server adds `speech` {text without name, token} ─▶ tablet
tablet: pre-made clip for this text? play it : POST /api/kids/[kidId]/speak {text, token} ─▶ Azure TTS (mp3)
```

- **Record, then send.** Live streaming is not used: Vercel functions don't hold WebSockets well, and a direct tablet-to-Azure connection would break "speech called server-side". A clip of 6 s or less costs about 1 s round trip.
- **The tablet encodes WAV itself** (mono PCM 16 kHz, via Web Audio). MediaRecorder on iPad Safari makes AAC/MP4, which Azure's short-audio API rejects.
- **Silence detection** on the tablet: stop after about 1 s below an RMS threshold, once speech has started. Hard stop at 6 s. Nothing is sent if no speech was detected.

## Units

| Unit | Where | Does |
|---|---|---|
| Speech config | `src/server/speech/config.ts` | Reads `SPEECH=azure\|off` (default `off`), `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, `SPEECH_TOKEN_SECRET`, and the voice name. `azure` without a key counts as `off`. |
| STT client | `src/server/speech/stt.ts` | `recognize(wav) → { text, confidence, alternatives } \| null`. Uses the Azure short-audio REST API, en-US, `format=detailed`. Interface plus a fake for tests. |
| TTS client | `src/server/speech/tts.ts` | `synthesize(text) → mp3 bytes`. SSML with the Ava voice. Interface plus a fake for tests. |
| Speakable text | `src/server/speech/speakable.ts` | `speakable(template)` removes `{name}` with its neighbouring comma or space ("Great thinking, {name}!" → "Great thinking!"), then fills `{answer}`. Pure function. |
| Speech token | `src/server/speech/token.ts` | HMAC of (kidId, text) with a server secret. `/speak` only speaks text the server issued, so it can't be used as a free TTS service. |
| Heard router | `src/domain/checker/heard.ts` | Pure. `(text, confidence, alternatives) → {kind:"answer", n} \| {kind:"confirm", n} \| {kind:"say", text}`. Confidence ≥ 0.6 and every alternative that parses to a number agreeing → answer. A number with lower confidence or disagreement → confirm. No number → say. Uses `parseSpokenNumber`. |
| Listen route | `src/app/api/kids/[kidId]/listen/route.ts` | Auth and kid check, WAV body ≤ 256 KB, STT, heard router. Returns `{heard, route}`. Never stores or logs audio or text (`/say` keeps its own distress rule). |
| Speak route | `src/app/api/kids/[kidId]/speak/route.ts` | Auth, token check, text ≤ 300 characters → mp3. `Cache-Control: private`. |
| Pre-made audio | `scripts/premake-audio.ts` → `public/audio/nova/<hash>.mp3` + `manifest.json` | Speaks every canned line that has no `{answer}`, in its speakable form, once. The files are committed. Hash = sha256 of the speakable text plus the voice name. |
| Line payloads | `src/server/playApi.ts` | Each Nova line sent to the tablet gains `speech?: { text, token }` (omitted when `SPEECH=off`). |
| Mic + player | `src/app/play/` (`useMic`, `useNovaAudio`, `MicButton`, `ConfirmHeard`) | Mic capture, WAV encoding, silence stop. The player looks up the manifest first, else calls `/speak`, and handles replay and stop. |

## Kid flow

1. **Nova speaks.** Every new line plays by itself (the avatar tap on the picker unlocks audio). Tapping Nova replays the line. Tapping the mic stops Nova and starts listening.
2. **Listening.** The mic pulses. "I heard: twelve" shows under the problem when the result arrives.
3. **Result:**
   - **answer** → the same request as tapping a tile, so retries and double-tap guards are unchanged.
   - **confirm** → "Did you say 12?" with large ✓ and ✗ buttons (88 px or larger). ✓ answers 12. ✗ → "Let's try again." and the mic is ready again. The tiles and pad stay usable throughout.
   - **say** → the existing `/say` route (steer back to the problem, or the distress line).
   - **nothing heard** (empty STT result) → "I didn't catch that. Try again or tap your answer."
4. **Locking.** Input stays locked while an answer is in flight, as in 5a.

## Failures (main spec §9)

| Failure | Behavior |
|---|---|
| `SPEECH=off`, or no key | No mic, no audio. The 5a screen exactly as it is. |
| Mic permission denied, or no mic | Mic hidden for the page's life. Tiles and pad work. |
| STT error or timeout (4 s) | "I couldn't hear. Tap your answer." Mic hidden after 2 failures in a row. |
| TTS error or timeout (4 s) | Pre-made clip if one exists, else silent. Text is on screen anyway. |
| Line with `{answer}` while TTS is down | Silent (text only) |
| Kid leaves mid-recording | Recording is dropped and any in-flight request is aborted. Nothing is sent after leaving. |

## Privacy

- Audio exists only in tablet memory and in the listen request. It is never written to disk, the DB, or the logs. Azure's short-audio API does not keep audio unless data logging is turned on, and we never turn it on.
- Recognised text that isn't a number goes to `/say`, whose rule (keep only distress lines) is unchanged. Numbers are not stored apart from the attempt itself.
- The name never reaches Azure (see speakable text).
- Azure joins the vendor list under a data processing agreement. The privacy notice copy names "speech service (Microsoft Azure)". The owner and the lawyer review this.

## Testing

- **Unit tests:**
  - **Speakable text:** `speakable` is run over every canned line, checking that no `{`, no double spaces and no stray commas are left.
  - **Heard router:** cases for confidence, disagreeing alternatives, homophones, and no number.
  - **Token:** round trip, plus rejection when the text or the kid is changed.
  - **Azure clients:** request shape, run against the fakes.
- **DB/route tests:** listen and speak routes with fake clients, covering auth, sizes, and a different family's kid (404).
- **E2E:**
  - Chromium's fake mic (`--use-fake-device-for-media-stream`) plus a stubbed `/listen` covers: answer, confirm ✓, confirm ✗, say, mic denied.
  - Audio playback: stubbed, asserting the right URL is requested.
  - `SPEECH=off` hides the mic.
- **Live smoke test** (optional, owner's key, about $0.01): `npm run speech:smoke` recognises a committed sample WAV of "twelve" and speaks one line.

## Owner to-dos (not blocking the build)

1. Create an Azure Speech resource (a US region suggested). Set `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` in `.env.local` and on Vercel.
2. Run `npm run speech:premake` once and commit the clips.
3. Sign Azure's data processing agreement. Add Azure to the privacy notice (lawyer review).
4. Rough cost: STT about $1 per hour of audio. TTS about $15 per million characters, with canned lines prepaid by the clips.

## Out of scope

Drag input. Streaming TTS of Claude lines (lines are guarded as a whole, so each is synthesised whole). Choosing a voice per kid. Languages other than English.
