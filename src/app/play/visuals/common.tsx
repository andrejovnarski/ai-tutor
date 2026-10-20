import type { ReactNode } from "react";

export const W = 800;
export const H = 380;

const r1 = (n: number) => Math.round(n * 10) / 10;

/** What a picture actually covers, in the W x H drawing space. */
export type Box = { x0: number; y0: number; x1: number; y1: number };

// The viewBox crops to the drawing plus a margin, so the picture fills the board instead of shrinking with the empty
// canvas around it. The crop is never shorter than MIN_H, so three apples don't grow to fill a whole tablet.
const PAD = 24;
const MIN_H = 200;
const MIN_W = 240;

export function cropTo(b: Box): string {
  let x = b.x0 - PAD;
  let y = b.y0 - PAD;
  let w = b.x1 - b.x0 + 2 * PAD;
  let h = b.y1 - b.y0 + 2 * PAD;
  if (h < MIN_H) { y -= (MIN_H - h) / 2; h = MIN_H; }
  if (w < MIN_W) { x -= (MIN_W - w) / 2; w = MIN_W; }
  return [x, y, w, h].map(r1).join(" ");
}

export function Svg({ label, box, children }: { label: string; box?: Box; children: ReactNode }) {
  return (
    <svg
      viewBox={box ? cropTo(box) : `0 0 ${W} ${H}`}
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

// A chalk "×" over a box centred on (cx, cy) with half-size h. Counted by data-cross on the group.
export function Cross({ cx, cy, h }: { cx: number; cy: number; h: number }) {
  const d = `M ${r1(cx - h)} ${r1(cy - h)} L ${r1(cx + h)} ${r1(cy + h)} M ${r1(cx - h)} ${r1(cy + h)} L ${r1(cx + h)} ${r1(cy - h)}`;
  return (
    <g data-cross="true" data-cx={r1(cx)} data-cy={r1(cy)}>
      <path d={d} stroke="var(--pp-white)" strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d={d} stroke="var(--pp-ink)" strokeWidth="5" strokeLinecap="round" fill="none" />
    </g>
  );
}

/** The box around icon slots (each icon stays inside ±s/2 of its centre). */
export function slotsBox(slots: Slot[]): Box | undefined {
  if (!slots.length) return undefined;
  return {
    x0: Math.min(...slots.map((s) => s.cx - s.s / 2)),
    y0: Math.min(...slots.map((s) => s.cy - s.s / 2)),
    x1: Math.max(...slots.map((s) => s.cx + s.s / 2)),
    y1: Math.max(...slots.map((s) => s.cy + s.s / 2)),
  };
}

export type Slot ={ cx: number; cy: number; s: number; group: number; index: number; flat: number };

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
