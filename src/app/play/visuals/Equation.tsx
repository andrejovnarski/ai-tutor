import type { Visual } from "@/domain/types";
import { Svg, W, H } from "./common";
import { describeVisual } from "./describe";

export function Equation({ v }: { v: Extract<Visual, { kind: "equation" }> }) {
  const long = v.text.length * 36 > W - 80;
  const wide = long ? W - 80 : v.text.length * 36;
  const box = { x0: (W - wide) / 2, y0: H / 2 + 22 - 50, x1: (W + wide) / 2, y1: H / 2 + 22 + 16 };
  return (
    <Svg label={describeVisual(v)} box={box}>
      <text
        x={W / 2}
        y={H / 2 + 22}
        textAnchor="middle"
        fontSize="64"
        fill="var(--pp-ink)"
        {...(long ? { textLength: W - 80, lengthAdjust: "spacingAndGlyphs" } : {})}
      >
        {v.text}
      </text>
    </Svg>
  );
}
