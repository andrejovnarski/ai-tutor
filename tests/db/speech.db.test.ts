// Speech payloads and the listen/speak routes, with the fake STT/TTS. Same harness as api.db.test.ts.
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { admin, makeParent } from "../helpers/admin";

const who = vi.hoisted(() => ({ client: null as unknown as SupabaseClient, conf: null as number | null }));
vi.mock("server-only", () => ({}));
vi.mock("../../src/server/supabase", () => ({ createServerSupabase: async () => who.client }));
vi.mock("../../src/server/speech/config", async (orig) => {
  const real = await orig<typeof import("../../src/server/speech/config")>();
  return {
    ...real,
    getStt: () => {
      const s = real.getStt();
      if (!s || who.conf === null) return s;
      return { recognize: async () => ({ text: "twelve", confidence: who.conf!, alternatives: [] }) };
    },
  };
});

import { POST as turnPost } from "../../src/app/api/kids/[kidId]/turn/route";
import { POST as sayPost } from "../../src/app/api/kids/[kidId]/say/route";
import { POST as listenPost } from "../../src/app/api/kids/[kidId]/listen/route";
import { POST as speakPost } from "../../src/app/api/kids/[kidId]/speak/route";
import { checkSpeechToken } from "../../src/server/speech/token";
import { DISTRESS_REPLY } from "../../src/server/distress/phrases";

const SECRET = "test-secret";
const run = Date.now();
let A: { userId: string; client: SupabaseClient };
let B: { userId: string; client: SupabaseClient };
let kidA: string;
let kidA2: string;
let kidB: string;

const ctx = (kidId: string) => ({ params: Promise.resolve({ kidId }) });
const json = (body: unknown) => new Request("http://x/api", { method: "POST", body: JSON.stringify(body) });
const wav = (extra = 0) => {
  const data = new Uint8Array(3200 + extra);
  const buf = new Uint8Array(44 + data.length);
  const dv = new DataView(buf.buffer);
  buf.set([..."RIFF"].map((c) => c.charCodeAt(0)), 0);
  dv.setUint32(4, 36 + data.length, true);
  buf.set([..."WAVEfmt "].map((c) => c.charCodeAt(0)), 8);
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, 16000, true); dv.setUint32(28, 32000, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  buf.set([..."data"].map((c) => c.charCodeAt(0)), 36);
  dv.setUint32(40, data.length, true);
  return buf;
};
const listenReq = (body: Uint8Array | string) =>
  new Request("http://x/api", { method: "POST", headers: { "content-type": "audio/wav" }, body: body as BodyInit });
const attempts = async (kid: string) =>
  (await admin().from("attempts").select("*", { count: "exact", head: true }).eq("kid_id", kid)).count;

const newKid = async (c: { userId: string; client: SupabaseClient }, nickname: string) => {
  const { data, error } = await c.client.from("kids")
    .insert({ parent_id: c.userId, nickname, grade: "K", age_band: "5-7", avatar: "fox" }).select().single();
  expect(error).toBeNull();
  return data.id as string;
};

beforeAll(async () => {
  A = await makeParent(`sp-a-${run}@test.dev`, { consent: true });
  B = await makeParent(`sp-b-${run}@test.dev`, { consent: true });
  kidA = await newKid(A, "Ann");
  kidA2 = await newKid(A, "Ben");
  kidB = await newKid(B, "Cy");
});

afterEach(() => { vi.unstubAllEnvs(); who.conf = null; vi.restoreAllMocks(); });
const speechOn = () => { vi.stubEnv("SPEECH", "fake"); vi.stubEnv("SPEECH_TOKEN_SECRET", SECRET); who.client = A.client; };

const getLine = async (kid = kidA) => {
  const res = await turnPost(json({}), ctx(kid));
  expect(res.status).toBe(200);
  return (await res.json()).line;
};

describe("speech payloads", () => {
  it("turn line.speech has no nickname and a valid token", async () => {
    speechOn();
    const line = await getLine();
    expect(line.speech.text).not.toContain("Ann");
    expect(line.speech.text.length).toBeGreaterThan(0);
    expect(checkSpeechToken(SECRET, kidA, line.speech.text, line.speech.token)).toBe(true);
  });

  it("SPEECH=off: no speech field, listen and speak are 404", async () => {
    vi.stubEnv("SPEECH", "off"); vi.stubEnv("SPEECH_TOKEN_SECRET", SECRET); who.client = A.client;
    const line = await getLine();
    expect(line.speech).toBeUndefined();
    expect((await listenPost(listenReq(wav()), ctx(kidA))).status).toBe(404);
    expect((await speakPost(json({ text: "hi", token: "x" }), ctx(kidA))).status).toBe(404);
  });

  it("say with distress returns replySpeech of DISTRESS_REPLY", async () => {
    speechOn();
    const res = await sayPost(json({ text: "I want to hurt myself" }), ctx(kidA));
    const body = await res.json();
    expect(body.reply).toBe(DISTRESS_REPLY);
    expect(body.replySpeech.text).toBe(DISTRESS_REPLY);
    expect(checkSpeechToken(SECRET, kidA, DISTRESS_REPLY, body.replySpeech.token)).toBe(true);
  });
});

describe("listen", () => {
  it("fake STT: twelve routes to answer 12 and no attempt is written", async () => {
    speechOn();
    const before = await attempts(kidA);
    const res = await listenPost(listenReq(wav()), ctx(kidA));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ heard: "twelve", route: { kind: "answer", n: 12 } });
    expect(await attempts(kidA)).toBe(before);
  });

  it("low confidence gives a confirm with speech", async () => {
    speechOn();
    who.conf = 0.3;
    const body = await (await listenPost(listenReq(wav()), ctx(kidA))).json();
    expect(body.route).toEqual({ kind: "confirm", n: 12 });
    expect(body.speech.text).toBe("Did you say 12?");
    expect(checkSpeechToken(SECRET, kidA, "Did you say 12?", body.speech.token)).toBe(true);
  });

  it("413 over 256 KB, 400 empty or non-RIFF, 404 other family's kid", async () => {
    speechOn();
    expect((await listenPost(listenReq(wav(300 * 1024)), ctx(kidA))).status).toBe(413);
    expect((await listenPost(listenReq(new Uint8Array(0)), ctx(kidA))).status).toBe(400);
    expect((await listenPost(listenReq(new Uint8Array(100).fill(7)), ctx(kidA))).status).toBe(400);
    expect((await listenPost(listenReq(wav()), ctx(kidB))).status).toBe(404);
  });
});

describe("speak", () => {
  it("serves audio/mpeg privately for a turn's token", async () => {
    speechOn();
    const { speech } = await getLine();
    const res = await speakPost(json(speech), ctx(kidA));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    expect(res.headers.get("cache-control")).toContain("private");
  });

  it("400 on tampered text, another kid's token, or over 300 chars", async () => {
    speechOn();
    const { speech } = await getLine();
    expect((await speakPost(json({ text: speech.text + "!", token: speech.token }), ctx(kidA))).status).toBe(400);
    expect((await speakPost(json(speech), ctx(kidA2))).status).toBe(400);
    const long = "a".repeat(301);
    const { speechToken } = await import("../../src/server/speech/token");
    expect((await speakPost(json({ text: long, token: speechToken(SECRET, kidA, long) }), ctx(kidA))).status).toBe(400);
  });
});

describe("privacy", () => {
  it("listen and speak never log the heard text or audio", async () => {
    speechOn();
    const spies = (["log", "info", "warn", "error"] as const).map((k) => vi.spyOn(console, k).mockImplementation(() => {}));
    const audio = wav();
    await listenPost(listenReq(audio), ctx(kidA));
    const { speech } = await getLine();
    await speakPost(json(speech), ctx(kidA));
    const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls.map((c) => c.map(String))));
    expect(logged).not.toContain("twelve");
    expect(logged).not.toContain(String(audio));
  });
});
