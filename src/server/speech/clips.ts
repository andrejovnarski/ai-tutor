import "server-only";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { NOVA_VOICE } from "./voice";

/** Cache key of a pre-rendered clip: changes with the voice, so a new voice never serves stale audio. */
export function clipKey(text: string): string {
  return createHash("sha256").update(`${NOVA_VOICE.name}|${NOVA_VOICE.rate}|${text}`).digest("hex");
}

/** The clip keys in a parsed manifest ({ voice, rate, clips: { [key]: true } }); anything malformed gives {}. */
export function clipsFrom(json: unknown): Record<string, true> {
  const out: Record<string, true> = {};
  const clips = json && typeof json === "object" ? (json as { clips?: unknown }).clips : undefined;
  if (!clips || typeof clips !== "object" || Array.isArray(clips)) return out;
  for (const [k, v] of Object.entries(clips)) if (v === true) out[k] = true;
  return out;
}

let manifest: Record<string, true> | null = null;
function load(): Record<string, true> {
  if (manifest) return manifest;
  try {
    manifest = clipsFrom(JSON.parse(readFileSync(path.join(process.cwd(), "public/audio/nova/manifest.json"), "utf8")));
  } catch {
    manifest = {};
  }
  return manifest;
}

/** The public URL of the clip for this exact text, or undefined when none is in the manifest. */
export function clipFor(text: string): string | undefined {
  const key = clipKey(text);
  return Object.hasOwn(load(), key) ? `/audio/nova/${key}.mp3` : undefined;
}
