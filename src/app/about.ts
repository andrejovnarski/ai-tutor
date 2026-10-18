import { CLUSTERS } from "@/domain/curriculum";

// How the app describes itself to grown-ups: early math, kindergarten to grade 2 (roadmap §6).

export const TAGLINE =
  "Nova, a patient tutor for early math: counting, adding and subtracting, and place value (kindergarten to grade 2). " +
  "Older kids who want stronger foundations are welcome too.";

/** The topics, from the curriculum itself, so the list grows with it. */
export const COVERS = `Covers: ${CLUSTERS.map((c) => c.name).join(", ")}.`;

export const GRADE_HINT =
  "Brightling AI teaches kindergarten to grade 2 math. Children in grades 3 to 5 start with grade 2 work and fill any gaps first.";

export const DESCRIPTION =
  "Brightling AI is a patient early-math tutor for kindergarten to grade 2, and for older kids building their foundations.";
