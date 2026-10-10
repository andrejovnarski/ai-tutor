import { describe, expect, it } from "vitest";
import { downsample, encodeWav } from "./wav";

const str = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.slice(at, at + n));

describe("encodeWav", () => {
  it("writes a 16 kHz mono 16-bit PCM header", () => {
    const b = encodeWav(new Float32Array(1600));
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    expect(b.length).toBe(44 + 3200);
    expect(str(b, 0, 4)).toBe("RIFF");
    expect(v.getUint32(4, true)).toBe(36 + 3200);
    expect(str(b, 8, 4)).toBe("WAVE");
    expect(str(b, 12, 4)).toBe("fmt ");
    expect(v.getUint16(20, true)).toBe(1);
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint32(24, true)).toBe(16000);
    expect(v.getUint32(28, true)).toBe(32000);
    expect(v.getUint16(34, true)).toBe(16);
    expect(str(b, 36, 4)).toBe("data");
    expect(v.getUint32(40, true)).toBe(3200);
  });
  it("clamps out-of-range samples", () => {
    const b = encodeWav(new Float32Array([1.5, -1.5]));
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    expect(v.getInt16(44, true)).toBe(32767);
    expect(v.getInt16(46, true)).toBe(-32768);
  });
});

describe("downsample", () => {
  it("48k to 16k", () => expect(downsample(new Float32Array(4800), 48000).length).toBe(1600));
  it("44.1k to 16k", () => {
    expect(Math.abs(downsample(new Float32Array(4410), 44100).length - 1600)).toBeLessThanOrEqual(1);
  });
  it("keeps a constant signal", () => {
    const out = downsample(new Float32Array(4800).fill(0.5), 48000);
    for (const x of out) expect(x).toBeCloseTo(0.5, 5);
  });
  it("returns the input when rates match", () => {
    const a = new Float32Array([0.1, 0.2]);
    expect(downsample(a, 16000)).toEqual(a);
  });
});
