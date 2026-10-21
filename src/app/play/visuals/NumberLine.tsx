import type { Visual } from "@/domain/types";
import { Svg, W, type Box } from "./common";
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
  const labelSize = span <= 20 ? Math.min(28, Math.floor((pitch - 10) / 1.1)) : 30;
  const ticks: number[] = [];
  for (let n = Math.ceil(v.from / minor) * minor; n <= v.to; n += minor) ticks.push(n);

  const j = v.jump;
  let jump = null;
  let top = LINE_Y - 16; // a mark's ring
  if (j && j.by !== 0) {
    const a = x(j.from);
    const b = x(j.from + j.by);
    const dx = Math.abs(b - a);
    // A hop: leaves straight up from the start, lands straight down on the answer's tick.
    const y0 = LINE_Y - 20; // just clear of a mark's ring and the tick tops
    const h = Math.min(80, Math.max(34, 20 + dx * 0.3));
    const k = r1((4 / 3) * h); // cubic handles this tall peak at exactly h
    const tip = LINE_Y - 18;
    const head = 22;
    const wing = Math.min(13, Math.max(9, dx / 3)); // half the arrowhead's width
    const end = tip - head + 6; // the stroke ends inside the head
    const hi = Math.min(y0, end) - k; // both handles at one height so the peak sits in the middle
    const hop = `M ${a} ${y0} C ${a} ${r1(hi)} ${b} ${r1(hi)} ${b} ${end}`;
    const peak = r1(Math.min(y0, end) - h);
    const sign = `${j.by > 0 ? "+" : "−"}${Math.abs(j.by)}`;
    const chipW = r1(sign.length * 15 + 22);
    const chipH = 36;
    const chipY = r1(peak - 10 - chipH);
    top = chipY;
    jump = (
      <g data-jump="true">
        {/* ink casing so the yellow hop reads on the light sand board */}
        <path d={hop} fill="none" stroke="var(--pp-ink)" strokeWidth="10" strokeLinecap="round" />
        <path d={hop} fill="none" stroke="var(--counter-yellow)" strokeWidth="5" strokeLinecap="round" />
        <path d={`M ${b} ${tip} L ${r1(b - wing)} ${tip - head} L ${r1(b + wing)} ${tip - head} Z`} fill="var(--counter-yellow)" stroke="var(--pp-ink)" strokeWidth="3" strokeLinejoin="round" />
        <rect x={r1((a + b) / 2 - chipW / 2)} y={chipY} width={chipW} height={chipH} rx="18" fill="var(--pp-white)" stroke="var(--pp-ink)" strokeWidth="3" />
        <text data-label={sign} x={r1((a + b) / 2)} y={r1(chipY + chipH / 2 + 9)} textAnchor="middle" fontSize="26" fontWeight="700" fill="var(--pp-ink)">
          {sign}
        </text>
      </g>
    );
  }
  // Labels are centred on their tick: half of the widest label's digits overhangs each end.
  const half = (String(Math.max(Math.abs(v.from), Math.abs(v.to))).length * 0.6 * labelSize) / 2;
  const box: Box = { x0: SIDE - half, y0: top, x1: W - SIDE + half, y1: LINE_Y + 48 + 6 };
  return (
    <Svg label={describeVisual(v)} box={box}>
      <line x1={SIDE} y1={LINE_Y} x2={W - SIDE} y2={LINE_Y} stroke="var(--pp-ink)" strokeWidth="4" strokeLinecap="round" />
      {ticks.map((n) => {
        const major = n % labelEvery === 0;
        return (
          <g key={n}>
            <line data-tick={n} x1={x(n)} y1={LINE_Y - (major ? 14 : 8)} x2={x(n)} y2={LINE_Y + (major ? 14 : 8)} stroke="var(--pp-ink)" strokeWidth={major ? 4 : 2} />
            {major ? (
              <text data-label={n} x={x(n)} y={LINE_Y + 48} textAnchor="middle" fontSize={labelSize} fill="var(--pp-ink)">{n}</text>
            ) : null}
          </g>
        );
      })}
      {v.marks.map((m) => (
        <circle key={m} data-mark={m} cx={x(m)} cy={LINE_Y} r="13" fill="var(--counter-red)" stroke="var(--pp-ink)" strokeWidth="3" />
      ))}
      {jump}
    </Svg>
  );
}
