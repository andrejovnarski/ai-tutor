import { allCannedSays } from "../tutor/canned";
import { DISTRESS_REPLY } from "../distress/phrases";
import { speakable } from "./speakable";

/** Fixed tablet copy that Nova speaks (no numbers). */
const TABLET_COPY = [
  "Let's try again.",
  "I didn't catch that. Try again or tap your answer.",
  "I couldn't hear. Tap your answer.",
];

/** Unique texts worth pre-rendering: canned lines without {answer}, the distress reply and the tablet copy. */
export function premakeList(): string[] {
  const texts = allCannedSays()
    .filter((s) => !s.includes("{answer}"))
    .map(speakable);
  return [...new Set([...texts, DISTRESS_REPLY, ...TABLET_COPY])];
}
