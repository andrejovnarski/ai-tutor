const UNITS: Record<string, number> = {
  zero: 0, none: 0, nothing: 0, one: 1, two: 2, three: 3, four: 4,
  five: 5, six: 6, seven: 7, eight: 8, nine: 9,
};
const TEENS: Record<string, number> = {
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
/** Speech-to-text mishears, trusted only when they are the whole answer. */
const HOMOPHONES: Record<string, number> = { to: 2, too: 2, for: 4, won: 1, ate: 8 };
const FILLER = new Set(["um", "umm", "uh", "uhh", "er", "erm", "hmm", "its", "it", "is", "i", "think", "the", "answer", "so", "like", "ok", "okay"]);

type Tok =
  | { k: "unit"; v: number; single: true }
  | { k: "digits"; v: number; single: boolean }
  | { k: "teen"; v: number }
  | { k: "tens"; v: number }
  | { k: "hundred" }
  | { k: "and" }
  | { k: "word"; w: string };

function classify(w: string): Tok {
  if (/^\d+$/.test(w)) return { k: "digits", v: Number(w), single: w.length === 1 };
  if (w in UNITS) return { k: "unit", v: UNITS[w]!, single: true };
  if (w in TEENS) return { k: "teen", v: TEENS[w]! };
  if (w in TENS) return { k: "tens", v: TENS[w]! };
  if (w === "hundred") return { k: "hundred" };
  if (w === "and") return { k: "and" };
  return { k: "word", w };
}

const isNum = (t: Tok | undefined): boolean => !!t && t.k !== "word" && t.k !== "and";
const singleDigit = (t: Tok): boolean => (t.k === "unit" || t.k === "digits") && t.single;

/** Parses one run of number tokens into the numbers it says ("twenty three" → [23], "one two" → [12]). */
function parseRun(run: Tok[]): number[] {
  if (run.length === 2 && run.every(singleDigit)) {
    return [(run[0] as { v: number }).v * 10 + (run[1] as { v: number }).v];
  }
  const out: number[] = [];
  let i = 0;
  while (i < run.length) {
    let n = 0;
    let used = false;
    const t = run[i]!;
    if (t.k === "hundred") {
      n = 100; i += 1; used = true;
    } else if ((t.k === "unit" || t.k === "digits") && run[i + 1]?.k === "hundred") {
      n = t.v * 100; i += 2; used = true;
    }
    if (used && run[i]?.k === "and") i += 1;
    const a = run[i];
    if (a?.k === "tens") {
      n += a.v; i += 1;
      const b = run[i];
      if (b?.k === "unit" && b.v > 0) { n += b.v; i += 1; }
    } else if (a && (a.k === "teen" || a.k === "unit" || a.k === "digits")) {
      n += a.v; i += 1;
    } else if (!used) {
      i += 1; // stray "and": separates numbers
      continue;
    }
    out.push(n);
  }
  return out;
}

/** Turns a spoken or typed answer into a number, or null when there is none or it is ambiguous. */
export function parseSpokenNumber(text: string): number | null {
  let words = text.toLowerCase().replace(/-/g, " ").replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean);

  // Self-correction: keep only what follows the last marker.
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i];
    const twoWord = w === "mean" && words[i - 1] === "i";
    if (w === "no" || w === "wait" || w === "actually" || twoWord) {
      words = words.slice(i + 1);
      break;
    }
  }

  const toks = words.map(classify);
  const numbers: number[] = [];
  let run: Tok[] = [];
  const flush = () => { if (run.length) numbers.push(...parseRun(run)); run = []; };
  toks.forEach((t, i) => {
    const andInNumber = t.k === "and" && toks[i - 1]?.k === "hundred" && isNum(toks[i + 1]);
    if (isNum(t) || andInNumber) run.push(t);
    else flush(); // any other word, including "and" in "five and six", ends the number
  });
  flush();

  if (numbers.length === 1) return numbers[0]!;
  if (numbers.length > 1) return null;

  const meaningful = words.filter((w) => !FILLER.has(w));
  if (meaningful.length === 1 && meaningful[0]! in HOMOPHONES) return HOMOPHONES[meaningful[0]!]!;
  return null;
}
