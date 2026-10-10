import "server-only";
import type { Heard } from "@/domain/checker/heard";

export const SPEECH_TIMEOUT_MS = 4000;

export class SpeechError extends Error {
  constructor(public reason: "timeout" | "error", message?: string) {
    super(message ?? `speech ${reason}`);
    this.name = "SpeechError";
  }
}

export interface Stt {
  /** null: Azure heard no speech. Throws SpeechError on failure or timeout. */
  recognize(wav: Uint8Array, signal: AbortSignal): Promise<Heard | null>;
}

/** Shared by STT and TTS: apply the 4 s timeout and turn failures into SpeechError. Logs status only. */
export async function guardedFetch(
  fetchFn: typeof fetch, url: string, init: RequestInit, signal: AbortSignal, what: string,
): Promise<Response> {
  let res: Response;
  try {
    res = await fetchFn(url, { ...init, signal: AbortSignal.any([signal, AbortSignal.timeout(SPEECH_TIMEOUT_MS)]) });
  } catch (e) {
    const name = (e as { name?: string } | null)?.name;
    throw new SpeechError(name === "AbortError" || name === "TimeoutError" ? "timeout" : "error");
  }
  if (!res.ok) {
    console.warn(`${what} failed with status ${res.status}`);
    throw new SpeechError("error");
  }
  return res;
}

type Detailed = {
  RecognitionStatus?: string;
  NBest?: { Confidence: number; Lexical: string; Display: string }[];
};

export function azureStt(key: string, region: string, fetchFn: typeof fetch = fetch): Stt {
  return {
    async recognize(wav, signal) {
      const res = await guardedFetch(
        fetchFn,
        `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed&profanity=raw`,
        {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": key,
            "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
            Accept: "application/json",
          },
          body: wav as BodyInit,
        },
        signal,
        "Azure STT",
      );
      let body: Detailed;
      try {
        body = (await res.json()) as Detailed;
      } catch (e) {
        const name = (e as { name?: string } | null)?.name;
        throw new SpeechError(name === "AbortError" || name === "TimeoutError" ? "timeout" : "error");
      }
      const status = body.RecognitionStatus;
      if (status === "NoMatch" || status === "InitialSilenceTimeout" || status === "BabbleTimeout") return null;
      const best = body.NBest?.[0];
      if (status !== "Success" || !best) throw new SpeechError("error");
      return {
        text: best.Display,
        confidence: best.Confidence,
        alternatives: body.NBest!.slice(1).map((n) => n.Lexical),
      };
    },
  };
}

export function fakeStt(): Stt {
  return { recognize: async () => ({ text: "twelve", confidence: 0.95, alternatives: [] }) };
}
