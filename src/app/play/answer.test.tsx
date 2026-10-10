import { renderToStaticMarkup } from "react-dom/server";
import { padReducer } from "./numberPad";
import { AnswerTray } from "./AnswerTray";
import { NumberPad } from "./NumberPad";

function run(keys: Parameters<typeof padReducer>[1][]) {
  let entry = "";
  let submit: number | undefined;
  for (const k of keys) {
    const r = padReducer(entry, k);
    entry = r.entry;
    submit = r.submit;
  }
  return { entry, submit };
}

describe("padReducer", () => {
  it("caps at 3 digits", () => {
    expect(run(["1", "2", "3", "4"]).entry).toBe("123");
  });
  it("deletes the last digit", () => {
    expect(run(["1", "2", "3", "del"]).entry).toBe("12");
  });
  it("submits and resets on ok", () => {
    expect(padReducer("12", "ok")).toEqual({ entry: "", submit: 12 });
  });
  it("ok and del on empty do nothing", () => {
    expect(padReducer("", "ok")).toEqual({ entry: "" });
    expect(padReducer("", "del")).toEqual({ entry: "" });
  });
  it("replaces a leading zero", () => {
    expect(run(["0", "7"]).entry).toBe("7");
  });
});

const buttons = (html: string) => html.match(/<button\b[^>]*>/g) ?? [];

describe("AnswerTray", () => {
  it("renders one labelled button per choice", () => {
    const html = renderToStaticMarkup(
      <AnswerTray input="tap-choice" choices={[3, 5, 7, 9]} locked={false} onAnswer={() => {}} />,
    );
    expect(buttons(html)).toHaveLength(4);
    expect(html).toContain('data-testid="choices"');
    for (const n of [3, 5, 7, 9]) expect(html).toContain(`>${n}</button>`);
  });
  it("disables everything when locked", () => {
    const html = renderToStaticMarkup(
      <AnswerTray input="tap-choice" choices={[1, 2]} locked onAnswer={() => {}} />,
    );
    expect(buttons(html).every((b) => b.includes("disabled"))).toBe(true);
    const pad = renderToStaticMarkup(<AnswerTray input="number-pad" locked onAnswer={() => {}} />);
    expect(buttons(pad).every((b) => b.includes("disabled"))).toBe(true);
  });
  it("renders the number pad for number-pad input", () => {
    const html = renderToStaticMarkup(
      <AnswerTray input="number-pad" locked={false} onAnswer={() => {}} />,
    );
    expect(html).toContain('data-testid="number-pad"');
    expect(buttons(html)).toHaveLength(12);
  });
  it("shows the pad for number-pad input even when choices exist (ages 8-11 keep the choices)", () => {
    const html = renderToStaticMarkup(
      <AnswerTray input="number-pad" choices={[12, 15, 21]} locked={false} onAnswer={() => {}} />,
    );
    expect(html).toContain('data-testid="number-pad"');
    expect(html).not.toContain('data-testid="choices"');
  });
  it("falls back to the pad for tap-choice with no or empty choices", () => {
    for (const choices of [undefined, []]) {
      const html = renderToStaticMarkup(<AnswerTray input="tap-choice" choices={choices} locked={false} onAnswer={() => {}} />);
      expect(html).toContain('data-testid="number-pad"');
      expect(html).not.toContain('data-testid="choices"');
    }
  });
  it("shows tiles for voice input with choices", () => {
    const html = renderToStaticMarkup(
      <AnswerTray input="voice" choices={[2, 4]} locked={false} onAnswer={() => {}} />,
    );
    expect(html).toContain('data-testid="choices"');
    expect(html).not.toContain('data-testid="number-pad"');
  });
  it("shows the pad for voice input without choices", () => {
    const html = renderToStaticMarkup(<AnswerTray input="voice" locked={false} onAnswer={() => {}} />);
    expect(html).toContain('data-testid="number-pad"');
  });
});

describe("NumberPad", () => {
  const html = renderToStaticMarkup(<NumberPad locked={false} onAnswer={() => {}} />);
  it("has 12 buttons with an accessible Delete", () => {
    expect(buttons(html)).toHaveLength(12);
    expect(html).toContain('aria-label="Delete"');
    expect(html).toContain("⌫");
  });
  it("keeps OK disabled while the entry is empty", () => {
    const ok = buttons(html).find((b) => b.includes('data-key="ok"'))!;
    expect(ok).toContain("disabled");
    const others = buttons(html).filter((b) => !b.includes('data-key="ok"') && !b.includes('data-key="del"'));
    expect(others.some((b) => b.includes("disabled"))).toBe(false);
  });
});
