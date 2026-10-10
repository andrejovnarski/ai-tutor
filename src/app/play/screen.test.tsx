import { renderToStaticMarkup } from "react-dom/server";
import { EndCard } from "./EndCard";
import { ConnectionNotice } from "./ConnectionNotice";
import { LineBubble } from "./LineBubble";

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
  it("while retrying, says the answer is saved when it gets through, with no button", () => {
    const html = renderToStaticMarkup(<ConnectionNotice offline={false} onRetry={() => {}} />);
    expect(text(html)).toContain("Trying to reach Nova… your answer is saved when it gets through.");
    expect(html).not.toContain("<button");
    expect(html).toContain('data-testid="connection-notice"');
  });
  it("offline, offers Try again", () => {
    const html = renderToStaticMarkup(<ConnectionNotice offline onRetry={() => {}} />);
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
