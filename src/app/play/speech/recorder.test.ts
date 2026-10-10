// The recorder's release paths, with fake Web Audio and getUserMedia (node has neither).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startRecording } from "./recorder";

type Fake = { ctx: FakeCtx; tracks: Array<{ stop: ReturnType<typeof vi.fn> }>; gum: ReturnType<typeof vi.fn> };
let fake: Fake;

class FakeCtx {
  state: string;
  sampleRate = 48000;
  destination = {};
  resume = vi.fn(() => new Promise<void>(() => {})); // an iOS "interrupted" context: resume never settles
  close = vi.fn(async () => {});
  constructor() {
    this.state = "interrupted";
    fake.ctx = this;
  }
  createMediaStreamSource() { return { connect: vi.fn(), disconnect: vi.fn() }; }
  createScriptProcessor() { return { connect: vi.fn(), disconnect: vi.fn(), onaudioprocess: null }; }
}

const stream = () => {
  const tracks = [{ stop: vi.fn() }];
  fake.tracks = tracks;
  return { getTracks: () => tracks };
};

beforeEach(() => {
  vi.useFakeTimers();
  fake = { ctx: undefined as never, tracks: [], gum: vi.fn(async () => stream()) };
  vi.stubGlobal("window", { AudioContext: FakeCtx });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: fake.gum } });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const released = () => {
  expect(fake.tracks.length).toBeGreaterThan(0);
  for (const t of fake.tracks) expect(t.stop).toHaveBeenCalled();
  expect(fake.ctx.close).toHaveBeenCalled();
};

describe("startRecording with a context whose resume() never settles (iOS interrupted)", () => {
  it("an abort releases the mic at once: tracks stopped, context closed, null", async () => {
    const c = new AbortController();
    const p = startRecording({ signal: c.signal });
    await vi.advanceTimersByTimeAsync(50); // getUserMedia resolved; now stuck in resume
    c.abort();
    await expect(p).resolves.toBeNull();
    released();
  });

  it("without an abort it still gives up (bounded), releasing the mic", async () => {
    const p = startRecording({ signal: new AbortController().signal });
    let out: unknown = "pending";
    void p.then((v) => { out = v; });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(out).toBeNull();
    released();
  });
});

describe("startRecording while the permission prompt is open", () => {
  it("an abort resolves null, and a stream granted later is stopped at once", async () => {
    let grant!: (s: unknown) => void;
    fake.gum.mockImplementation(() => new Promise((r) => { grant = r; }));
    const c = new AbortController();
    const p = startRecording({ signal: c.signal });
    c.abort();
    await expect(p).resolves.toBeNull();
    grant(stream());
    await vi.advanceTimersByTimeAsync(0);
    released();
  });
});
