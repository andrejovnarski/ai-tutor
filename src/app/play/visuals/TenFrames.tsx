import type { Visual } from "@/domain/types";
import { Svg, Cross, W, H } from "./common";
import { describeVisual } from "./describe";

const CELL = 60;
const FW = CELL * 5;
const FH = CELL * 2;
const FGAP = 40;

export function TenFrames({ v }: { v: Extract<Visual, { kind: "ten-frames" }> }) {
  const filled = v.first + v.second;
  const nf = filled > 10 ? 2 : 1;
  const x0 = (W - (nf * FW + (nf - 1) * FGAP)) / 2;
  const y0 = (H - FH) / 2;
  const crossedFrom = filled - Math.min(v.crossedOut ?? 0, filled);
  const cells = [];
  for (let i = 0; i < nf * 10; i++) {
    const f = Math.floor(i / 10);
    const pos = i % 10;
    const x = x0 + f * (FW + FGAP) + (pos % 5) * CELL;
    const y = y0 + Math.floor(pos / 5) * CELL;
    if (i >= filled) {
      cells.push(
        <rect key={i} data-empty="true" x={x + 4} y={y + 4} width={CELL - 8} height={CELL - 8} rx="8"
          fill="none" stroke="var(--chalk)" strokeOpacity="0.45" strokeWidth="2" strokeDasharray="4 6" />,
      );
    } else {
      cells.push(
        <g key={i}>
          <circle data-counter={i < v.first ? "red" : "yellow"} cx={x + CELL / 2} cy={y + CELL / 2} r="24"
            fill={i < v.first ? "var(--counter-red)" : "var(--counter-yellow)"} stroke="var(--felt-deep)" strokeWidth="2" />
          {i >= crossedFrom ? <Cross cx={x + CELL / 2} cy={y + CELL / 2} h={14} /> : null}
        </g>,
      );
    }
  }
  return (
    <Svg label={describeVisual(v)}>
      {Array.from({ length: nf }, (_, f) => {
        const fx = x0 + f * (FW + FGAP);
        return (
          <g key={f}>
            <rect data-frame="true" x={fx} y={y0} width={FW} height={FH} rx="10" fill="var(--felt-deep)" stroke="var(--chalk)" strokeWidth="3" />
            {[1, 2, 3, 4].map((c) => (
              <line key={c} x1={fx + c * CELL} y1={y0} x2={fx + c * CELL} y2={y0 + FH} stroke="var(--chalk)" strokeWidth="2" strokeOpacity="0.6" />
            ))}
            <line x1={fx} y1={y0 + CELL} x2={fx + FW} y2={y0 + CELL} stroke="var(--chalk)" strokeWidth="2" strokeOpacity="0.6" />
          </g>
        );
      })}
      {cells}
    </Svg>
  );
}
