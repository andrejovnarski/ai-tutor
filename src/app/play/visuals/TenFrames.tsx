"use client";
import { useEffect, useRef, useState } from "react";
import styles from "../play.module.css";
import type { Visual } from "@/domain/types";
import { Svg, Cross, W, H } from "./common";
import { describeVisual } from "./describe";

const CELL = 60;
const FW = CELL * 5;
const FH = CELL * 2;
const FGAP = 40;

type Props = { v: Extract<Visual, { kind: "ten-frames" }>; locked?: boolean };

export function TenFrames({ v, locked }: Props) {
  if (v.fill === true && v.first + v.second <= 10) {
    return <FillFrame key={`${v.first}:${v.second}`} v={v} locked={locked} />;
  }
  return <StaticFrames v={v} />;
}

function FillFrame({ v, locked }: Props) {
  const filled = v.first + v.second;
  const [added, setAdded] = useState(0);
  const controls = useRef<Array<HTMLButtonElement | null>>([]);
  const focusCell = useRef<number | null>(null);
  useEffect(() => {
    if (focusCell.current === null) return;
    controls.current[focusCell.current]?.focus();
    focusCell.current = null;
  }, [added]);
  const change = (next: number) => {
    if (locked) return;
    focusCell.current = filled + next < 10 ? filled + next : 9;
    setAdded(next);
  };
  return (
    <div className={styles.fillFrame}>
      <div role="img" aria-label={describeVisual(v)} className={styles.srOnly} />
      <div className={styles.frameGrid} data-frame="true">
        {Array.from({ length: 10 }, (_, i) => {
          if (i < filled) return (
            <span key={i} className={styles.frameCell} aria-hidden="true">
              <span className={styles.frameCounter} data-counter={i < v.first ? "red" : "yellow"}
                style={{ background: i < v.first ? "var(--counter-red)" : "var(--counter-yellow)" }} />
              {i >= filled - Math.min(v.crossedOut ?? 0, filled) ? <span className={styles.frameCross}>×</span> : null}
            </span>
          );
          const yours = i < filled + added;
          return (
            <button key={i} type="button" className={styles.frameCell} disabled={locked}
              ref={(el) => { controls.current[i] = el; }}
              aria-label={yours ? "Your counter, take it back" : "Empty space, add a counter"}
              data-empty={yours ? undefined : "true"}
              onClick={() => change(yours ? added - 1 : added + 1)}>
              {yours ? <span className={styles.frameCounter} data-counter="added" /> : <span className={styles.frameEmpty} />}
            </button>
          );
        })}
      </div>
      <div className={styles.frameActions}>
        {added > 0 ? <button type="button" className={styles.frameReset} disabled={locked} onClick={() => change(0)}>Start over</button> : null}
      </div>
    </div>
  );
}

function StaticFrames({ v }: Props) {
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
          fill="none" stroke="var(--pp-ink)" strokeOpacity="0.45" strokeWidth="2" strokeDasharray="4 6" />,
      );
    } else {
      cells.push(
        <g key={i}>
          <circle data-counter={i < v.first ? "red" : "yellow"} cx={x + CELL / 2} cy={y + CELL / 2} r="24"
            fill={i < v.first ? "var(--counter-red)" : "var(--counter-yellow)"} stroke="var(--pp-ink)" strokeWidth="2" />
          {i >= crossedFrom ? <Cross cx={x + CELL / 2} cy={y + CELL / 2} h={14} /> : null}
        </g>,
      );
    }
  }
  const box = { x0, y0, x1: x0 + nf * FW + (nf - 1) * FGAP, y1: y0 + FH };
  return (
    <Svg label={describeVisual(v)} box={box}>
      {Array.from({ length: nf }, (_, f) => {
        const fx = x0 + f * (FW + FGAP);
        return (
          <g key={f}>
            <rect data-frame="true" x={fx} y={y0} width={FW} height={FH} rx="10" fill="var(--pp-sand)" stroke="var(--pp-ink)" strokeWidth="3" />
            {[1, 2, 3, 4].map((c) => (
              <line key={c} x1={fx + c * CELL} y1={y0} x2={fx + c * CELL} y2={y0 + FH} stroke="var(--pp-ink)" strokeWidth="2" strokeOpacity="0.6" />
            ))}
            <line x1={fx} y1={y0 + CELL} x2={fx + FW} y2={y0 + CELL} stroke="var(--pp-ink)" strokeWidth="2" strokeOpacity="0.6" />
          </g>
        );
      })}
      {cells}
    </Svg>
  );
}
