import { afterEach, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { NOVA_VOICE, speechMode } from "./config";
import { azureStt, SpeechError } from "./stt";
import { azureTts } from "./tts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const wav = new Uint8Array([1, 2, 3]);

describe("azureStt", () => {
  it("sends the documented request", async () => {
    const f = vi.fn().mockResolvedValue(json({ RecognitionStatus: "NoMatch" }));
    await azureStt("k", "westus", f).recognize(wav, new AbortController().signal);
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("https://westus.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed&profanity=raw");
    expect(String(url)).not.toContain("storeAudio");
    expect(init.headers["Ocp-Apim-Subscription-Key"]).toBe("k");
    expect(init.headers["Content-Type"]).toBe("audio/wav; codecs=audio/pcm; samplerate=16000");
    expect(init.headers.Accept).toBe("application/json");
    expect(init.body).toBe(wav);
  });
  it("maps Success", async () => {
    const f = vi.fn().mockResolvedValue(json({ RecognitionStatus: "Success", NBest: [
      { Confidence: 0.82, Lexical: "twelve", Display: "12." }, { Confidence: 0.4, Lexical: "twenty", Display: "20." }] }));
    expect(await azureStt("k", "westus", f).recognize(wav, new AbortController().signal))
      .toEqual({ text: "12.", confidence: 0.82, alternatives: ["twenty"] });
  });
  it("maps NoMatch and InitialSilenceTimeout to null", async () => {
    for (const s of ["NoMatch", "InitialSilenceTimeout"]) {
      const f = vi.fn().mockResolvedValue(json({ RecognitionStatus: s }));
      expect(await azureStt("k", "westus", f).recognize(wav, new AbortController().signal)).toBeNull();
    }
  });
  it("500 rejects with SpeechError error", async () => {
    const f = vi.fn().mockResolvedValue(new Response("x", { status: 500 }));
    await expect(azureStt("k", "westus", f).recognize(wav, new AbortController().signal))
      .rejects.toMatchObject({ name: "SpeechError", reason: "error" });
  });
  it("other statuses reject with error", async () => {
    const f = vi.fn().mockResolvedValue(json({ RecognitionStatus: "Error" }));
    await expect(azureStt("k", "westus", f).recognize(wav, new AbortController().signal)).rejects.toBeInstanceOf(SpeechError);
  });
  it("abort rejects with SpeechError timeout", async () => {
    const f = vi.fn((_u: string, init: RequestInit) => new Promise((_, rej) => {
      init.signal!.addEventListener("abort", () => rej(init.signal!.reason));
    }));
    const ac = new AbortController();
    const p = azureStt("k", "westus", f as never).recognize(wav, ac.signal);
    ac.abort();
    await expect(p).rejects.toMatchObject({ reason: "timeout" });
  });
  it("network failure rejects with error", async () => {
    const f = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    await expect(azureStt("k", "westus", f).recognize(wav, new AbortController().signal)).rejects.toMatchObject({ reason: "error" });
  });
});

describe("azureTts", () => {
  it("sends SSML with escaped text", async () => {
    const f = vi.fn().mockResolvedValue(new Response(new Uint8Array([9, 8])));
    const out = await azureTts("k", "westus", f).synthesize('Tom & "Jo" <3', new AbortController().signal);
    expect([...out]).toEqual([9, 8]);
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("https://westus.tts.speech.microsoft.com/cognitiveservices/v1");
    expect(init.headers["Content-Type"]).toBe("application/ssml+xml");
    expect(init.headers["X-Microsoft-OutputFormat"]).toBe("audio-24khz-48kbitrate-mono-mp3");
    expect(init.headers["User-Agent"]).toBeTruthy();
    expect(init.headers["Ocp-Apim-Subscription-Key"]).toBe("k");
    expect(init.body).toContain('<voice name="en-US-AvaNeural"><prosody rate="-5%">');
    expect(init.body).toContain("Tom &amp; &quot;Jo&quot; &lt;3");
  });
  it("accepts an output format", async () => {
    const f = vi.fn().mockResolvedValue(new Response(new Uint8Array([1])));
    await azureTts("k", "westus", f, "riff-16khz-16bit-mono-pcm").synthesize("x", new AbortController().signal);
    expect(f.mock.calls[0]![1].headers["X-Microsoft-OutputFormat"]).toBe("riff-16khz-16bit-mono-pcm");
  });
  it("500 rejects with SpeechError", async () => {
    const f = vi.fn().mockResolvedValue(new Response("x", { status: 500 }));
    await expect(azureTts("k", "westus", f).synthesize("x", new AbortController().signal)).rejects.toMatchObject({ reason: "error" });
  });
  it("voice constant", () => expect(NOVA_VOICE).toEqual({ name: "en-US-AvaNeural", rate: "-5%" }));
});

describe("speechMode", () => {
  const keys = ["SPEECH", "AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION", "SPEECH_TOKEN_SECRET"];
  afterEach(() => { for (const k of keys) delete process.env[k]; });
  it("unset is off", () => expect(speechMode()).toBe("off"));
  it("azure without key is off", () => {
    process.env.SPEECH = "azure"; process.env.SPEECH_TOKEN_SECRET = "s";
    expect(speechMode()).toBe("off");
  });
  it("azure complete is azure", () => {
    process.env.SPEECH = "azure"; process.env.SPEECH_TOKEN_SECRET = "s";
    process.env.AZURE_SPEECH_KEY = "k"; process.env.AZURE_SPEECH_REGION = "westus";
    expect(speechMode()).toBe("azure");
  });
  it("azure without token secret is off", () => {
    process.env.SPEECH = "azure"; process.env.AZURE_SPEECH_KEY = "k"; process.env.AZURE_SPEECH_REGION = "westus";
    expect(speechMode()).toBe("off");
  });
  it("bogus is off", () => { process.env.SPEECH = "bogus"; expect(speechMode()).toBe("off"); });
  it("fake is fake with secret, off without", () => {
    process.env.SPEECH = "fake";
    expect(speechMode()).toBe("off");
    process.env.SPEECH_TOKEN_SECRET = "s";
    expect(speechMode()).toBe("fake");
  });
});
