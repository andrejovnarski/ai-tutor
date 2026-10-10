import { describe, expect, it } from "vitest";
import { audioReducer, nowPlaying, type AudioState } from "./audioMachine";
import type { LineSpeech } from "../../../server/speech/lineSpeech";

const a: LineSpeech = { text: "a", token: "ta" };
const b: LineSpeech = { text: "b", token: "tb" };
const c: LineSpeech = { text: "c", token: "tc" };
const empty: AudioState = { queue: [], listening: false };

describe("audioReducer", () => {
  it("plays a, then b, then nothing", () => {
    const s1 = audioReducer(empty, { type: "lines", lines: [a, b] });
    expect(nowPlaying(s1)).toEqual(a);
    const s2 = audioReducer(s1, { type: "ended" });
    expect(nowPlaying(s2)).toEqual(b);
    expect(nowPlaying(audioReducer(s2, { type: "ended" }))).toBeUndefined();
  });
  it("new lines replace the queue and stop the current one", () => {
    const s = audioReducer(audioReducer(empty, { type: "lines", lines: [a, b] }), { type: "lines", lines: [c] });
    expect(nowPlaying(s)).toEqual(c);
    expect(s.queue).toEqual([]);
  });
  it("mic on stops playback and holds lines until mic off", () => {
    const playing = audioReducer(empty, { type: "lines", lines: [a] });
    const on = audioReducer(playing, { type: "mic", on: true });
    expect(nowPlaying(on)).toBeUndefined();
    const held = audioReducer(on, { type: "lines", lines: [b, c] });
    expect(nowPlaying(held)).toBeUndefined();
    const off = audioReducer(held, { type: "mic", on: false });
    expect(nowPlaying(off)).toEqual(b);
    expect(off.queue).toEqual([c]);
  });
  it("replay puts the line in front", () => {
    const s = audioReducer(audioReducer(empty, { type: "lines", lines: [a, b] }), { type: "replay", line: c });
    expect(nowPlaying(s)).toEqual(c);
    expect(s.queue).toEqual([b]);
  });
  it("replay while listening is ignored", () => {
    const on = audioReducer(empty, { type: "mic", on: true });
    expect(audioReducer(on, { type: "replay", line: a })).toBe(on);
  });
  it("failed skips to the next line", () => {
    const s = audioReducer(audioReducer(empty, { type: "lines", lines: [a, b] }), { type: "failed" });
    expect(nowPlaying(s)).toEqual(b);
  });
});
