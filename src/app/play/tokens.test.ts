import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");
const palette = {
  sky: "#bfe9f5", "sky-deep": "#7fd3f0", sea: "#4fb6c9", "sea-deep": "#2f8aa0",
  sand: "#f6e3a8", grass: "#7cc36a", ink: "#12324a", white: "#ffffff",
  go: "#ff8a3d", sun: "#ffcf3d", nova: "#7a6cf0",
};
const tokens = Object.fromEntries([...css.matchAll(/--pp-([\w-]+):\s*(#[\da-f]{6})/gi)].map((m) => [m[1], m[2]]));
function luminance(hex: string) {
  const rgb = hex.slice(1).match(/../g)!.map((c) => parseInt(c, 16) / 255)
    .map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
}
describe("Pocket Planet tokens", () => {
  it.each(Object.entries(palette))("sets %s to the spec value", (name, hex) => {
    expect(tokens[name]).toBe(hex);
  });
  it.each(["sky", "sky-deep", "sand", "white", "go", "sun", "grass", "sea"])("ink on %s meets AA", (name) => {
    expect(tokens[name]).toBeDefined();
    expect(tokens.ink).toBeDefined();
    if (tokens[name] && tokens.ink) expect((luminance(tokens[name]) + 0.05) / (luminance(tokens.ink) + 0.05)).toBeGreaterThanOrEqual(4.5);
  });
});
