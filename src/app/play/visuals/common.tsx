import type { ReactNode } from "react";

export const W = 800;
export const H = 380;

export function Svg({ label, children }: { label: string; children: ReactNode }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={label}
    >
      {children}
    </svg>
  );
}

const r1 = (n: number) => Math.round(n * 10) / 10;

// A chalk "×" over a box centred on (cx, cy) with half-size h. Counted by data-cross on the group.
export function Cross({ cx, cy, h }: { cx: number; cy: number; h: number }) {
  const d = `M ${r1(cx - h)} ${r1(cy - h)} L ${r1(cx + h)} ${r1(cy + h)} M ${r1(cx - h)} ${r1(cy + h)} L ${r1(cx + h)} ${r1(cy - h)}`;
  return (
    <g data-cross="true">
      <path d={d} stroke="var(--ink)" strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d={d} stroke="var(--chalk)" strokeWidth="5" strokeLinecap="round" fill="none" />
    </g>
  );
}

export type Slot = { cx: number; cy: number; s: number; group: number; index: number; flat: number };

// Lay groups out left to right, each wrapping at 5 per row, centred in the band top..bottom.
export function layoutGroups(groups: number[], top: number, bottom: number): Slot[] {
  const GAP = 36;
  const MAXC = 5;
  const side = 40;
  const cols = groups.map((n) => Math.min(n, MAXC));
  const totalCols = cols.reduce((a, b) => a + b, 0);
  const rows = Math.max(1, ...groups.map((n) => Math.ceil(n / MAXC)));
  const gaps = GAP * Math.max(0, groups.length - 1);
  const cell = Math.max(10, Math.min(80, (W - 2 * side - gaps) / Math.max(1, totalCols), (bottom - top) / rows));
  const totalW = totalCols * cell + gaps;
  const x0 = (W - totalW) / 2;
  const y0 = top + (bottom - top - rows * cell) / 2;
  const out: Slot[] = [];
  let gx = x0;
  let flat = 0;
  groups.forEach((n, g) => {
    for (let i = 0; i < n; i++) {
      out.push({
        cx: r1(gx + (i % MAXC) * cell + cell / 2),
        cy: r1(y0 + Math.floor(i / MAXC) * cell + cell / 2),
        s: r1(cell * 0.84),
        group: g,
        index: i,
        flat: flat++,
      });
    }
    gx += (cols[g] ?? 0) * cell + GAP;
  });
  return out;
}
