// Pre-renders Nova's fixed lines to public/audio/nova/<clipKey>.mp3 and rewrites manifest.json.
// Usage: npm run speech:premake. Needs SPEECH=azure, AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (.env.local). Exits 1 otherwise.
// Run via `tsx --conditions=react-server` (see package.json) so `server-only` resolves.
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
}

const key = process.env.AZURE_SPEECH_KEY;
const region = process.env.AZURE_SPEECH_REGION;
if (process.env.SPEECH !== "azure" || !key || !region) {
  console.error("speech:premake needs SPEECH=azure plus AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (set them in .env.local). Not calling Azure.");
  process.exit(1);
}

const { premakeList } = await import("../src/server/speech/premake");
const { clipKey } = await import("../src/server/speech/clips");
const { azureTts } = await import("../src/server/speech/tts");
const { NOVA_VOICE } = await import("../src/server/speech/voice");

const dir = "public/audio/nova";
mkdirSync(dir, { recursive: true });
const tts = azureTts(key, region);
const signal = new AbortController().signal;

const items = premakeList().map((text) => ({ text, key: clipKey(text) }));
const wanted = new Set(items.map((i) => `${i.key}.mp3`));
let made = 0;
let skipped = 0;
let failed = 0;

const todo = items.filter((i) => {
  if (existsSync(`${dir}/${i.key}.mp3`)) {
    skipped++;
    return false;
  }
  return true;
});

let next = 0;
async function worker() {
  while (next < todo.length) {
    const item = todo[next++];
    try {
      writeFileSync(`${dir}/${item.key}.mp3`, await tts.synthesize(item.text, signal));
      made++;
    } catch (e) {
      failed++;
      console.error(`Failed: "${item.text}" (${e instanceof Error ? e.message : "error"})`);
    }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));

let removed = 0;
for (const f of readdirSync(dir)) {
  if (f.endsWith(".mp3") && !wanted.has(f)) {
    unlinkSync(`${dir}/${f}`);
    removed++;
  }
}

const clips: Record<string, true> = {};
for (const i of items) if (existsSync(`${dir}/${i.key}.mp3`)) clips[i.key] = true;
writeFileSync(`${dir}/manifest.json`, JSON.stringify({ voice: NOVA_VOICE.name, rate: NOVA_VOICE.rate, clips }, null, 2) + "\n");

console.log(`Made ${made}, skipped ${skipped}, removed ${removed}, failed ${failed}. Manifest lists ${Object.keys(clips).length} clips.`);
if (failed) process.exit(1);
