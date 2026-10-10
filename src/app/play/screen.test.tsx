import { renderToStaticMarkup } from "react-dom/server";
import { EndCard } from "./EndCard";
import { ConnectionNotice } from "./ConnectionNotice";
import { LineBubble } from "./LineBubble";
import { Board } from "./Board";

const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

describe("EndCard", () => {
  const html = renderToStaticMarkup(<EndCard summary={{ problems: 7, firstTryCorrect: 5 }} onPlayAgain={() => {}} />);
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
