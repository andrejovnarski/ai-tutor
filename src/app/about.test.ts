import { CLUSTERS } from "@/domain/curriculum";
import { COVERS, DESCRIPTION, GRADE_HINT, TAGLINE } from "./about";

it("the tagline names early math and its grades, and welcomes older kids", () => {
  expect(TAGLINE).toBe(
    "Nova, a patient tutor for early math: counting, adding and subtracting, and place value (kindergarten to grade 2). " +
      "Older kids who want stronger foundations are welcome too.",
  );
  expect(TAGLINE).not.toMatch(/5 to 11/);
});

it("the covers line lists every curriculum topic, in order", () => {
  expect(COVERS).toBe(`Covers: ${CLUSTERS.map((c) => c.name).join(", ")}.`);
  expect(COVERS).toContain("Count to 20");
  expect(COVERS).toContain("Word problems");
});

it("the grade hint says what grades 3 to 5 get", () => {
  expect(GRADE_HINT).toBe(
    "Brightling AI teaches kindergarten to grade 2 math. Children in grades 3 to 5 start with grade 2 work and fill any gaps first.",
  );
});

it("the page description is one sentence about early math", () => {
  expect(DESCRIPTION).toMatch(/^[^.]+\.$/);
  expect(DESCRIPTION).toContain("kindergarten to grade 2");
});
