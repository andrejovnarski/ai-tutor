import type { Icon } from "@/domain/types";

type P = { cx: number; cy: number; s: number };
const r = (n: number) => Math.round(n * 10) / 10;
// Absolute-coordinate path from points relative to the icon box (-0.5..0.5 of s).
const pts = (p: P, list: [number, number][], close = true) =>
  list.map(([x, y], i) => `${i ? "L" : "M"} ${r(p.cx + x * p.s)} ${r(p.cy + y * p.s)}`).join(" ") + (close ? " Z" : "");

function Apple(p: P) {
  return (
    <g data-icon="apple">
      <circle cx={r(p.cx)} cy={r(p.cy + 0.07 * p.s)} r={r(0.38 * p.s)} fill="var(--counter-red)" />
      <path d={pts(p, [[0, -0.3], [0.05, -0.45]], false)} stroke="var(--chalk)" strokeWidth="3" strokeLinecap="round" fill="none" />
      <ellipse cx={r(p.cx + 0.14 * p.s)} cy={r(p.cy - 0.34 * p.s)} rx={r(0.1 * p.s)} ry={r(0.05 * p.s)} fill="var(--cube-blue)" />
    </g>
  );
}
function Star(p: P) {
  const list: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = (-90 + i * 36) * (Math.PI / 180);
    const rad = i % 2 ? 0.2 : 0.47;
    list.push([Math.cos(a) * rad, Math.sin(a) * rad + 0.03]);
  }
  return (
    <g data-icon="star">
      <path d={pts(p, list)} fill="var(--counter-yellow)" stroke="var(--felt-deep)" strokeWidth="2" strokeLinejoin="round" />
    </g>
  );
}
function Fish(p: P) {
  return (
    <g data-icon="fish">
      <ellipse cx={r(p.cx - 0.05 * p.s)} cy={r(p.cy)} rx={r(0.3 * p.s)} ry={r(0.2 * p.s)} fill="var(--cube-blue)" />
      <path d={pts(p, [[0.2, 0], [0.45, -0.2], [0.45, 0.2]])} fill="var(--cube-blue)" />
      <circle cx={r(p.cx - 0.2 * p.s)} cy={r(p.cy - 0.05 * p.s)} r={r(0.04 * p.s)} fill="var(--chalk)" />
    </g>
  );
}
function Ball(p: P) {
  return (
    <g data-icon="ball">
      <circle cx={r(p.cx)} cy={r(p.cy)} r={r(0.4 * p.s)} fill="var(--chalk)" stroke="var(--counter-red)" strokeWidth="3" />
      <path d={pts(p, [[-0.36, -0.1], [-0.12, -0.2], [0.12, -0.2], [0.36, -0.1]], false)} stroke="var(--counter-red)" strokeWidth="4" fill="none" />
      <path d={pts(p, [[-0.36, 0.1], [-0.12, 0.2], [0.12, 0.2], [0.36, 0.1]], false)} stroke="var(--counter-red)" strokeWidth="4" fill="none" />
    </g>
  );
}
function Duck(p: P) {
  return (
    <g data-icon="duck">
      <ellipse cx={r(p.cx - 0.05 * p.s)} cy={r(p.cy + 0.15 * p.s)} rx={r(0.33 * p.s)} ry={r(0.24 * p.s)} fill="var(--counter-yellow)" />
      <circle cx={r(p.cx + 0.12 * p.s)} cy={r(p.cy - 0.18 * p.s)} r={r(0.2 * p.s)} fill="var(--counter-yellow)" />
      <path d={pts(p, [[0.3, -0.2], [0.46, -0.14], [0.3, -0.08]])} fill="#F08A24" />
      <circle cx={r(p.cx + 0.14 * p.s)} cy={r(p.cy - 0.22 * p.s)} r={r(0.03 * p.s)} fill="var(--ink)" />
    </g>
  );
}
function Shell(p: P) {
  return (
    <g data-icon="shell">
      <path d={pts(p, [[-0.42, 0.3], [-0.3, -0.1], [-0.1, -0.35], [0.1, -0.35], [0.3, -0.1], [0.42, 0.3]])} fill="#F2B8A0" stroke="var(--felt-deep)" strokeWidth="2" strokeLinejoin="round" />
      <path d={pts(p, [[0, 0.3], [0, -0.3]], false)} stroke="var(--felt-deep)" strokeWidth="2" fill="none" />
      <path d={pts(p, [[-0.2, 0.3], [-0.15, -0.25]], false)} stroke="var(--felt-deep)" strokeWidth="2" fill="none" />
      <path d={pts(p, [[0.2, 0.3], [0.15, -0.25]], false)} stroke="var(--felt-deep)" strokeWidth="2" fill="none" />
    </g>
  );
}
function Block(p: P) {
  const side = 0.78 * p.s;
  return (
    <g data-icon="block">
      <rect x={r(p.cx - side / 2)} y={r(p.cy - side / 2)} width={r(side)} height={r(side)} rx={r(0.08 * p.s)} fill="var(--cube-blue)" stroke="var(--chalk)" strokeWidth="2" />
      <circle cx={r(p.cx)} cy={r(p.cy)} r={r(0.14 * p.s)} fill="none" stroke="var(--chalk)" strokeWidth="2" />
    </g>
  );
}
function Cookie(p: P) {
  const dots: [number, number][] = [[-0.15, -0.15], [0.17, -0.05], [-0.05, 0.2], [0.15, 0.22]];
  return (
    <g data-icon="cookie">
      <circle cx={r(p.cx)} cy={r(p.cy)} r={r(0.4 * p.s)} fill="#C98B4A" stroke="var(--felt-deep)" strokeWidth="2" />
      {dots.map(([x, y], i) => (
        <circle key={i} cx={r(p.cx + x * p.s)} cy={r(p.cy + y * p.s)} r={r(0.05 * p.s)} fill="var(--ink)" />
      ))}
    </g>
  );
}

export const ICONS: Record<Icon, (props: P) => React.JSX.Element> = {
  apple: Apple, star: Star, fish: Fish, ball: Ball, duck: Duck, shell: Shell, block: Block, cookie: Cookie,
};
