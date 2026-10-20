import type { Visual as VisualT } from "@/domain/types";
import { Objects } from "./Objects";
import { TenFrames } from "./TenFrames";
import { NumberLine } from "./NumberLine";
import { Blocks } from "./Blocks";
import { Equation } from "./Equation";
import { Story } from "./Story";

export { describeVisual } from "./describe";

export function Visual({ v, locked }: { v: VisualT; locked?: boolean }) {
  switch (v.kind) {
    case "objects": return <Objects v={v} />;
    case "ten-frames": return <TenFrames v={v} locked={locked} />;
    case "number-line": return <NumberLine v={v} />;
    case "blocks": return <Blocks v={v} />;
    case "equation": return <Equation v={v} />;
    case "story": return <Story v={v} />;
  }
}
