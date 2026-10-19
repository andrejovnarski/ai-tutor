import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import type { EndRewards } from "@/domain/rewards/progress";
import { RewardsStrip } from "../play/RewardsStrip";
import { Rod } from "./Rod";
import { WeekDots } from "./WeekDots";
import { StickerArt } from "./StickerArt";

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

const base: EndRewards = {
  xp: 215, levelBefore: 3, levelAfter: 3, cubesBefore: 2, cubesAfter: 6, newStickers: [],
  week: { days: [true, true, false, false, false, false, false], played: 2, goalMet: false },
};
const strip = (r: Partial<EndRewards>) => renderToStaticMarkup(<RewardsStrip rewards={{ ...base, ...r }} />);

describe("RewardsStrip", () => {
  it("strip shows XP, rod and week", () => {
    const html = strip({});
    expect(text(html)).toContain("+215");
    expect(html).toContain('aria-label="6 of 10 cubes"');
    expect(html).toContain('aria-label="Played 2 days this week"');
    expect(text(html)).toContain("1 more day for your week goal");
    expect(text(html)).not.toMatch(/Level \d+!/);
  });
  it("week line counts the days still to go, or says the goal is done", () => {
    const days = (n: number) => Array.from({ length: 7 }, (_, i) => i < n);
    expect(text(strip({ week: { days: days(0), played: 0, goalMet: false } }))).toContain("3 more days for your week goal");
    expect(text(strip({ week: { days: days(1), played: 1, goalMet: false } }))).toContain("2 more days for your week goal");
    expect(text(strip({ week: { days: days(3), played: 3, goalMet: true } }))).toContain("Week goal done!");
    expect(text(strip({ week: { days: days(5), played: 5, goalMet: true } }))).toContain("Week goal done!");
  });
  it("level up shows Level N! with a full rod beside the new one", () => {
    const html = strip({ levelBefore: 3, levelAfter: 4, cubesBefore: 8, cubesAfter: 1 });
    expect(text(html)).toContain("Level 4!");
    expect(html).toContain('aria-label="10 of 10 cubes"');
    expect(html).toContain('aria-label="1 of 10 cubes"');
  });
  it("no new stickers shows no sticker list", () => {
    expect(strip({})).not.toContain('data-sticker');
  });
  it("at most 3 stickers then +N more", () => {
    const html = strip({ newStickers: ["first-game", "weeks:1", "tries:10", "tries:50", "weeks:4"] });
    expect((html.match(/data-sticker=/g) ?? []).length).toBe(3);
    const t = text(html);
    expect(t).toContain("First game");
    expect(t).toContain("1 great week");
    expect(t).toContain("Kept trying 10 times");
    expect(t).not.toContain("Kept trying 50 times");
    expect(t).toContain("+2 more");
  });
  it("skips an unknown sticker id", () => {
    const html = strip({ newStickers: ["no-such-sticker", "first-game"] });
    expect((html.match(/data-sticker=/g) ?? []).length).toBe(1);
    expect(text(html)).not.toMatch(/\+\d+ more/);
  });
  it("no reward copy talks about losing or playing more", () => {
    const states: Partial<EndRewards>[] = [
      {},
      { levelAfter: 4, cubesBefore: 9, cubesAfter: 0 },
      { newStickers: ["first-game", "weeks:1", "tries:10", "tries:50"] },
      { week: { days: [false, false, false, false, false, false, false], played: 0, goalMet: false } },
      { week: { days: [true, false, true, false, true, false, false], played: 3, goalMet: true } },
      { xp: 0, cubesBefore: 0, cubesAfter: 0 },
    ];
    for (const s of states) {
      expect(text(strip(s))).not.toMatch(/\b(lose|lost|miss|break|broke|one more problem|keep playing)\b/i);
    }
  });
});

describe("Rod", () => {
  it("draws 10 cubes, filled ones marked, with an image label", () => {
    const html = renderToStaticMarkup(<Rod filled={6} size="m" />);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="6 of 10 cubes"');
    expect((html.match(/data-cube=/g) ?? []).length).toBe(10);
    expect((html.match(/data-cube="filled"/g) ?? []).length).toBe(6);
  });
  it("only the newly earned cubes drop in", () => {
    const html = renderToStaticMarkup(<Rod filled={6} animateFrom={2} size="m" />);
    expect((html.match(/data-drop="true"/g) ?? []).length).toBe(4);
    expect(renderToStaticMarkup(<Rod filled={6} size="s" />)).not.toContain("data-drop");
  });
  it("keeps the count inside the rod", () => {
    expect(renderToStaticMarkup(<Rod filled={14} size="s" />)).toContain('aria-label="10 of 10 cubes"');
    expect(renderToStaticMarkup(<Rod filled={-2} size="s" />)).toContain('aria-label="0 of 10 cubes"');
  });
});

describe("WeekDots", () => {
  it("draws 7 dots and says how many days were played", () => {
    const html = renderToStaticMarkup(<WeekDots days={[false, true, false, false, false, false, false]} size="s" />);
    expect((html.match(/data-day=/g) ?? []).length).toBe(7);
    expect((html.match(/data-day="played"/g) ?? []).length).toBe(1);
    expect(html).toContain('aria-label="Played 1 day this week"');
  });
});

describe("StickerArt", () => {
  it("draws every art kind as a hidden picture", () => {
    for (const art of ["star", "counters", "ten-frame", "number-line", "rod", "calendar", "pencil"] as const) {
      const html = renderToStaticMarkup(<StickerArt art={art} size={72} />);
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('width="72"');
      expect(html).toContain(`data-art="${art}"`);
    }
  });
});

describe("StickerArt colours", () => {
  it("only maths stickers use counter colours", () => {
    for (const art of ["star", "pencil", "calendar"] as const) {
      expect(renderToStaticMarkup(<StickerArt art={art} size={72} />)).not.toContain("--counter-");
    }
  });
});

describe("end card layout guards", () => {
  const css = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8");
  const rule = (src: string, sel: string) => src.match(new RegExp(`\\${sel} \\{([^}]*)\\}`))?.[1] ?? "";
  it("the counts-and-strip row wraps instead of scrolling sideways", () => {
    expect(rule(css("../play/play.module.css"), ".endBody")).toMatch(/flex-wrap:\s*wrap/);
    expect(rule(css("./rewards.module.css"), ".stickerRow")).toMatch(/flex-wrap:\s*wrap/);
  });
  it("safe centring keeps a plain centre fallback before it", () => {
    expect(rule(css("../play/play.module.css"), ".endArea")).toMatch(/align-items:\s*center;[^]*align-items:\s*safe center;/);
  });
  it("sticker labels break only an overlong word", () => {
    const label = rule(css("./rewards.module.css"), ".stickerLabel");
    expect(label).toMatch(/overflow-wrap:\s*break-word/);
    expect(label).not.toContain("anywhere");
  });
});
