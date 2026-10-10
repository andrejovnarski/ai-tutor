import type { Visual } from "@/domain/types";
import { Svg, W, H } from "./common";
import { describeVisual } from "./describe";

export function Equation({ v }: { v: Extract<Visual, { kind: "equation" }> }) {
  const long = v.text.length * 36 > W - 80;
  return (
    <Svg label={describeVisual(v)}>
      <text
        x={W / 2}
        y={H / 2 + 22}
        textAnchor="middle"
        fontSize="64"
        fill="var(--chalk)"
        {...(long ? { textLength: W - 80, lengthAdjust: "spacingAndGlyphs" } : {})}
      >
        {v.text}
      </text>
    </Svg>
  );
}
