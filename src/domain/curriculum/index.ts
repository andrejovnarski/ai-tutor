import type { Cluster, Level, Problem, Skill, Template } from "../types";
import { addWithin10Cluster } from "./add-within-10";
import { compareNumbersCluster } from "./compare-numbers";
import { countTo20Cluster } from "./count-to-20";

export const CLUSTERS: Cluster[] = [countTo20Cluster, compareNumbersCluster, addWithin10Cluster];

export const SKILLS: Skill[] = CLUSTERS.flatMap((c) => c.skills);

const skillsById = new Map(SKILLS.map((s) => [s.id, s]));
const templatesById = new Map(CLUSTERS.flatMap((c) => c.templates).map((t) => [t.id, t]));

export function getSkill(id: string): Skill {
  const s = skillsById.get(id);
  if (!s) throw new Error(`unknown skill: ${id}`);
  return s;
}

export function getTemplate(id: string): Template {
  const t = templatesById.get(id);
  if (!t) throw new Error(`unknown template: ${id}`);
  return t;
}

export function generate(templateId: string, seed: number, level: Level): Problem {
  return getTemplate(templateId).make(seed, level);
}
