import "server-only";
import { createHash } from "node:crypto";
import { NOVA_VOICE } from "./voice";
// Imported, not read from disk: on Vercel `public/` is served by the CDN and is not on the function's filesystem.
import manifestJson from "../../../public/audio/nova/manifest.json";

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

const manifest = clipsFrom(manifestJson);

/** The public URL of the clip for this exact text, or undefined when none is in the manifest. */
export function clipFor(text: string): string | undefined {
  const key = clipKey(text);
  return Object.hasOwn(manifest, key) ? `/audio/nova/${key}.mp3` : undefined;
}
