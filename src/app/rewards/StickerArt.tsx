import type { ReactNode } from "react";
import type { StickerArt as Art } from "@/domain/rewards/stickers";

// Drawn in a 100 x 100 box on a tray disc, in the maths-picture family: counters with felt-deep strokes, cube-blue
// cubes, ink outlines (the disc is tray, so lines are ink rather than chalk).
const INK = "var(--ink)";

function Star() {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 13 : 31;
    return `${(50 + r * Math.cos(a)).toFixed(1)},${(52 + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
  return <polygon points={pts} fill="var(--counter-yellow)" stroke={INK} strokeWidth="3" strokeLinejoin="round" />;
}

function Counter({ cx, cy, r, color }: { cx: number; cy: number; r: number; color: "red" | "yellow" }) {
  return <circle cx={cx} cy={cy} r={r} fill={`var(--counter-${color})`} stroke="var(--felt-deep)" strokeWidth="2.5" />;
}

function Counters() {
  return (
    <>
      <Counter cx={50} cy={35} r={13} color="red" />
      <Counter cx={34} cy={62} r={13} color="yellow" />
      <Counter cx={66} cy={62} r={13} color="red" />
    </>
  );
}

function TenFrame() {
  const cell = 12.8;
  const x0 = 18;
  const y0 = 37;
  return (
    <>
      <rect x={x0} y={y0} width={cell * 5} height={cell * 2} rx="3" fill="var(--felt-deep)" stroke={INK} strokeWidth="2.5" />
      {[1, 2, 3, 4].map((c) => (
        <line key={c} x1={x0 + c * cell} y1={y0} x2={x0 + c * cell} y2={y0 + cell * 2} stroke="var(--chalk)" strokeWidth="1.2" strokeOpacity="0.7" />
      ))}
      <line x1={x0} y1={y0 + cell} x2={x0 + cell * 5} y2={y0 + cell} stroke="var(--chalk)" strokeWidth="1.2" strokeOpacity="0.7" />
      {Array.from({ length: 7 }, (_, i) => (
        <circle key={i} cx={x0 + (i % 5) * cell + cell / 2} cy={y0 + Math.floor(i / 5) * cell + cell / 2} r="4.6"
          fill={i < 5 ? "var(--counter-red)" : "var(--counter-yellow)"} stroke="var(--felt-deep)" strokeWidth="1" />
      ))}
    </>
  );
}

function NumberLine() {
  const ticks = [20, 35, 50, 65, 80];
  return (
    <>
      <line x1="14" y1="64" x2="86" y2="64" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      {ticks.map((x) => <line key={x} x1={x} y1="57" x2={x} y2="71" stroke={INK} strokeWidth="3" strokeLinecap="round" />)}
      <path d="M 35 54 Q 50 26 65 54" fill="none" stroke="var(--cube-blue)" strokeWidth="3.5" strokeLinecap="round" />
      <Counter cx={65} cy={46} r={7} color="red" />
    </>
  );
}

function RodArt() {
  const c = 6.4;
  return (
    <>
      {Array.from({ length: 10 }, (_, k) => (
        <rect key={k} x="33" y={18 + k * c} width="14" height={c} rx="1.5" fill="var(--cube-blue)" stroke={INK} strokeWidth="1.5" />
      ))}
      <rect x="55" y={18 + 8 * c} width="14" height={c * 2} rx="1.5" fill="var(--cube-blue)" stroke={INK} strokeWidth="1.5" />
      <line x1="55" y1={18 + 9 * c} x2="69" y2={18 + 9 * c} stroke={INK} strokeWidth="1.5" />
    </>
  );
}

function Calendar() {
  const dots = Array.from({ length: 7 }, (_, i) => ({ x: 32 + (i % 4) * 12, y: 50 + Math.floor(i / 4) * 13, on: i < 3 }));
  return (
    <>
      <rect x="22" y="24" width="56" height="54" rx="6" fill="var(--chalk)" stroke={INK} strokeWidth="3" />
      <path d="M 22 38 V 30 a 6 6 0 0 1 6 -6 H 72 a 6 6 0 0 1 6 6 V 38 Z" fill="var(--felt)" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <line x1="36" y1="18" x2="36" y2="29" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <line x1="64" y1="18" x2="64" y2="29" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r="4.5" fill={d.on ? "var(--counter-yellow)" : "none"} stroke={INK} strokeWidth="1.8" />
      ))}
    </>
  );
}

function Pencil() {
  return (
    <g transform="rotate(-40 50 50)" strokeLinejoin="round">
      <rect x="16" y="43" width="9" height="14" rx="3" fill="var(--counter-red)" stroke={INK} strokeWidth="2.5" />
      <rect x="25" y="43" width="42" height="14" fill="var(--counter-yellow)" stroke={INK} strokeWidth="2.5" />
      <line x1="25" y1="50" x2="67" y2="50" stroke={INK} strokeWidth="1.2" strokeOpacity="0.5" />
      <polygon points="67,43 84,50 67,57" fill="var(--tray)" stroke={INK} strokeWidth="2.5" />
      <polygon points="78.5,47.7 84,50 78.5,52.3" fill={INK} stroke={INK} strokeWidth="1.5" />
    </g>
  );
}

const PICTURES: Record<Art, () => ReactNode> = {
  star: Star,
  counters: Counters,
  "ten-frame": TenFrame,
  "number-line": NumberLine,
  rod: RodArt,
  calendar: Calendar,
  pencil: Pencil,
};

/** A round sticker: a tray disc with a 3 px ink ring and its picture. Decorative; the label beside it says what it is. */
export function StickerArt({ art, size }: { art: Art; size: number }) {
  const ring = (3 * 100) / size; // 3 px at any size
  const Picture = PICTURES[art] ?? Star;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" focusable="false" data-art={art}>
      <circle cx="50" cy="50" r={50 - ring / 2} fill="var(--tray)" stroke={INK} strokeWidth={ring} />
      <g transform="translate(50 50) scale(1.12) translate(-50 -50)">
        <Picture />
      </g>
    </svg>
  );
}
