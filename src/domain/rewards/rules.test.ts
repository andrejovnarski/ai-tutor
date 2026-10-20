import { CUBES_PER_LEVEL, WEEK_GOAL_DAYS, XP, XP_PER_CUBE } from "./rules";

it("reward values never drop below the launch values", () => {
  expect(XP.problem).toBeGreaterThanOrEqual(10);
  expect(XP.firstTry).toBeGreaterThanOrEqual(5);
  expect(XP.mastered).toBeGreaterThanOrEqual(100);
  expect(XP.finished).toBeGreaterThanOrEqual(20);
  expect(XP_PER_CUBE).toBe(50);
  expect(CUBES_PER_LEVEL).toBe(10);
  expect(WEEK_GOAL_DAYS).toBe(3);
});
