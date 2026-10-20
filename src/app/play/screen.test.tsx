import { vi } from "vitest";
import type { PlayState } from "./playMachine";
import { PlayScreen } from "./PlayScreen";

const play = vi.hoisted(() => ({ state: { phase: "loading" } as PlayState }));
vi.mock("./usePlay", () => ({ usePlay: () => ({ state: play.state, answer: vi.fn(), help: vi.fn(), retry: vi.fn(), say: vi.fn(), playAgain: vi.fn() }) }));
import { renderToStaticMarkup } from "react-dom/server";
import { EndCard } from "./EndCard";
import { ConnectionNotice } from "./ConnectionNotice";
import { LineBubble } from "./LineBubble";
import { Board } from "./Board";

const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

describe("EndCard", () => {
  const html = renderToStaticMarkup(<EndCard summary={{ problems: 7, firstTryCorrect: 5 }} onPlayAgain={() => {}} />);
  it.each([
    { today: "You practiced Big taking away with borrowing.", next: "Next time: more Big taking away with borrowing" },
    { today: "You showed Nova what you can do!", next: null },
    { today: null, next: "Next time: a mix of your skills" },
    { today: null, next: null },
    undefined,
  ])("renders only supplied progress lines between the title and stats: %s", (progress) => {
    const html = renderToStaticMarkup(<EndCard summary={{ problems: 7, firstTryCorrect: 5 }} progress={progress} onPlayAgain={() => {}} />);
    for (const key of ["today", "next"] as const) {
      const value = progress?.[key];
      if (value == null) expect(html).not.toContain(`data-testid="progress-${key}"`);
      else {
        expect(html).toContain(`data-testid="progress-${key}">${value}</p>`);
        expect(html.indexOf(value)).toBeGreaterThan(html.indexOf("</h1>"));
        expect(html.indexOf(value)).toBeLessThan(html.indexOf("7</span>"));
      }
    }
  });
  it("passes ended state progress through the screen", () => {
    play.state = { phase: "ended", summary: { problems: 1, firstTryCorrect: 1, minutes: 1, mastered: [] },
      progress: { today: "You practiced Counting.", next: "Next time: more Counting" } };
    const html = renderToStaticMarkup(<PlayScreen kidId="kid1" ageBand="5-7" />);
    expect(html).toContain('data-testid="progress-today">You practiced Counting.</p>');
    expect(html).toContain('data-testid="progress-next">Next time: more Counting</p>');
  });
  it("says well done with the counts", () => {
    expect(html).toContain('data-testid="end-card"');
    expect(text(html)).toContain("Great work today!");
    expect(text(html)).toContain("7 problems");
    expect(text(html)).toContain("5 right on the first try");
  });
  it("offers Play again and Back to kids", () => {
    expect(html).toMatch(/<button[^>]*>Play again<\/button>/);
    expect(html).toMatch(/<a[^>]*href="\/"[^>]*>Back to kids<\/a>/);
  });
  it("without rewards renders exactly as before (no strip)", () => {
    expect(html).not.toContain("rewards-strip");
    expect(html).toBe(renderToStaticMarkup(<EndCard summary={{ problems: 7, firstTryCorrect: 5 }} rewards={undefined} onPlayAgain={() => {}} />));
    // The card as it was before rewards existed, with CSS-module hashes normalised.
    expect(html.replace(/_([a-zA-Z]+)_[0-9a-z]+/g, "$1")).toBe(
      '<section class="endCard" data-testid="end-card" aria-labelledby="end-title"><h1 id="end-title" class="endTitle">Great work today!</h1>'
      + '<div class="endStats"><p class="endStat"><span class="endNumber">7</span> problems</p><p class="endStat"><span class="endNumber">5</span> right on the first try</p></div>'
      + '<div class="endActions"><button type="button" class="endButton">Play again</button><a class="endLink" href="/">Back to kids</a></div></section>',
    );
  });
  it("with rewards shows the strip after the counts", () => {
    const rewards = { xp: 60, levelBefore: 1, levelAfter: 1, cubesBefore: 0, cubesAfter: 1, newStickers: ["first-game"],
      week: { days: [false, true, false, false, false, false, false], played: 1, goalMet: false } };
    const withR = renderToStaticMarkup(<EndCard summary={{ problems: 7, firstTryCorrect: 5 }} rewards={rewards} onPlayAgain={() => {}} />);
    expect(withR).toContain('data-testid="rewards-strip"');
    expect(text(withR)).toMatch(/right on the first try.*\+60.*Play again/);
  });
  it("uses the singular for one problem", () => {
    const one = text(renderToStaticMarkup(<EndCard summary={{ problems: 1, firstTryCorrect: 1 }} onPlayAgain={() => {}} />));
    expect(one).toContain("1 problem");
    expect(one).not.toContain("1 problems");
  });
});

describe("ConnectionNotice", () => {
  it("while the turn load retries, the copy is neutral", () => {
    const html = renderToStaticMarkup(<ConnectionNotice offline={false} answering={false} onRetry={() => {}} />);
    expect(text(html)).toContain("Trying to reach Nova…");
    expect(text(html)).not.toContain("answer");
    expect(html).not.toContain("<button");
  });
  it("while an answer retries, says the answer is saved when it gets through, with no button", () => {
    const html = renderToStaticMarkup(<ConnectionNotice offline={false} answering onRetry={() => {}} />);
    expect(text(html)).toContain("Trying to reach Nova… your answer is saved when it gets through.");
    expect(html).not.toContain("<button");
    expect(html).toContain('data-testid="connection-notice"');
  });
  it("offline, offers Try again", () => {
    const html = renderToStaticMarkup(<ConnectionNotice offline answering={false} onRetry={() => {}} />);
    expect(text(html)).toContain("Nova can't connect right now.");
    expect(html).toMatch(/<button[^>]*>Try again<\/button>/);
  });
});

describe("LineBubble on the screen", () => {
  it("carries the nova-line test id and the tone", () => {
    const html = renderToStaticMarkup(<LineBubble say="Hi" tone="curious" ageBand="5-7" />);
    expect(html).toContain('data-testid="nova-line"');
    expect(html).toContain('data-tone="curious"');
  });
  it("shows a lead line above the line when given (reduced motion: no timed swap)", () => {
    const html = renderToStaticMarkup(<LineBubble lead="Yes!" say="Next one" ageBand="5-7" />);
    expect(text(html)).toMatch(/Yes!.*Next one/);
    expect(html).toContain("data-lead");
  });
});

describe("LineBubble note placement", () => {
  it("puts the note right after the lead (the feedback line), before the new line", () => {
    const t = text(renderToStaticMarkup(<LineBubble lead="4 more than 3 is 7." note="The answer is 7." say="Next one" ageBand="5-7" />));
    expect(t.indexOf("4 more than 3 is 7.")).toBeLessThan(t.indexOf("The answer is 7."));
    expect(t.indexOf("The answer is 7.")).toBeLessThan(t.indexOf("Next one"));
  });
});

describe("Board", () => {
  const problem = (prompt: { say: string; show: unknown }) =>
    ({ kind: "problem", mode: "practice", try: 1, prompt, input: "tap-choice", choices: [1, 2] }) as never;
  it("a story whose picture already prints the sentence keeps the h1 for screen readers only", () => {
    const say = "Mia has 3 apples and gets 2 more. How many now?";
    const html = renderToStaticMarkup(<Board problem={problem({ say, show: { kind: "story", text: say, icon: "apple", groups: [3, 2] } })} />);
    const h1 = /<h1[^>]*>/.exec(html)![0];
    expect(h1).toContain('data-testid="say"');
    expect(h1).toMatch(/class="[^"]*srOnly/);
    expect(html).not.toMatch(/display:\s*none/);
    expect(html.split(say).length - 1).toBe(2); // the SVG's lines are split, so: once in the h1, once in aria-label
  });
  it("any other picture shows the prompt h1 normally", () => {
    const html = renderToStaticMarkup(<Board problem={problem({ say: "How many?", show: { kind: "ten-frames", first: 3, second: 0 } })} />);
    const h1 = /<h1[^>]*>/.exec(html)![0];
    expect(h1).not.toMatch(/srOnly/);
    expect(html).toContain('role="img"');
  });
  it("a story with different text shows both", () => {
    const html = renderToStaticMarkup(<Board problem={problem({ say: "How many apples?", show: { kind: "story", text: "Mia has 3 apples.", icon: "apple" } })} />);
    expect(/<h1[^>]*>/.exec(html)![0]).not.toMatch(/srOnly/);
  });
});

describe("Help me next to Nova", () => {
  function screen(help: 0 | 1 | 2, phase: PlayState["phase"] = "problem") {
    play.state = { phase, version: 1, turn: { kind: "problem", mode: "practice", try: 1, help,
      prompt: { say: "How many?", show: { kind: "ten-frames", first: 3, second: 0 } },
      input: "tap-choice", choices: [1, 2] }, line: { say: "Count together.", tone: "calm" } };
    return renderToStaticMarkup(<PlayScreen kidId="kid1" ageBand="5-7" />);
  }
  it.each([0, 1] as const)("is a real button after the bubble at help %s", (help) => {
    const html = screen(help);
    const header = html.match(/<header[^>]*>(.*?)<\/header>/)![1]!;
    expect(header).toMatch(/<button[^>]*data-testid="help"[^>]*>Help me<\/button>/);
    expect(header.indexOf('data-testid="nova-line"')).toBeLessThan(header.indexOf('data-testid="help"'));
    expect(header.indexOf('data-testid="help"')).toBeLessThan(header.indexOf("I&#x27;m done for now"));
    expect(html.slice(html.indexOf('data-testid="tray"'))).not.toContain("Help me");
  });
  it("groups help and the Done link for the narrow-screen controls row", () => {
    const html = screen(0);
    expect(html).toMatch(/<div class="[^"]*topActions[^"]*"><button[^>]*data-testid="help"[^>]*>Help me<\/button><a[^>]*>I&#x27;m done for now<\/a><\/div>/);
  });
  it.each(["sending", "retrying", "offline"] as const)("is disabled while %s", (phase) => {
    expect(screen(0, phase)).toMatch(/<button[^>]*data-testid="help"[^>]*disabled=""[^>]*>Help me<\/button>/);
  });
  it.each(["help", "answer"] as const)("uses the %s retry notice while a problem is on screen", (request) => {
    screen(0, "retrying");
    play.state.request = request;
    const html = renderToStaticMarkup(<PlayScreen kidId="kid1" ageBand="5-7" />);
    const notice = text(html.match(/<div[^>]*data-testid="connection-notice"[^>]*>(.*?)<\/div>/)![1]!);
    expect(notice).toBe(request === "answer"
      ? "Trying to reach Nova… your answer is saved when it gets through."
      : "Trying to reach Nova…");
  });
  it("is absent at help 2, without a problem, and on the end card", () => {
    expect(screen(2)).not.toContain('data-testid="help"');
    play.state = { phase: "loading" };
    expect(renderToStaticMarkup(<PlayScreen kidId="kid1" ageBand="5-7" />)).not.toContain('data-testid="help"');
    play.state = { phase: "ended", turn: { kind: "end", summary: { problems: 1, firstTryCorrect: 0, minutes: 1, mastered: [] }, progress: { today: null, next: null } },
      summary: { problems: 1, firstTryCorrect: 0, minutes: 1, mastered: [] } };
    expect(renderToStaticMarkup(<PlayScreen kidId="kid1" ageBand="5-7" />)).not.toContain('data-testid="help"');
  });
});
