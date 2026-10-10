import "server-only";
import { NOVA_VOICE } from "./voice";
import { guardedFetch, SpeechError } from "./stt";

export interface Tts {
  /** MP3 bytes. Throws SpeechError. */
  synthesize(text: string, signal: AbortSignal): Promise<Uint8Array>;
}

const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export function azureTts(
  key: string, region: string, fetchFn: typeof fetch = fetch,
  outputFormat = "audio-24khz-48kbitrate-mono-mp3",
): Tts {
  return {
    async synthesize(text, signal) {
      const ssml =
        `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">` +
        `<voice name="${NOVA_VOICE.name}"><prosody rate="${NOVA_VOICE.rate}">${xmlEscape(text)}</prosody></voice></speak>`;
      const res = await guardedFetch(
        fetchFn,
        `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
        {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": key,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": outputFormat,
            "User-Agent": "adaptive-tutor",
          },
          body: ssml,
        },
        signal,
        "Azure TTS",
      );
      try {
        return new Uint8Array(await res.arrayBuffer());
      } catch (e) {
        const name = (e as { name?: string } | null)?.name;
        throw new SpeechError(name === "AbortError" || name === "TimeoutError" ? "timeout" : "error");
      }
    },
  };
}

// One silent MPEG-1 Layer III frame (128 kbps, 44.1 kHz, mono): 4-byte header plus zeroed payload.
const SILENT_FRAME = new Uint8Array(417);
SILENT_FRAME.set([0xff, 0xfb, 0x90, 0xc4]);

export function fakeTts(): Tts {
  return { synthesize: async () => SILENT_FRAME.slice() };
}
