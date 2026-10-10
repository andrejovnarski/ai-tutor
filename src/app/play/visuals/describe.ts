import type { Icon, Visual } from "@/domain/types";

const PLURAL: Record<Icon, [string, string]> = {
  apple: ["apple", "apples"], star: ["star", "stars"], fish: ["fish", "fish"], ball: ["ball", "balls"],
  duck: ["duck", "ducks"], shell: ["shell", "shells"], block: ["block", "blocks"], cookie: ["cookie", "cookies"],
};
const noun = (icon: Icon, n: number) => `${n} ${PLURAL[icon][n === 1 ? 0 : 1]}`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Numbers between ticks that get a printed label on a number line.
export function labelStep(from: number, to: number): number {
  return to - from <= 20 ? 1 : 10;
}

function join(parts: string[]): string {
  return parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

// Plain words for what is drawn. It never states a result the picture does not show.
export function describeVisual(v: Visual): string {
  switch (v.kind) {
    case "objects": {
      const base = join(v.groups.map((n) => noun(v.icon, n)));
      return v.crossedOut ? `${base}, ${v.crossedOut} crossed out` : base;
    }
    case "ten-frames": {
      const frames = v.first + v.second > 10 ? "two ten-frames" : "one ten-frame";
      const parts = [plural(v.first, "red counter", "red counters")];
      if (v.second > 0) parts.push(plural(v.second, "yellow counter", "yellow counters"));
      const base = `${join(parts)} in ${frames}`;
      return v.crossedOut ? `${base}, ${v.crossedOut} crossed out` : base;
    }
    case "number-line": {
      let s = `Number line from ${v.from} to ${v.to}`;
      if (v.marks.length) s += `, with ${v.marks.length === 1 ? "a dot" : "dots"} at ${join(v.marks.map(String))}`;
      const j = v.jump;
      if (j && j.by !== 0) {
        const land = j.from + j.by;
        const shown = land >= v.from && land <= v.to && land % labelStep(v.from, v.to) === 0;
        s += `, and a jump ${j.by > 0 ? "forward" : "back"} ${Math.abs(j.by)} from ${j.from}`;
        if (shown) s += `, landing on ${land}`;
      }
      return s;
    }
    case "blocks": {
      const g = v.groups.map((x) => `${plural(x.tens, "ten rod", "ten rods")} and ${plural(x.ones, "single cube", "single cubes")}`);
      let s = g.length === 1 ? g[0]! : g.map((t, i) => `group ${i + 1}: ${t}`).join("; ");
      const c = v.crossedOut;
      if (c && (c.tens || c.ones)) {
        const bits: string[] = [];
        if (c.tens) bits.push(plural(c.tens, "ten rod", "ten rods"));
        if (c.ones) bits.push(plural(c.ones, "single cube", "single cubes"));
        s += `, ${join(bits)} crossed out`;
        if (c.ones > (v.groups[0]?.ones ?? 0)) s += ", with one ten rod broken into single cubes";
      }
      return s;
    }
    case "equation":
      return `Equation: ${v.text}`;
    case "story": {
      const pic = v.groups?.length ? `. ${join(v.groups.map((n) => noun(v.icon, n)))}${v.crossedOut ? `, ${v.crossedOut} crossed out` : ""}` : "";
      return `${v.text}${pic}`;
    }
  }
}
