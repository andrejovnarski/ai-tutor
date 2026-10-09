import { CLUSTERS, SKILLS, getSkill, getTemplate } from "./index";

it("skill ids are unique", () => expect(new Set(SKILLS.map((s) => s.id)).size).toBe(SKILLS.length));

it("skill ids start with their cluster id", () => {
  for (const c of CLUSTERS) for (const s of c.skills) expect(s.id.startsWith(`${c.id}.`)).toBe(true);
});

it("every need exists", () => {
  for (const s of SKILLS) for (const n of s.needs) expect(() => getSkill(n)).not.toThrow();
});

it("needs graph has no cycles", () => {
  const state = new Map<string, "visiting" | "done">();
  const visit = (id: string, path: string[]): void => {
    if (state.get(id) === "done") return;
    if (state.get(id) === "visiting") throw new Error(`cycle: ${[...path, id].join(" → ")}`);
    state.set(id, "visiting");
    for (const n of getSkill(id).needs) visit(n, [...path, id]);
    state.set(id, "done");
  };
  for (const s of SKILLS) visit(s.id, []);
});

it("every template id resolves", () => {
  for (const s of SKILLS) for (const t of s.templates) expect(() => getTemplate(t)).not.toThrow();
});

it("each template belongs to exactly one skill", () => {
  for (const c of CLUSTERS) for (const t of c.templates)
    expect(SKILLS.filter((s) => s.templates.includes(t.id)).map((s) => s.id)).toHaveLength(1);
});

it("template ids are unique", () => {
  const ids = CLUSTERS.flatMap((c) => c.templates.map((t) => t.id));
  expect(new Set(ids).size).toBe(ids.length);
});

it.each(SKILLS.map((s) => [s.id, s] as const))("%s: styles, grade, template count", (_id, s) => {
  expect(s.styles.length).toBeGreaterThanOrEqual(2);
  expect(s.grade).toBe(s.commonCore[0]![0]);
  expect(s.templates.length).toBeGreaterThanOrEqual(2);
  expect(s.templates.length).toBeLessThanOrEqual(3);
});

it("unknown ids throw", () => {
  expect(() => getSkill("nope")).toThrow();
  expect(() => getTemplate("nope")).toThrow();
});

it("skill count within spec (25–35)", () => {
  expect(SKILLS.length).toBeGreaterThanOrEqual(25);
  expect(SKILLS.length).toBeLessThanOrEqual(35);
});

it("8 clusters in spec order", () =>
  expect(CLUSTERS.map((c) => c.id)).toEqual([
    "count-to-20", "compare-numbers", "add-within-10", "subtract-within-10",
    "add-subtract-within-20", "place-value", "add-subtract-within-100", "word-problems",
  ]));

/** True when some skill in cluster `to` needs (directly or transitively) a skill in cluster `from`. */
function clusterReaches(to: string, from: string): boolean {
  const seen = new Set<string>();
  const stack = SKILLS.filter((s) => s.id.startsWith(`${to}.`)).flatMap((s) => s.needs);
  while (stack.length) {
    const id = stack.pop()!;
    if (id.startsWith(`${from}.`)) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...getSkill(id).needs);
  }
  return false;
}

it.each([ // spec §5 cluster prerequisites
  ["count-to-20", "compare-numbers"], ["count-to-20", "add-within-10"], ["count-to-20", "subtract-within-10"],
  ["count-to-20", "place-value"], ["compare-numbers", "place-value"],
  ["add-within-10", "add-subtract-within-20"], ["subtract-within-10", "add-subtract-within-20"],
  ["add-subtract-within-20", "add-subtract-within-100"], ["place-value", "add-subtract-within-100"],
  ["add-subtract-within-20", "word-problems"], ["add-subtract-within-100", "word-problems"],
])("%s → %s", (from, to) => expect(clusterReaches(to, from)).toBe(true));

it("clusterReaches is directional", () => expect(clusterReaches("count-to-20", "word-problems")).toBe(false));

it("exactly one entry skill (no needs): count-to-20.objects-to-10", () =>
  expect(SKILLS.filter((s) => s.needs.length === 0).map((s) => s.id)).toEqual(["count-to-20.objects-to-10"]));

it("skill ids are stable (Review Focus 5 — update snapshot only on purpose)", () =>
  expect(SKILLS.map((s) => s.id)).toMatchSnapshot());
