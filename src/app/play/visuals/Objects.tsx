import type { Icon, Visual } from "@/domain/types";
import { Svg, Cross, layoutGroups, slotsBox, H } from "./common";
import { ICONS } from "./icons";
import { describeVisual } from "./describe";

type SlotInfo = { group: number; index: number; flat: number };

// Icons in groups, wrapping at 5 per row. `crossed` picks the slots that get a chalk ×.
export function IconRows({ icon, groups, crossed, top, bottom }: {
  icon: Icon;
  groups: number[];
  crossed: (slot: SlotInfo) => boolean;
  top: number;
  bottom: number;
}) {
  const draw = ICONS[icon];
  const slots = layoutGroups(groups, top, bottom);
  return (
    <>
      {groups.map((_, g) => (
        <g key={g} data-group={g}>
          {slots
            .filter((s) => s.group === g)
            .map((s) => (
              <g key={s.flat} data-x={s.cx} data-y={s.cy}>
                {draw({ cx: s.cx, cy: s.cy, s: s.s })}
                {crossed(s) ? <Cross cx={s.cx} cy={s.cy} h={s.s * 0.4} /> : null}
              </g>
            ))}
        </g>
      ))}
    </>
  );
}

export function Objects({ v }: { v: Extract<Visual, { kind: "objects" }> }) {
  const n0 = v.groups[0] ?? 0;
  const k = Math.min(v.crossedOut ?? 0, n0);
  return (
    <Svg label={describeVisual(v)} box={slotsBox(layoutGroups(v.groups, 20, H - 20))}>
      <IconRows icon={v.icon} groups={v.groups} top={20} bottom={H - 20} crossed={(s) => s.group === 0 && s.index >= n0 - k} />
    </Svg>
  );
}
