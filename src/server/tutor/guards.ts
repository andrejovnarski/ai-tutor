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
/** Ordinals that are not "<number word>th": first, second ... twentieth ... hundredth. */
const IRREGULAR_ORDINALS = new Map<string, number>([
  ["first", 1], ["second", 2], ["third", 3], ["fifth", 5], ["eighth", 8], ["ninth", 9], ["twelfth", 12],
  ...TENS.map((w, i) => [w.replace(/y$/, "ieth"), (i + 2) * 10] as [string, number]),
  ["hundredth", 100],
]);
/** Place-value nouns ("the tens and the ones") are not the numbers 10 and 1. */
const PLACE_VALUE = new Set(["ones", "tens", "hundreds", "dozens"]);
const SUFFIXES = ["ths", "th", "st", "nd", "rd", "es", "s"]; // longest first

type Word = { value: number; ordinal: boolean };

/** A single word as a number: "seven", "sevens", "seventh", "sevenths", "first", "seconds". */
function wordNumber(w: string): Word | null {
  const plain = WORD_VALUES.get(w);
  if (plain !== undefined) return { value: plain, ordinal: false };
  if (PLACE_VALUE.has(w)) return null;
  const irregular = IRREGULAR_ORDINALS.get(w) ?? IRREGULAR_ORDINALS.get(w.replace(/s$/, ""));
  if (irregular !== undefined) return { value: irregular, ordinal: true };
  for (const suf of SUFFIXES) {
    if (!w.endsWith(suf)) continue;
    const base = w.slice(0, -suf.length);
    if (base === "hundred" || base === "dozen") continue; // "hundreds", "dozens" are vague amounts
    const v = WORD_VALUES.get(base);
    if (v !== undefined) return { value: v, ordinal: suf !== "s" && suf !== "es" };
  }
  return null;
}

const TOKEN_RE = /\d+|[a-z]+/g; // digits glued to letters ("7ish", "7th", "_7_") still read as the digit run

/** Every number in the text, as cardinals (digits, words, plurals) and word ordinals. */
function scan(text: string): Word[] {
  const s = text.normalize("NFKC").toLowerCase();
  const toks = [...s.matchAll(TOKEN_RE)].map((m) => ({ t: m[0], start: m.index!, end: m.index! + m[0].length }));
  const out: Word[] = [];
  for (let i = 0; i < toks.length; i++) {
    const { t, end } = toks[i]!;
    if (/^\d/.test(t)) {
      out.push({ value: Number(t), ordinal: false });
      continue;
    }
    const w = wordNumber(t);
    if (!w) continue;
    const next = toks[i + 1];
    const gap = next ? s.slice(end, next.start) : "";
    // "twenty-seven", "forty seventh", "twenty_one"
    if (next && TENS.includes(t) && /^[-\s_]+$/.test(gap)) {
      const unit = wordNumber(next.t);
      if (unit && unit.value >= 1 && unit.value <= 9) {
        out.push({ value: w.value + unit.value, ordinal: unit.ordinal });
        i++;
        continue;
      }
    }
    // "one hundred", "one dozen" are 100 and 12, not 1 and 100
    if (next && t === "one" && (next.t === "hundred" || next.t === "dozen") && /^[\s_]+$/.test(gap)) continue;
    out.push(w);
  }
  return out;
}

/** Digit runs and number words (zero to ninety, plurals, compounds, hundred, dozen) as their value; whole words only.
 * Ordinal words are left out: they are sequencing words ("first", "second"), see `ordinalsIn`. */
export function numbersIn(text: string): number[] {
  return scan(text).filter((w) => !w.ordinal).map((w) => w.value);
}

/** Ordinal words ("seventh", "twenty-first", "twelfth") as their value. */
export function ordinalsIn(text: string): number[] {
  return scan(text).filter((w) => w.ordinal).map((w) => w.value);
}

/** A number in a form the other checks cannot read: spelled out letter by letter ("s-e-v-e-n"),
 * a Roman numeral from II to C, or a digit from another script ("٧"). */
const SPELLED_RE = /(?<![\p{L}\p{N}])\p{L}(?:[\s.,\-_·•*]+\p{L}){2,}(?![\p{L}\p{N}])/u;
const ROMAN_RE = /^(?:c|(?:xc|xl|l?x{0,3})(?:ix|iv|v?i{0,3}))$/i;
function hasNumberForm(say: string): boolean {
  if (SPELLED_RE.test(say)) return true;
  if (/[^0-9]/u.test(say.replace(/[^\p{Nd}]/gu, ""))) return true; // a decimal digit NFKC left non-ASCII
  for (const m of say.matchAll(/\p{L}+/gu)) if (m[0].length >= 2 && ROMAN_RE.test(m[0])) return true;
  return false;
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
  const re = /\p{L}+(?:'\p{L}+)?/gu; // Unicode-aware: "Émile" and "Zoë" are names too
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const word = m[0];
    if (!/^\p{Lu}/u.test(word)) continue;
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
  if (hasNumberForm(say)) return { ok: false, reason: "number-form" };
  const allowed = new Set<number>([...plan.problemNumbers, plan.answer]);
  if (plan.kidAnswer !== undefined) allowed.add(plan.kidAnswer);
  const spoken = numbersIn(say);
  if (spoken.some((n) => !allowed.has(n))) return { ok: false, reason: "numbers" };

  const mayReveal = !HIDES_ANSWER.has(plan.event) && (plan.event !== "explain" || plan.revealed === true);
  // Ordinals are sequencing words ("first", "the second group"), so only the answer is held back from them.
  const leaks = [...spoken, ...ordinalsIn(say)];
  if (!mayReveal && leaks.includes(plan.answer) && !plan.problemNumbers.includes(plan.answer))
    return { ok: false, reason: "early-answer" };
  // After two wrong tries the kid is told the answer (spec §7): a revealed explain that leaves it out fails.
  if (plan.event === "explain" && plan.revealed === true && !spoken.includes(plan.answer))
    return { ok: false, reason: "missing-answer" };

  const max = plan.ageBand === "5-7" ? 25 : 40;
  if (wordCount(say) > max) return { ok: false, reason: "length" };
  if (hasBlocked(say)) return { ok: false, reason: "word" };
  if (/[{}]/.test(say.replace(/\{name\}/g, ""))) return { ok: false, reason: "placeholder" };
  if (nameProblem(say)) return { ok: false, reason: "name" };
  return { ok: true };
}
