import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { CLUSTERS, SKILLS } from "@/domain/curriculum";
import { islandMap } from "@/domain/rewards/map";
import { IslandMap } from "./IslandMap";

const up = CLUSTERS.slice(0, 2).flatMap(c => c.skills.map(s => s.id)).concat(CLUSTERS[2]!.skills.slice(0, 3).map(s => s.id));
const map = islandMap({}, new Set(up), [up[0]!]);
it("labels progress, draws every flag and names the current island only in full size", () => {
  const full = renderToStaticMarkup(<IslandMap map={map} size="full" />);
  expect(full).toContain('role="img"');
  expect(full).toContain('aria-label="Map: 2 islands done. Now on Adding Island, 3 of 5 flags."');
  expect(full).toContain('viewBox="0 0 400 160"');
  expect(full).toMatch(/<figcaption[^>]*>Adding Island<\/figcaption>/);
  expect((full.match(/data-flag=/g) ?? [])).toHaveLength(33);
  expect((full.match(/data-new="true"/g) ?? [])).toHaveLength(1);
  const mini = renderToStaticMarkup(<IslandMap map={map} size="mini" />);
  expect(mini).not.toContain('<text');
  expect(mini).not.toContain('<figcaption');
  expect(mini).not.toMatch(/data-rise|data-sail/);
  expect(full).not.toMatch(/data-rise|data-sail/);
});
it("labels a finished map and keeps a boat", () => {
  const html = renderToStaticMarkup(<IslandMap map={islandMap({}, new Set(SKILLS.map(s => s.id)), [])} size="full" />);
  expect(html).toContain('aria-label="Map: all islands done!"');
  expect(html).toContain('data-boat');
  expect(html).not.toContain('<figcaption');
});
it("animates only new flags, then the boat, with a reduced-motion still state", () => {
  const html = renderToStaticMarkup(<IslandMap map={map} size="full" animate />);
  expect((html.match(/data-rise="true"/g) ?? [])).toHaveLength(1);
  expect(html).toContain('data-sail="true"');
  const css = readFileSync(new URL('./rewards.module.css', import.meta.url), 'utf8');
  expect(css).toMatch(/@media\s*\(prefers-reduced-motion: reduce\)[\s\S]*\.flagRise[\s\S]*\.boatSail[\s\S]*animation:\s*none/);
});

it("says one island, not one islands", () => {
  const counting = ["count-to-20.objects-to-10", "count-to-20.objects-to-20", "count-to-20.number-after"];
  const html = renderToStaticMarkup(<IslandMap map={islandMap(Object.fromEntries(counting.map((id) => [id, 1])), new Set(), [])} size="mini" />);
  expect(html).toContain('aria-label="Map: 1 island done. Now on Compare Cliffs, 0 of 3 flags."');
});

it("keeps the HTML island caption at the phone reading floor while the art can shrink", () => {
  const css = readFileSync(new URL("./rewards.module.css", import.meta.url), "utf8");
  expect(css).toMatch(/\.mapCaption\s*\{[^}]*font-size:\s*22px/);
  expect(css).toMatch(/\.mapHero \.mapFull\s*\{[^}]*min-height:\s*140px/);
});

it("sets a 90px map floor on smaller screens", () => {
  const css = readFileSync(new URL("./rewards.module.css", import.meta.url), "utf8");
  expect(css).toMatch(/@media \(max-width: 700px\)[\s\S]*?\.mapHero \.mapFull\s*\{[^}]*min-height:\s*90px/);
});
