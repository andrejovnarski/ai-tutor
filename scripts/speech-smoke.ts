// Live smoke test for Azure speech. Usage: npm run speech:smoke
// Needs SPEECH=azure, AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (read from .env.local). Exits 1 otherwise.
// Run via `tsx --conditions=react-server` (see package.json) so `server-only` resolves.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
}

const key = process.env.AZURE_SPEECH_KEY;
const region = process.env.AZURE_SPEECH_REGION;
if (process.env.SPEECH !== "azure" || !key || !region) {
  console.error("speech:smoke needs SPEECH=azure plus AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (set them in .env.local). Not calling Azure.");
  process.exit(1);
}

const { azureStt } = await import("../src/server/speech/stt");
const { azureTts } = await import("../src/server/speech/tts");
const signal = new AbortController().signal;

const fixture = "tests/fixtures/twelve.wav";
if (!existsSync(fixture)) {
  console.log("Generating tests/fixtures/twelve.wav with Azure TTS (first run only)");
  const wav = await azureTts(key, region, fetch, "riff-16khz-16bit-mono-pcm").synthesize("twelve", signal);
  mkdirSync("tests/fixtures", { recursive: true });
  writeFileSync(fixture, wav);
}

const heard = await azureStt(key, region).recognize(new Uint8Array(readFileSync(fixture)), signal);
console.log(heard ? `Heard: "${heard.text}" confidence ${heard.confidence}` : "Heard nothing");

const mp3 = await azureTts(key, region).synthesize("Hello from Nova!", signal);
mkdirSync("scripts/.out", { recursive: true });
writeFileSync("scripts/.out/smoke.mp3", mp3);
console.log(`Wrote scripts/.out/smoke.mp3 (${mp3.length} bytes)`);
