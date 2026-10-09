import { describe, expect, it } from "vitest";
import { checkLine, numbersIn } from "./guards";
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
  it("reads digits and number words, whole words only", () => {
    expect(numbersIn("3 and four, then 12 and Twenty")).toEqual([3, 4, 12, 20]);
    expect(numbersIn("someone is gone, none left")).toEqual([]);
    expect(numbersIn("zero")).toEqual([0]);
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
  it("hint, wrong and kid-said keep the answer hidden", () => {
    for (const event of ["hint", "wrong", "kid-said"] as const)
      expect(reason("It is 7", plan({ event }))).toBe("early-answer");
  });
  it("answer in the problem is fine", () => {
    expect(reason("5 plus nothing stays 5", plan({ problem: "What is 5 + 0?", problemNumbers: [5, 0], answer: 5 }))).toBe("ok");
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
  });
});
