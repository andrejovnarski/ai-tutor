import { renderToStaticMarkup } from "react-dom/server";
import { Nova } from "./Nova";
import { LineBubble } from "./LineBubble";

function eyes(html: string): string {
  return [...html.matchAll(/data-eye="[^"]*"[^>]*\sd="([^"]*)"/g)].map((m) => m[1]).join("|");
}

describe("Nova", () => {
  it("is an accessible image", () => {
    const html = renderToStaticMarkup(<Nova tone="cheer" />);
    expect(html).toContain('aria-label="Nova"');
    expect(html).toContain('role="img"');
  });
  it("draws different eyes per tone", () => {
    const a = eyes(renderToStaticMarkup(<Nova tone="cheer" />));
    const b = eyes(renderToStaticMarkup(<Nova tone="calm" />));
    const c = eyes(renderToStaticMarkup(<Nova tone="curious" />));
    expect(a).not.toBe("");
    expect(new Set([a, b, c]).size).toBe(3);
  });
  it("hops only when asked", () => {
    expect(renderToStaticMarkup(<Nova tone="cheer" hop />)).toContain('data-hop="true"');
    expect(renderToStaticMarkup(<Nova tone="cheer" />)).not.toContain('data-hop="true"');
  });
});

describe("LineBubble", () => {
  it("renders the line as a polite status", () => {
    const html = renderToStaticMarkup(<LineBubble say="Nice one!" ageBand="5-7" />);
    expect(html).toContain("Nice one!");
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain("data-note");
  });
  it("renders the note when given", () => {
    const html = renderToStaticMarkup(<LineBubble say="Hm" note="It was 7." ageBand="8-11" />);
    expect(html).toContain("It was 7.");
    expect(html).toContain("data-note");
  });
  it("sizes text by age band", () => {
    expect(renderToStaticMarkup(<LineBubble say="x" ageBand="5-7" />)).toContain("font-size:28px");
    expect(renderToStaticMarkup(<LineBubble say="x" ageBand="8-11" />)).toContain("font-size:22px");
  });
});
