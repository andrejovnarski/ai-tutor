import type { MistakeTag } from "../../domain/types";

/** Plain-language names for the mistake tags, written for a parent. */
export const TAG_LABEL: Record<MistakeTag, string> = {
  "off-by-one-counting": "Counting one too many or too few",
  "off-by-ten": "Mixing up tens and ones",
  "added-instead": "Adding when the problem needed taking away",
  "subtracted-instead": "Taking away when the problem needed adding",
  "wrong-operation": "Choosing the wrong operation",
  "picked-other": "Picking an answer that does not match the problem",
  "gave-total": "Giving the whole amount instead of the part",
  "gave-part": "Giving one part instead of the whole amount",
  "repeated-number": "Repeating a number from the problem",
  "skipped-number": "Skipping a number when counting",
  "counted-back": "Counting backwards when going forwards",
  "forgot-the-ten": "Forgetting to carry the ten",
  "subtracted-smaller-digit": "Subtracting the smaller digit from the larger one",
  "forgot-to-regroup": "Forgetting to regroup when subtracting",
  "added-digits": "Adding the digits instead of the numbers",
  "counted-ones-only": "Counting only the ones",
  "swapped-digits": "Swapping the digits of a number",
  "picked-ones-digit": "Using the ones digit instead of the whole number",
  "added-one": "Answers that are one too high",
  "subtracted-one": "Answers that are one too low",
  "dropped-zero": "Dropping a zero",
  "added-to-tens": "Adding to the tens instead of the ones",
  "used-double": "Doubling a number by mistake",
  "stopped-after-one-step": "Stopping after the first step of a two-step problem",
};

/** One small thing to try at home for the most common stuck point. */
export const TIP_FOR_TAG: Partial<Record<MistakeTag, string>> = {
  "off-by-one-counting": "Count small piles of things together, touching each one as you say its number.",
  "off-by-ten": "Use dimes and pennies: ask how many tens and how many ones make a number like 34.",
  "added-instead": "Act out a story with toys: when some go away, ask whether there are more or fewer left.",
  "subtracted-instead": "Act out a story with toys: when more arrive, ask whether there are more or fewer now.",
  "wrong-operation": "Ask your child to retell the problem as a story before choosing add or take away.",
  "forgot-the-ten": "Line up ten blocks and swap them for one longer block to show where the carried ten comes from.",
  "forgot-to-regroup": "Show 42 as 4 tens and 2 ones, then trade a ten for ten ones when you need more ones.",
  "counted-back": "Use a number line on the floor and step forward for adding, backward for taking away.",
  "swapped-digits": "Build numbers with tens and ones blocks and read them aloud, tens first.",
};

export const DEFAULT_TIP = "Ask your child to show you one thing they learned this week and explain it in their own words.";
