import type { Visual } from "@/domain/types";
import { Svg, Cross, W, H } from "./common";
import { describeVisual } from "./describe";

type Group = { tens: number; ones: number };
const r1 = (n: number) => Math.round(n * 10) / 10;
const COLW = 5; // loose cubes stack five high

type Plan = { rods: number; crossedRods: number; ones: number; crossedOnes: number; broken: boolean };

function plan(g: Group, c: { tens: number; ones: number } | undefined): Plan {
  const cOnes = c?.ones ?? 0;
  let rods = g.tens;
  let ones = g.ones;
  const crossedRodsWanted = Math.min(c?.tens ?? 0, g.tens);
  const broken = cOnes > g.ones && g.tens - crossedRodsWanted >= 1;
  if (broken) { rods -= 1; ones += 10; }
  return { rods, crossedRods: Math.min(crossedRodsWanted, rods), ones, crossedOnes: Math.min(cOnes, ones), broken };
}

export function Blocks({ v }: { v: Extract<Visual, { kind: "blocks" }> }) {
  const plans = v.groups.map((g, i) => plan(g, i === 0 ? v.crossedOut : undefined));
  const GAPG = 44;
  const widthAt = (c: number) =>
    plans.reduce((sum, p) => sum + (p.rods + Math.ceil(p.ones / COLW)) * (c + 6) + (p.rods && p.ones ? 14 : 0), 0) + GAPG * Math.max(0, plans.length - 1);
  let c = 30;
  while (c > 8 && widthAt(c) > W - 80) c -= 1;
  const total = widthAt(c);
  const base = H - 30;
  let x = (W - total) / 2;
  const out: React.ReactNode[] = [];
  plans.forEach((p, gi) => {
    for (let r = 0; r < p.rods; r++) {
      const rx = r1(x);
      const crossed = r >= p.rods - p.crossedRods;
      out.push(
        <g key={`${gi}r${r}`} data-rod="true">
          {Array.from({ length: 10 }, (_, k) => (
            <rect key={k} data-rod-cube="true" x={rx} y={r1(base - (k + 1) * c)} width={c} height={c} rx="3" fill="var(--cube-blue)" stroke="var(--chalk)" strokeWidth="1.5" />
          ))}
          {crossed ? <Cross cx={r1(rx + c / 2)} cy={r1(base - 5 * c)} h={Math.min(c * 0.9, 26)} /> : null}
        </g>,
      );
      x += c + 6;
    }
    if (p.rods && p.ones) x += 14;
    const cols = Math.ceil(p.ones / COLW);
    for (let o = 0; o < p.ones; o++) {
      const cx0 = r1(x + Math.floor(o / COLW) * (c + 6));
      const cy0 = r1(base - ((o % COLW) + 1) * c);
      out.push(
        <g key={`${gi}o${o}`}>
          <rect data-cube="true" x={cx0} y={cy0} width={c} height={c} rx="3" fill="var(--cube-blue)" stroke="var(--chalk)" strokeWidth="1.5" />
          {o < p.crossedOnes ? <Cross cx={r1(cx0 + c / 2)} cy={r1(cy0 + c / 2)} h={c * 0.35} /> : null}
        </g>,
      );
    }
    x += cols * (c + 6) + GAPG;
  });
  return <Svg label={describeVisual(v)}>{out}</Svg>;
}
