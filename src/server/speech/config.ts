import "server-only";
import { env } from "../env";
import { azureStt, fakeStt, type Stt } from "./stt";
import { azureTts, fakeTts, type Tts } from "./tts";

export { NOVA_VOICE } from "./voice";
export { SPEECH_TIMEOUT_MS, SpeechError } from "./stt";
export type { Stt } from "./stt";
export type { Tts } from "./tts";

let warned = false;
function warnOnce(msg: string) {
  if (warned) return;
  warned = true;
  console.warn(msg);
}

/** off unless fully configured: azure needs key and region; azure and fake both need SPEECH_TOKEN_SECRET; fake is
 * never allowed in production (a kid would be "heard" saying twelve). */
export function speechMode(): "azure" | "fake" | "off" {
  const mode = env.speech();
  if (mode === "off") return "off";
  if (mode === "fake" && process.env.VERCEL_ENV === "production") {
    warnOnce("SPEECH=fake is not allowed in production; speech is off");
    return "off";
  }
  if (!process.env.SPEECH_TOKEN_SECRET) {
    warnOnce(`SPEECH=${mode} needs SPEECH_TOKEN_SECRET; speech is off`);
    return "off";
  }
  if (mode === "azure" && (!process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION)) {
    warnOnce("SPEECH=azure needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION; speech is off");
    return "off";
  }
  return mode;
}

export function getStt(): Stt | null {
  const m = speechMode();
  if (m === "fake") return fakeStt();
  return m === "azure" ? azureStt(env.azureSpeechKey(), env.azureSpeechRegion()) : null;
}

export function getTts(): Tts | null {
  const m = speechMode();
  if (m === "fake") return fakeTts();
  return m === "azure" ? azureTts(env.azureSpeechKey(), env.azureSpeechRegion()) : null;
}
