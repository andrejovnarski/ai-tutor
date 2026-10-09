import type { CheckResult, TutorLine, TurnPlan } from "./types";

const UNITS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = ["twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const WORD_VALUES = new Map<string, number>([
  ...UNITS.map((w, i) => [w, i] as [string, number]),
  ...TENS.map((w, i) => [w, (i + 2) * 10] as [string, number]),
  ["hundred", 100], ["dozen", 12],
]);
const ONES = UNITS.slice(1, 10).join("|");
const L = "(?<![a-z])"; // letter-only boundaries: "_seven_" and "7ish" still count
const R = "(?![a-z])";
const NUMBER_RE = new RegExp(
  `${L}(?:${TENS.join("|")})[-\\s_]+(?:${ONES})${R}|${L}(?:(?:a|one)[\\s_]+)?(?:hundred|dozen)${R}|${L}(?:${[...UNITS, ...TENS].join("|")})${R}|(?<!\\d)\\d+(?!\\d)`,
  "g");

/** Digit runs and number words (zero to ninety, compounds, hundred, dozen) as their value; whole words only. */
export function numbersIn(text: string): number[] {
  const s = text.normalize("NFKC").toLowerCase();
  return (s.match(NUMBER_RE) ?? []).map((t) => {
    if (/^\d+$/.test(t)) return Number(t);
    const parts = t.split(/[-\s_]+/);
    if (parts.length === 2 && TENS.includes(parts[0]!) && UNITS.includes(parts[1]!))
      return WORD_VALUES.get(parts[0]!)! + WORD_VALUES.get(parts[1]!)!;
    return WORD_VALUES.get(parts[parts.length - 1]!)!;
  });
}

const BLOCKED = new RegExp(
  `(?<![a-z])(?:wrong|stupid|dumb|easy|simple|obviously|fail|failed|bad|silly|idiot|hate|kill|die)(?![a-z])`, "i");
const URL_RE = /https?:|www\.|\b[\w-]+\.(?:com|org|net|io|co|edu|gov|app|dev|me|ly)\b|\w\/\w/i;
const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}|‍|️/u;
const ALLOWED_CAPS = new Set(["Nova", "I"]);
const HIDES_ANSWER = new Set(["present", "hint", "wrong", "kid-said"]);

function wordCount(say: string): number {
  return say.split(/\s+/).filter(Boolean).length; // "{name}" is one token, so counts as 1
}

function hasBlocked(say: string): boolean {
  return BLOCKED.test(say) || URL_RE.test(say) || /[@<>]/.test(say) || EMOJI_RE.test(say);
}

function nameProblem(say: string): boolean {
  if ((say.match(/\{name\}/g) ?? []).length > 1) return true;
  const text = say.replace(/\{name\}/g, "");
  const re = /[A-Za-z][A-Za-z]*(?:'[A-Za-z]+)?/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const word = m[0];
    if (!/^[A-Z]/.test(word)) continue;
    const base = word.replace(/'.*$/, "");
    if (ALLOWED_CAPS.has(base)) continue;
    const before = text.slice(0, m.index).replace(/["'“”‘’(\s]+$/, "");
    const atSentenceStart = before === "" || /[.!?]$/.test(before);
    if (!atSentenceStart) return true;
  }
  return false;
}

export function checkLine(line: TutorLine, plan: TurnPlan): CheckResult {
  const say = line.say.normalize("NFKC");
  const allowed = new Set<number>([...plan.problemNumbers, plan.answer]);
  if (plan.kidAnswer !== undefined) allowed.add(plan.kidAnswer);
  const spoken = numbersIn(say);
  if (spoken.some((n) => !allowed.has(n))) return { ok: false, reason: "numbers" };

  const mayReveal = !HIDES_ANSWER.has(plan.event) && (plan.event !== "explain" || plan.revealed === true);
  if (!mayReveal && spoken.includes(plan.answer) && !plan.problemNumbers.includes(plan.answer))
    return { ok: false, reason: "early-answer" };

  const max = plan.ageBand === "5-7" ? 25 : 40;
  if (wordCount(say) > max) return { ok: false, reason: "length" };
  if (hasBlocked(say)) return { ok: false, reason: "word" };
  if (/[{}]/.test(say.replace(/\{name\}/g, ""))) return { ok: false, reason: "placeholder" };
  if (nameProblem(say)) return { ok: false, reason: "name" };
  return { ok: true };
}
