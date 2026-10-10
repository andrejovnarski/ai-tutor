import "server-only";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { NOVA_VOICE } from "./voice";

/** Cache key of a pre-rendered clip: changes with the voice, so a new voice never serves stale audio. */
export function clipKey(text: string): string {
  return createHash("sha256").update(`${NOVA_VOICE.name}|${NOVA_VOICE.rate}|${text}`).digest("hex");
}

let manifest: Record<string, unknown> | null = null;
function load(): Record<string, unknown> {
  if (manifest) return manifest;
  try {
    const raw = JSON.parse(readFileSync(path.join(process.cwd(), "public/audio/nova/manifest.json"), "utf8"));
    manifest = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  } catch {
    manifest = {};
  }
  return manifest!;
}

/** The public URL of the clip for this exact text, or undefined when none is in the manifest. */
export function clipFor(text: string): string | undefined {
  const key = clipKey(text);
  return Object.hasOwn(load(), key) ? `/audio/nova/${key}.mp3` : undefined;
}
