import { DISTRESS_PHRASES } from "./phrases";

export type Distress = { hit: false } | { hit: true; phrase: string };

/** Lower-cases, turns non-letters into spaces, collapses whitespace, then matches whole phrases on word boundaries. */
export function detectDistress(text: string): Distress {
  const norm = ` ${text.toLowerCase().replace(/[^a-z]+/g, " ").trim()} `;
  const phrase = DISTRESS_PHRASES.find((p) => norm.includes(` ${p} `));
  return phrase ? { hit: true, phrase } : { hit: false };
}
