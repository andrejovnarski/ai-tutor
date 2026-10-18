import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { vi } from "vitest";
import { Cubes } from "./Cubes";
import { GrownupFrame } from "./GrownupFrame";
import { IndexCard } from "./IndexCard";
import { PinField } from "./PinField";

vi.mock("next/font/google", () => ({ Atkinson_Hyperlegible: () => ({ variable: "atk" }) }));

it("Cubes labels itself and fills the right count", () => {
  const html = renderToStaticMarkup(<Cubes filled={4} total={7} color="blue" label="Played 4 of the last 7 days" />);
  expect(html).toContain('role="img"'); expect(html).toContain('aria-label="Played 4 of the last 7 days"');
  expect(html.match(/data-filled="true"/g)).toHaveLength(4); expect(html.match(/data-cube/g)).toHaveLength(7);
});
it("Cubes caps at max and shows +N", () => {
  const html = renderToStaticMarkup(<Cubes filled={13} total={13} color="green" label="13 skills" max={10} />);
  expect(html.match(/data-cube/g)).toHaveLength(10); expect(html).toContain("+3");
});
it("GrownupFrame shows the strip and back link, or the big title when bare", () => {
  const strip = renderToStaticMarkup(<GrownupFrame back={{ href: "/", label: "Back to kids" }}><h1>X</h1></GrownupFrame>);
  expect(strip).toContain("For grown-ups"); expect(strip).toContain('href="/"'); expect(strip).toContain("Back to kids");
  const bare = renderToStaticMarkup(<GrownupFrame bare><h1>X</h1></GrownupFrame>);
  expect(bare).toContain("Brightling AI"); expect(bare).not.toContain("For grown-ups");
});
it("PinField keeps a labelled 4-digit numeric input", () => {
  const html = renderToStaticMarkup(<PinField name="pin" label="New PIN" />);
  expect(html).toContain("New PIN"); expect(html).toMatch(/inputmode="numeric"/i); expect(html).toMatch(/maxlength="4"/i);
});
it("IndexCard with href is one link", () => {
  const html = renderToStaticMarkup(<IndexCard color="#e4413b" href="/parent/kids/1">Mia</IndexCard>);
  expect(html.match(/<a /g)).toHaveLength(1); expect(html).toContain("#e4413b");
});

it("link colour rule does not override classed links", () => {
  const css = readFileSync(join(__dirname, "grownup.module.css"), "utf8");
  expect(css).not.toContain("!important");
  expect(css).not.toMatch(/\.frame a\s*\{/);
  expect(css).toMatch(/\.pinBox:focus-within\s*\{[^}]*outline: 3px solid var\(--link\)/);
});

it("strip focus ring is chalk, sticky tilts, details has a disclosure cue, bare antenna is dark", () => {
  const css = readFileSync(join(__dirname, "grownup.module.css"), "utf8");
  expect(css).toMatch(/\.strip :focus-visible\s*\{[^}]*outline-color: var\(--chalk\)/);
  expect(css).toMatch(/\.sticky\s*\{[^}]*transform: rotate\(-1\.2deg\)/);
  expect(css).toMatch(/\.details\[open\] > summary::after/);
  expect(css).toMatch(/\.bareHead \.novaAntenna\s*\{[^}]*var\(--felt-deep\)/);
});
