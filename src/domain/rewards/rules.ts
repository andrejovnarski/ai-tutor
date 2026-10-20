// Reward values. They only ever go up, never down.
export const XP = {
  problem: 10,
  firstTry: 5,
  mastered: 100,
  finished: 20,
} as const;
export const XP_PER_CUBE = 50;
export const CUBES_PER_LEVEL = 10;
export const WEEK_GOAL_DAYS = 3;
export const GREAT_WEEKS = [1, 4, 10] as const;
export const KEPT_TRYING = [10, 50, 150] as const;
