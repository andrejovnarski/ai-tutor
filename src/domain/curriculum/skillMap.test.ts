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
