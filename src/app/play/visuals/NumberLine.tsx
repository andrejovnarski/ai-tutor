import type { Visual } from "@/domain/types";
import { Svg, W } from "./common";
import { describeVisual, labelStep } from "./describe";

const SIDE = 40;
const LINE_Y = 250;
const r1 = (n: number) => Math.round(n * 10) / 10;

export function NumberLine({ v }: { v: Extract<Visual, { kind: "number-line" }> }) {
  const span = Math.max(1, v.to - v.from);
  const x = (n: number) => r1(SIDE + ((Math.min(v.to, Math.max(v.from, n)) - v.from) / span) * (W - 2 * SIDE));
  const minor = span <= 20 ? 1 : 5;
  const labelEvery = labelStep(v.from, v.to);
  // Two-digit labels need a visible gap: about 1.1 em of digits inside each label pitch, less 10 units.
  const pitch = ((W - 2 * SIDE) / span) * labelEvery;
  const labelSize = span <= 20 ? Math.min(28, Math.floor((pitch - 10) / 1.1)) : 22;
  const ticks: number[] = [];
  for (let n = Math.ceil(v.from / minor) * minor; n <= v.to; n += minor) ticks.push(n);

  const j = v.jump;
  let jump = null;
  if (j && j.by !== 0) {
    const a = x(j.from);
    const b = x(j.from + j.by);
    const h = Math.min(100, 40 + Math.abs(b - a) / 3);
    const peak = LINE_Y - 30 - h;
    const ctl = LINE_Y - 30 - 2 * h;
    const dir = b >= a ? 1 : -1;
    jump = (
      <g data-jump="true">
        <path d={`M ${a} ${LINE_Y - 30} Q ${r1((a + b) / 2)} ${ctl} ${b} ${LINE_Y - 30}`} fill="none" stroke="var(--counter-yellow)" strokeWidth="5" strokeLinecap="round" />
        <path d={`M ${b} ${LINE_Y - 22} L ${r1(b - 9 * dir)} ${LINE_Y - 40} L ${r1(b + 1 * dir)} ${LINE_Y - 40} Z`} fill="var(--counter-yellow)" />
        <text data-label={`${j.by > 0 ? "+" : "−"}${Math.abs(j.by)}`} x={r1((a + b) / 2)} y={r1(peak - 12)} textAnchor="middle" fontSize="28" fill="var(--chalk)">
          {`${j.by > 0 ? "+" : "−"}${Math.abs(j.by)}`}
        </text>
      </g>
    );
  }
  return (
    <Svg label={describeVisual(v)}>
      <line x1={SIDE} y1={LINE_Y} x2={W - SIDE} y2={LINE_Y} stroke="var(--chalk)" strokeWidth="4" strokeLinecap="round" />
      {ticks.map((n) => {
        const major = n % labelEvery === 0;
        return (
          <g key={n}>
            <line data-tick={n} x1={x(n)} y1={LINE_Y - (major ? 14 : 8)} x2={x(n)} y2={LINE_Y + (major ? 14 : 8)} stroke="var(--chalk)" strokeWidth={major ? 4 : 2} />
            {major ? (
              <text data-label={n} x={x(n)} y={LINE_Y + 48} textAnchor="middle" fontSize={labelSize} fill="var(--chalk)">{n}</text>
            ) : null}
          </g>
        );
      })}
      {v.marks.map((m) => (
        <circle key={m} data-mark={m} cx={x(m)} cy={LINE_Y} r="13" fill="var(--counter-red)" stroke="var(--chalk)" strokeWidth="3" />
      ))}
      {jump}
    </Svg>
  );
}
