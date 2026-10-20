import type { Visual } from "@/domain/types";
import { Svg, W, H } from "./common";
import { IconRows } from "./Objects";
import { describeVisual } from "./describe";

const MAX_CHARS = 46;
const LINE = 36;

function wrap(text: string): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (cur && (cur + " " + word).length > MAX_CHARS) { lines.push(cur); cur = word; }
    else cur = cur ? cur + " " + word : word;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function Story({ v }: { v: Extract<Visual, { kind: "story" }> }) {
  const lines = wrap(v.text).slice(0, 4);
  const groups = v.groups ?? [];
  const hasPic = groups.some((n) => n > 0);
  const firstY = hasPic ? 52 : (H - (lines.length - 1) * LINE) / 2;
  const picTop = 52 + (lines.length - 1) * LINE + 24;
  const crossedFrom = groups.reduce((a, b) => a + b, 0) - Math.min(v.crossedOut ?? 0, groups.reduce((a, b) => a + b, 0));
  return (
    <Svg label={describeVisual(v)}>
      <text x={W / 2} y={firstY} textAnchor="middle" fontSize="28" fill="var(--pp-ink)" data-story-text="true">
        {lines.map((l, i) => (
          <tspan key={i} x={W / 2} dy={i ? LINE : 0}>{l}</tspan>
        ))}
      </text>
      {hasPic ? (
        <IconRows icon={v.icon} groups={groups} top={picTop} bottom={H - 16} crossed={(s) => s.flat >= crossedFrom} />
      ) : null}
    </Svg>
  );
}
