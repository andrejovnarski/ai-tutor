import { describe, expect, it } from "vitest";
import { checkLine, numbersIn, ordinalsIn } from "./guards";
import type { TurnPlan, TutorLine } from "./types";

const plan = (o: Partial<TurnPlan> = {}): TurnPlan => ({
  event: "present", ageBand: "5-7", skill: "add-within-10", problem: "What is 3 + 4?",
  problemNumbers: [3, 4], answer: 7, recentLines: [], ...o,
});
const line = (say: string): TutorLine => ({ say, tone: "cheer" });
const reason = (say: string, p: TurnPlan) => {
  const r = checkLine(line(say), p);
  return r.ok ? "ok" : r.reason;
};

describe("numbersIn", () => {
  it("reads sixes as six", () => {
    expect(numbersIn("two sixes")).toEqual([2, 6]);
  });
  it("reads zeroes as zero", () => {
    expect(numbersIn("zeroes")).toEqual([0]);
  });
  it("reads uppercase -es plurals as cardinals, not ordinals", () => {
    expect(numbersIn("SIXES and ZEROES")).toEqual([6, 0]);
    expect(ordinalsIn("sixes and zeroes")).toEqual([]);
  });
  it("keeps existing plurals and ordinary -es words unchanged", () => {
    expect(numbersIn("fives, threes, hundreds, dozens, seconds")).toEqual([5, 3]);
    expect(ordinalsIn("fives, threes, hundreds, dozens, seconds")).toEqual([2]);
    expect(numbersIn("yes, times, ones")).toEqual([]);
    expect(ordinalsIn("yes, times, ones")).toEqual([]);
  });
  it("reads digits and number words, whole words only", () => {
    expect(numbersIn("3 and four, then 12 and Twenty")).toEqual([3, 4, 12, 20]);
    expect(numbersIn("someone is gone, none left")).toEqual([]);
    expect(numbersIn("zero")).toEqual([0]);
  });
  it("reads big words and compounds as their value", () => {
    expect(numbersIn("forty seven")).toEqual([47]);
    expect(numbersIn("twenty-one and thirty")).toEqual([21, 30]);
    expect(numbersIn("a dozen eggs")).toEqual([12]);
    expect(numbersIn("a hundred, one hundred, ninety")).toEqual([100, 100, 90]);
    expect(numbersIn("It is _7_, 7ish, 7th, \uff17")).toEqual([7, 7, 7, 7]);
  });
});

describe("checkLine", () => {
  it("numbers and early answer", () => {
    expect(reason("Let's add 3 and 4, {name}!", plan())).toBe("ok");
    expect(reason("3 + 4 is 7!", plan())).toBe("early-answer");
    expect(reason("That makes seven.", plan())).toBe("early-answer");
    expect(reason("Count to 9 first", plan())).toBe("numbers");
  });
  it("answer allowed for correct, celebrate, revealed explain", () => {
    expect(reason("Yes, 7!", plan({ event: "correct" }))).toBe("ok");
    expect(reason("Seven, 7!", plan({ event: "celebrate" }))).toBe("ok");
    expect(reason("4 more than 3 is 7.", plan({ event: "explain", revealed: true }))).toBe("ok");
    expect(reason("4 more than 3 is 7.", plan({ event: "explain" }))).toBe("early-answer");
  });
  it("a revealed explain must say the answer (the kid is told after two wrong tries)", () => {
    expect(reason("Let's walk through it together!", plan({ event: "explain", revealed: true }))).toBe("missing-answer");
    expect(reason("Count on from 3 with me.", plan({ event: "explain", revealed: true }))).toBe("missing-answer");
    expect(reason("It makes seven, {name}.", plan({ event: "explain", revealed: true }))).toBe("ok");
    expect(reason("Let's walk through it together!", plan({ event: "explain" }))).toBe("ok");
  });
  it("hint, wrong and kid-said keep the answer hidden", () => {
    for (const event of ["hint", "wrong", "kid-said"] as const)
      expect(reason("It is 7", plan({ event }))).toBe("early-answer");
  });
  it("answer in the problem is fine", () => {
    expect(reason("5 plus nothing stays 5", plan({ problem: "What is 5 + 0?", problemNumbers: [5, 0], answer: 5 }))).toBe("ok");
  });
  it("digits glued to letters, big number words, placeholders", () => {
    for (const s of ["It is _7_.", "It is 7ish.", "It is 7th.", "It is \uff17."]) expect(reason(s, plan())).toBe("early-answer");
    expect(reason("That makes thirty!", plan({ problem: "15 + 15", problemNumbers: [15, 15], answer: 30 }))).toBe("early-answer");
    expect(reason("Twenty-one is the total.", plan({ problem: "20 + 1", problemNumbers: [20, 1], answer: 21 }))).toBe("early-answer");
    expect(reason("Those blocks make thirty-four!", plan({ problemNumbers: [3, 4], answer: 34 }))).toBe("early-answer");
    expect(reason("It is {answer}!", plan())).toBe("placeholder");
    expect(reason("Hi { name }!", plan())).toBe("placeholder");
    expect(reason("Hi {name}!", plan())).toBe("ok");
  });
  it("underscore-glued words and fullwidth blocked words", () => {
    expect(reason("It is _seven_.", plan())).toBe("early-answer");
    expect(reason("It is twenty_one.", plan({ problemNumbers: [20, 1], answer: 21 }))).toBe("early-answer");
    expect(reason("\uff53\uff54\uff55\uff50\uff49\uff44", plan())).toBe("word");
    expect(reason("so _stupid_", plan())).toBe("word");
  });
  it("plural and ordinal number words, irregular ordinals and ordinal compounds", () => {
    expect(numbersIn("sevens and twos, sixths")).toEqual([7, 2]); // ordinals are not quantities
    expect(numbersIn("the ones and the tens, hundreds")).toEqual([]); // place-value nouns
    expect(ordinalsIn("first, second, third, fifth, eighth, ninth, twelfth, twentieth, thirtieth, hundredth"))
      .toEqual([1, 2, 3, 5, 8, 9, 12, 20, 30, 100]);
    expect(ordinalsIn("seventh, sevenths, seventeenth, twenty-first, forty seventh, seconds")).toEqual([7, 7, 17, 21, 47, 2]);
    expect(numbersIn("twenty-sevens")).toEqual([27]);
  });
  it("other forms of the answer are caught (problem 3 + 4, answer 7)", () => {
    expect(reason("It's the seventh!", plan())).toBe("early-answer");
    expect(reason("Sevens are fun", plan())).toBe("early-answer");
    expect(reason("Think of the twenty-seventh dot", plan({ answer: 27 }))).toBe("early-answer");
    expect(reason("Is it s-e-v-e-n?", plan())).toBe("number-form");
    expect(reason("Is it s e v e n?", plan())).toBe("number-form");
    expect(reason("Is it s.e.v.e.n?", plan())).toBe("number-form");
    expect(reason("It is VII!", plan())).toBe("number-form");
    expect(reason("It is vii!", plan())).toBe("number-form");
    expect(reason("Try xc.", plan())).toBe("number-form");
    expect(reason("It is \u0667!", plan())).toBe("number-form"); // Arabic-Indic seven
    expect(reason("It is \u096d!", plan())).toBe("number-form"); // Devanagari seven
  });
  it("rejects an early answer using sixes", () => {
    expect(reason("Sixes are fun", plan({ problem: "What is 2 + 4?", problemNumbers: [2, 4], answer: 6 })))
      .toBe("early-answer");
  });
  it("ordinals are sequencing words: only the answer is held back", () => {
    expect(reason("Try the tens first, then the ones.", plan())).toBe("ok");
    expect(reason("Count the second group of dots.", plan())).toBe("ok");
    expect(reason("Look at the first dot.", plan({ answer: 1, problemNumbers: [3, 2] }))).toBe("early-answer");
  });
  it("normal words are not number forms", () => {
    expect(reason("I can mix the dots, I think. A big did it.", plan())).toBe("ok");
    expect(reason("I will civil lid dim ill vivid mild Nova.", plan())).toBe("ok");
    expect(reason("Add 3 and 4, e.g. with a picture.", plan())).toBe("ok");
    expect(reason("Add 3 and 4, then check.", plan({ event: "correct" }))).toBe("ok");
  });
  it("kid's answer is allowed", () => {
    expect(reason("You said 6, let's check.", plan({ event: "wrong", kidAnswer: 6 }))).toBe("ok");
  });
  it("length", () => {
    const words = Array.from({ length: 26 }, () => "yay").join(" ");
    expect(reason(words, plan())).toBe("length");
    expect(reason(words, plan({ ageBand: "8-11" }))).toBe("ok");
    expect(reason(Array.from({ length: 25 }, () => "yay").join(" "), plan())).toBe("ok");
    expect(reason(Array.from({ length: 41 }, () => "yay").join(" "), plan({ ageBand: "8-11" }))).toBe("length");
  });
  it("blocked words, urls, symbols", () => {
    expect(reason("That's easy!", plan())).toBe("word");
    expect(reason("That is WRONG", plan())).toBe("word");
    expect(reason("Easily done", plan())).toBe("ok");
    expect(reason("Go to www.example.com", plan())).toBe("word");
    expect(reason("See https://x.y", plan())).toBe("word");
    expect(reason("mail me @nova", plan())).toBe("word");
    expect(reason("nice 😀", plan())).toBe("word");
    expect(reason("a < b", plan())).toBe("word");
    expect(reason("a > b", plan())).toBe("word");
  });
  it("names", () => {
    expect(reason("Great job, Sam!", plan())).toBe("name");
    expect(reason("Nova thinks you can!", plan())).toBe("ok");
    expect(reason("Hi from Nova!", plan())).toBe("ok");
    expect(reason("{name} {name}", plan())).toBe("name");
    expect(reason("Go, {name}! Try again. Look at 3.", plan())).toBe("ok");
    expect(reason("Wow! Let's go? Yes. I can do it. I'm sure.", plan())).toBe("ok");
    expect(reason("Four. Then 3. Ask Nova and Sam", plan())).toBe("name");
    expect(reason("Great job, Émile!", plan())).toBe("name");
    expect(reason("Look at this, Zoë.", plan())).toBe("name");
    expect(reason("Well done, Łukasz and Ólafur", plan())).toBe("name");
    expect(reason("Émile is great.", plan())).toBe("ok"); // sentence start, like any capital
    expect(reason("Let's go, café time!", plan())).toBe("ok");
  });
});
