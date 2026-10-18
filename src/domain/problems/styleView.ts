import type { Style, Visual } from "../types";

/** The picture for a sum in a teaching style; null when the style has no picture (story). */
export function styleView(style: Style, [a, b]: [number, number]): Visual | null {
  switch (style) {
    case "drawing": return { kind: "objects", icon: "apple", groups: [a, b] };
    case "ten-frame": return { kind: "ten-frames", first: a, second: b };
    case "number-line": return { kind: "number-line", from: 0, to: 10, marks: [a], jump: { from: a, by: b } };
    case "blocks": return { kind: "blocks", groups: [{ tens: 0, ones: a }, { tens: 0, ones: b }] };
    case "story": return null;
  }
}
