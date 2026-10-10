import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { vi } from "vitest";
import { bubbleView } from "../bubble";
import { playReducer, replyLine, type PlayState } from "../playMachine";
import { ConfirmHeard, MicStrip } from "./ConfirmHeard";
import { Mic } from "./MicButton";
import { micReducer, type MicState } from "./micMachine";
import { SILENT_WAV, unlockElement } from "./useNovaAudio";

const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
const idle: MicState = { phase: "idle", version: 3, failures: 0, hidden: false };
const noop = () => {};

/** The px value of `prop` in the `.name { ... }` rule of play.module.css. */
function cssPx(name: string, prop: string): number {
  const css = readFileSync(path.join(__dirname, "../play.module.css"), "utf8");
  const rule = new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? "";
  return Number(new RegExp(`${prop}:\\s*(\\d+)px`).exec(rule)?.[1] ?? 0);
}

describe("Mic", () => {
  it("renders nothing when speech is off", () => {
    expect(renderToStaticMarkup(<Mic speech={false} mic={idle} locked={false} onTap={noop} />)).toBe("");
  });
  it("renders nothing once hidden (mic denied, or two failures)", () => {
    expect(renderToStaticMarkup(<Mic speech mic={{ ...idle, hidden: true }} locked={false} onTap={noop} />)).toBe("");
  });
  it("renders a Talk to Nova button of 88 px or more", () => {
    const html = renderToStaticMarkup(<Mic speech mic={idle} locked={false} onTap={noop} />);
    const button = /<button[^>]*>/.exec(html)?.[0] ?? "";
    expect(button).toContain('aria-label="Talk to Nova"');
    expect(button).toMatch(/class="(?:[^"]*[\s_])?mic[_\s"]/); // CSS modules give _mic_hash
    expect(cssPx("mic", "min-width")).toBeGreaterThanOrEqual(88);
    expect(cssPx("mic", "min-height")).toBeGreaterThanOrEqual(88);
    expect(button).not.toContain("disabled");
  });
  it("shows its phase while listening and is off while an answer is in flight", () => {
    const listening = micReducer(idle, { type: "start", version: 3 });
    expect(renderToStaticMarkup(<Mic speech mic={listening} locked={false} onTap={noop} />)).toContain('data-mic="listening"');
    expect(renderToStaticMarkup(<Mic speech mic={idle} locked onTap={noop} />)).toMatch(/<button[^>]*disabled/);
  });
  it("is visibly off while thinking and while Did you say is up (a tap there would do nothing)", () => {
    const thinking = micReducer(micReducer(idle, { type: "start", version: 3 }), { type: "sent" });
    const confirm = micReducer(thinking, { type: "result", version: 3, heard: "x", route: { kind: "confirm", n: 12 } });
    for (const m of [thinking, confirm]) {
      expect(renderToStaticMarkup(<Mic speech mic={m} locked={false} onTap={noop} />)).toMatch(/<button[^>]*disabled/);
    }
    const listening = micReducer(idle, { type: "start", version: 3 });
    expect(renderToStaticMarkup(<Mic speech mic={listening} locked={false} onTap={noop} />)).not.toMatch(/<button[^>]*disabled/);
  });
});

describe("ConfirmHeard and the heard line", () => {
  const confirm = micReducer(micReducer(idle, { type: "start", version: 3 }),
    { type: "result", version: 3, heard: "twelve", route: { kind: "confirm", n: 12 } });
  it("the confirm state asks Did you say 12? with Yes and No buttons of 88 px or more", () => {
    const html = renderToStaticMarkup(<MicStrip mic={confirm} onYes={noop} onNo={noop} />);
    expect(text(html)).toContain("Did you say 12?");
    expect(html).toMatch(/<button[^>]*aria-label="Yes"/);
    expect(html).toMatch(/<button[^>]*aria-label="No"/);
    expect(cssPx("confirmButton", "min-width")).toBeGreaterThanOrEqual(88);
    expect(cssPx("confirmButton", "min-height")).toBeGreaterThanOrEqual(88);
    expect(text(html)).not.toContain("I heard");
  });
  it("ConfirmHeard alone renders the question", () => {
    expect(text(renderToStaticMarkup(<ConfirmHeard n={7} onYes={noop} onNo={noop} />))).toContain("Did you say 7?");
  });
  it("the heard text renders I heard: twelve", () => {
    const said = micReducer(micReducer(idle, { type: "start", version: 3 }),
      { type: "result", version: 3, heard: "twelve", route: { kind: "say", text: "twelve" } });
    expect(text(renderToStaticMarkup(<MicStrip mic={said} onYes={noop} onNo={noop} />))).toBe("I heard: twelve");
  });
  it("a notice shows its copy; an idle mic shows nothing", () => {
    const no = micReducer(confirm, { type: "no" });
    expect(text(renderToStaticMarkup(<MicStrip mic={no} onYes={noop} onNo={noop} />))).toBe("Let's try again.");
    expect(renderToStaticMarkup(<MicStrip mic={idle} onYes={noop} onNo={noop} />)).toBe("");
  });
});

describe("the said event", () => {
  const problem: PlayState = {
    phase: "problem", version: 4, line: { say: "How many in all?", tone: "curious" }, note: "old note", correct: true,
    turn: { kind: "problem" } as never,
  };
  const reply = { say: "Cats are fun! Let's count.", tone: "calm" as const, speech: { text: "Cats are fun! Let's count.", token: "t" } };
  const s = playReducer(problem, { type: "said", line: reply });
  it("puts the reply above the current line; problem, version and phase unchanged", () => {
    expect(s).toMatchObject({ phase: "problem", version: 4, message: reply.say, messageSpeech: reply.speech, correct: false });
    expect(s.line).toBe(problem.line);
    expect(s.turn).toBe(problem.turn);
    const v = bubbleView(s, { reduced: false, holdDone: false });
    expect(v.lead).toBe(reply.say);
    expect(v.say).toBe("How many in all?");
    expect(v.note).toBeUndefined();
  });
  it("is ignored once the problem is not on screen", () => {
    const sending = { ...problem, phase: "sending" as const };
    expect(playReducer(sending, { type: "said", line: reply })).toBe(sending);
  });
  it("messageSpeech follows message on an answer that moved on", () => {
    const fb = { say: "Yes!", tone: "cheer" as const, speech: { text: "Yes!", token: "a" } };
    const next = playReducer(problem, {
      type: "answered",
      body: {
        version: 5, feedback: { result: { kind: "correct" }, then: "next", reveal: false },
        next: { kind: "problem" } as never, line: fb, nextLine: { say: "Next", tone: "curious" },
      },
    });
    expect(next.messageSpeech).toEqual(fb.speech);
    expect(playReducer(next, { type: "conflict", body: { version: 6, turn: { kind: "problem" } as never } }).messageSpeech).toBeUndefined();
  });
});

describe("replyLine (the /say body, on any status)", () => {
  it("takes the reply and its speech, even from an error body (distress line whose storing failed)", () => {
    const sp = { text: "That sounds hard.", token: "t" };
    expect(replyLine({ error: "try again", reply: "That sounds hard.", replySpeech: sp }))
      .toEqual({ say: "That sounds hard.", tone: "calm", speech: sp });
    expect(replyLine({ reply: "Hi" })).toEqual({ say: "Hi", tone: "calm" });
  });
  it("nothing to show without a string reply", () => {
    for (const b of [null, "x", {}, { error: "try again" }, { reply: 3 }, { reply: "" }]) expect(replyLine(b)).toBeNull();
  });
});

describe("unlockElement (iOS: an <audio> may play later only if play() was called on it inside a tap)", () => {
  const el = () => ({ src: "", play: vi.fn(() => Promise.resolve()), pause: vi.fn() });
  it("calls play() on the silent clip synchronously, then pauses it", async () => {
    const a = el();
    unlockElement(a);
    expect(a.play).toHaveBeenCalledTimes(1); // no await before it: still inside the tap
    expect(a.src).toBe(SILENT_WAV);
    await Promise.resolve();
    await Promise.resolve();
    expect(a.pause).toHaveBeenCalledTimes(1);
  });
  it("does not pause a real line that took the element over meanwhile", async () => {
    const a = el();
    unlockElement(a);
    a.src = "blob:line";
    await Promise.resolve();
    await Promise.resolve();
    expect(a.pause).not.toHaveBeenCalled();
  });
  it("a refused play() is swallowed", async () => {
    const a = { ...el(), play: vi.fn(() => Promise.reject(new Error("NotAllowedError"))) };
    expect(() => unlockElement(a)).not.toThrow();
    await Promise.resolve();
  });
});
