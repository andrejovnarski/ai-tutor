import { vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

// Same Node-only hook approach as usePlay.test.tsx; keyed component paths own their hook slots.
const rt = vi.hoisted(() => ({ slots: new Map<string, unknown[]>(), path: "", i: 0,
  effects: [] as Array<() => void>, focused: "", state: {} as import("../playMachine").PlayState }));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const slots = rt.slots.get(rt.path)!; const i = rt.i++;
    if (!(i in slots)) slots[i] = initial;
    return [slots[i], (value: unknown) => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }];
  },
  useRef: (initial: unknown) => { const slots = rt.slots.get(rt.path)!; const i = rt.i++; return slots[i] ??= { current: initial }; },
  useEffect: (effect: () => void) => { rt.effects.push(effect); },
  useSyncExternalStore: (_: unknown, __: unknown, snapshot: () => unknown) => snapshot(),
}));
vi.mock("../usePlay", () => ({ usePlay: () => ({ state: rt.state, answer: vi.fn(), help: vi.fn() }) }));
vi.mock("../speech/useMic", () => ({ useMic: () => ({ mic: { hidden: true } }) }));
vi.mock("../speech/useNovaAudio", () => ({ useNovaAudio: () => ({}) }));
vi.mock("next/link", () => ({ default: ({ children }: { children: ReactNode }) => <a>{children}</a> }));
import { TenFrames } from "./TenFrames";
import { Visual } from "./Visual";
import { PlayScreen } from "../PlayScreen";

type Node = ReactElement<Record<string, any>>;
let nodes: Node[];
function expand(child: ReactNode, path = "root"): void {
  if (Array.isArray(child)) { child.forEach((c, i) => expand(c, `${path}/${i}`)); return; }
  if (!child || typeof child !== "object" || !("props" in child)) return;
  const node = child as Node;
  path += `:${node.key ?? ""}`;
  if (typeof node.type === "function") {
    rt.path = path; rt.i = 0;
    if (!rt.slots.has(path)) rt.slots.set(path, []);
    expand((node.type as (p: unknown) => ReactNode)(node.props), path + "/component");
  } else {
    nodes.push(node);
    const el = { focus: () => { rt.focused = node.props["aria-label"] ?? node.props.children; } };
    if (typeof node.props.ref === "function") node.props.ref(el);
    else if (node.props.ref) node.props.ref.current = el;
    expand(node.props.children, path + "/children");
  }
}
function render(node: ReactNode) { nodes = []; rt.effects = []; expand(node); rt.effects.forEach((effect) => effect()); }
const emptyName = "Empty space, add a counter";
const undoName = "Your counter, take it back";
const buttons = (name?: string) => nodes.filter((n) => n.type === "button" && (!name || (n.props["aria-label"] ?? n.props.children) === name));
const added = () => nodes.filter((n) => n.props["data-counter"] === "added");
const click = (node: Node) => node.props.onClick();
const frame = (first = 6, locked = false) => <TenFrames v={{ kind: "ten-frames", first, second: 0, fill: true }} locked={locked} />;
beforeEach(() => {
  rt.slots.clear(); rt.focused = "";
  vi.stubGlobal("document", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());

it("keeps old, two-frame and other visuals passive", () => {
  for (const v of [{ kind: "ten-frames", first: 6, second: 0 }, { kind: "ten-frames", first: 9, second: 2, fill: true }, { kind: "equation", text: "2 + 3" }] as const) {
    render(<Visual v={v} />); expect(buttons()).toHaveLength(0);
  }
});
it("adds in order, undoes the last counter and starts over without printing counts", () => {
  render(frame()); expect(buttons(emptyName)).toHaveLength(4); expect(buttons("Start over")).toHaveLength(0);
  click(buttons(emptyName).at(-1)!); render(frame());
  expect(added()).toHaveLength(1); expect(buttons(undoName)[0]!.key).toBe("6");
  expect(buttons(emptyName)).toHaveLength(3); expect(buttons(undoName)).toHaveLength(1);
  expect(buttons(emptyName).every((b) => b.props["data-empty"] === "true")).toBe(true);
  expect(rt.focused).toBe(emptyName);
  click(buttons(emptyName)[0]!); render(frame()); click(buttons(emptyName)[0]!); render(frame());
  click(buttons(undoName)[0]!); render(frame()); expect(added()).toHaveLength(2);
  expect(buttons(undoName).map((n) => n.key)).toEqual(["6", "7"]);
  expect(nodes.filter((n) => typeof n.props.children === "string" && /\d/.test(n.props.children))).toHaveLength(0);
  click(buttons("Start over")[0]!); render(frame());
  expect(added()).toHaveLength(0); expect(buttons("Start over")).toHaveLength(0);
});
it("locks every control and guards handlers during requests", () => {
  render(frame()); click(buttons(emptyName)[0]!); render(frame(6, true));
  expect(buttons().every((b) => b.props.disabled)).toBe(true);
  for (const b of buttons()) click(b);
  render(frame(6, true)); expect(added()).toHaveLength(1);
});
it("keeps focus on a usable cell, including when full and after clearing", () => {
  render(frame(9)); click(buttons(emptyName)[0]!); render(frame(9));
  expect(buttons(emptyName)).toHaveLength(0); expect(rt.focused).toBe(undoName);
  click(buttons("Start over")[0]!); render(frame(9)); expect(rt.focused).toBe(emptyName);
});
it("resets the board on a wrong-answer retry and locks it while sending", () => {
  const turn = { kind: "problem", mode: "practice", try: 1, help: 0,
    prompt: { say: "How many more make 10?", show: { kind: "ten-frames", first: 6, second: 0, fill: true } },
    input: "tap-choice", choices: [3, 4] } as const;
  rt.state = { phase: "problem", version: 1, turn: { ...turn, choices: [3, 4] }, line: { say: "Count together.", tone: "calm" } };
  const screen = <PlayScreen kidId="kid1" ageBand="5-7" />;
  render(screen); click(buttons(emptyName)[0]!); render(screen); expect(added()).toHaveLength(1);
  rt.state = { ...rt.state, phase: "sending" }; render(screen);
  expect(buttons(emptyName).every((b) => b.props.disabled)).toBe(true);
  rt.state = { ...rt.state, phase: "problem", version: 2, turn: { ...turn, try: 2, choices: [3, 4] } };
  render(screen); expect(added()).toHaveLength(0); expect(buttons(emptyName)).toHaveLength(4);
});

it("resets local additions when a different frame arrives", () => {
  render(frame()); click(buttons(emptyName)[0]!); render(frame()); expect(added()).toHaveLength(1);
  render(frame(4)); expect(added()).toHaveLength(0); expect(buttons(emptyName)).toHaveLength(6);
});
