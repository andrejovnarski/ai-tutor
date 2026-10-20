import type { CSSProperties } from "react";
import type { IslandMap as IslandMapData } from "@/domain/rewards/map";
import styles from "./rewards.module.css";

// Option A's island chain, compressed vertically into the shared 400 × 160 canvas.
const POSITIONS = [[40, 38], [120, 46], [210, 35], [300, 40], [345, 78], [250, 95], [160, 105], [65, 100]] as const;
const flagX = (n: number, i: number) => (i - (n - 1) / 2) * 10;

export function IslandMap({ map, size, animate = false }: {
  map: IslandMapData;
  size: "mini" | "full";
  animate?: boolean;
}) {
  const done = map.islands.filter(i => i.flags.every(f => f.up)).length;
  const boatIsland = "done" in map.boat ? map.islands.length - 1 : map.boat.island;
  const current = map.islands[boatIsland]!;
  const label = "done" in map.boat ? "Map: all islands done!"
    : `Map: ${done} ${done === 1 ? "island" : "islands"} done. Now on ${current.name}, ${current.flags.filter(f => f.up).length} of ${current.flags.length} flags.`;
  const newFlags = map.islands.flatMap(i => i.flags).filter(f => f.isNew).length;
  // Leave 600 ms for sailing after all rises; even 33 new flags finish inside two seconds.
  const step = newFlags > 1 ? Math.min(180, 1100 / (newFlags - 1)) : 0;
  const sailDelay = newFlags ? (newFlags - 1) * step + 250 : 0;
  let riseIndex = 0;
  const [bx, by] = POSITIONS[boatIsland]!;
  const boatX = bx + ("done" in map.boat ? 0 : flagX(current.flags.length, map.boat.flag));
  const boatY = by + 19;
  const firstNew = map.islands.findIndex(i => i.flags.some(f => f.isNew));
  const start = firstNew < 0 ? boatIsland : Math.min(firstNew, boatIsland);
  const sailPath = POSITIONS.slice(start, boatIsland + 1).map(([x, y], i) =>
    `${i ? "L" : "M"}${x - boatX} ${y + 19 - boatY}`).join(" ") + " L0 0";

  const art = (
    <svg viewBox="0 0 400 160" role="img" aria-label={label} className={`${styles.islandMap} ${size === "mini" ? styles.mapMini : styles.mapFull}`}>
      <g aria-hidden="true" stroke="var(--pp-ink)" strokeWidth="2" strokeLinejoin="round">
        <path d="M40 38 C80 18 90 58 120 46 S180 18 210 35 S270 18 300 40 S375 57 345 78 S285 84 250 95 S200 98 160 105 S85 128 65 100"
          fill="none" stroke="var(--pp-white)" strokeDasharray="2 7" strokeLinecap="round" />
        {map.islands.map((island, index) => {
          const [x, y] = POSITIONS[index]!;
          const hasFlags = island.flags.some(f => f.up);
          return <g key={island.clusterId} transform={`translate(${x} ${y})`}>
            <ellipse rx="35" ry="17" fill={hasFlags ? "var(--pp-sand)" : "var(--pp-sky)"} strokeDasharray={hasFlags ? undefined : "4 4"} />
            {hasFlags && <ellipse cy="-4" rx="26" ry="10" fill="var(--pp-grass)" />}
            {island.flags.map((flag, i) => {
              const rise = animate && flag.isNew;
              const delay = rise ? riseIndex++ * step : 0;
              return <g key={flag.skillId} transform={`translate(${flagX(island.flags.length, i)} -5)`}
                data-flag={flag.up ? "up" : "down"} {...(flag.isNew ? { "data-new": "true" } : {})}>
                {flag.up ? <g className={rise ? styles.flagRise : undefined}
                  {...(rise ? { "data-rise": "true", style: { "--rise-delay": `${delay}ms` } as CSSProperties } : {})}>
                  <path d="M0 0V-20" fill="none" />
                  <path d="M0-20 8-16 0-12Z" fill="var(--pp-go)" />
                </g> : <path d="M0 0V-6" fill="none" />}
              </g>;
            })}
          </g>;
        })}
        <g transform={`translate(${boatX} ${boatY})`}>
          <g data-boat="true" className={animate ? styles.boatSail : undefined}
            {...(animate ? { "data-sail": "true", style: { offsetPath: `path('${sailPath}')`, "--sail-delay": `${sailDelay}ms` } as CSSProperties } : {})}>
            <path d="M-12 0H12L7 7H-7Z" fill="var(--pp-go)" />
            <path d="M0 0V-16L10-3Z" fill="var(--pp-white)" />
          </g>
        </g>
      </g>
    </svg>
  );
  return size === "mini" ? art : (
    <figure className={styles.mapHero}>
      {art}
      {!("done" in map.boat) && <figcaption className={styles.mapCaption}>{current.name}</figcaption>}
    </figure>
  );
}
