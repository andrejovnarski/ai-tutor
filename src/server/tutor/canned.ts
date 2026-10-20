import type { AgeBand } from "@/domain/types";
import type { TutorEvent, TutorLine, TurnPlan } from "./types";

type Tone = TutorLine["tone"];
type Entry = { say: string; tone: Tone; show?: TutorLine["show"] };
const e = (tone: Tone, say: string, show?: TutorLine["show"]): Entry => ({ say, tone, ...(show ? { show } : {}) });

// Canned lines never speak a number except {answer}, and {answer} only for correct and explain.
// Avoid the word "one" (it reads as the number 1) and any capital that is not a sentence start.
const TABLE: Record<TutorEvent, Record<AgeBand, Entry[]>> = {
  present: {
    "5-7": [
      e("curious", "Look at this, {name}! What do you think?"),
      e("cheer", "Here we go, {name}! Take your time.", "highlight-numbers"),
      e("calm", "Let's look together. What do you see?", "count-along"),
      e("curious", "Hmm, a puzzle for us! Ready, {name}?"),
    ],
    "8-11": [
      e("curious", "Here's a new puzzle, {name}. Read it carefully, then give it a go."),
      e("calm", "Take a look at this problem. What is it asking you to find?", "highlight-numbers"),
      e("cheer", "Ready for this, {name}? Think it through, and take your time."),
      e("curious", "Let's see how you tackle this problem. Where would you start?"),
    ],
  },
  correct: {
    "5-7": [
      e("cheer", "Yes! It's {answer}! Great thinking, {name}!", "sparkle"),
      e("cheer", "You got it! {answer} is right!", "sparkle"),
      e("cheer", "Woohoo! {answer}! Nova is so happy!", "sparkle"),
      e("cheer", "That's it, {name}! {answer}!"),
    ],
    "8-11": [
      e("cheer", "Correct, {name}! The answer is {answer}. Nicely reasoned!", "sparkle"),
      e("cheer", "Yes, {answer} is right. Great work!", "sparkle"),
      e("cheer", "That's it! {answer}. Your thinking paid off, {name}."),
      e("cheer", "Spot on! {answer} is exactly right.", "sparkle"),
    ],
  },
  wrong: {
    "5-7": [
      e("calm", "Not quite yet, {name}. Let's try again together!"),
      e("calm", "Good try! Let's look again.", "count-along"),
      e("calm", "Oops, close! Mistakes help us learn. Try again?"),
      e("calm", "Thank you for trying, {name}! Let's take another look."),
    ],
    "8-11": [
      e("calm", "Not quite, {name}, but that's okay. Let's look at it another way."),
      e("calm", "Good effort. Check your steps again and have another go.", "highlight-numbers"),
      e("calm", "Mistakes are how we learn. Take another look at the problem."),
      e("calm", "Almost there, {name}. Let's go back through it step by step."),
    ],
  },
  // A hint follows a finished placement problem: a new problem is already on screen, so it is a calm move-on with
  // no clue, no cue and nothing about the old problem.
  hint: {
    "5-7": [
      e("calm", "Good try, {name}. Let's look at a new puzzle."),
      e("calm", "Thanks for trying! Here comes a new puzzle."),
      e("calm", "Nice effort, {name}. On to the next puzzle!"),
      e("calm", "You gave it a go! Let's see what's next."),
    ],
    "8-11": [
      e("calm", "Good try, {name}. Let's move on to a new problem."),
      e("calm", "Thanks for giving that a go. Here's a fresh problem."),
      e("calm", "Nice effort, {name}. Let's see what comes next."),
      e("calm", "That's okay, {name}. On to the next problem."),
    ],
  },
  help: {
    "5-7": [
      e("calm", "Let's look together. Touch each part as you count.", "count-along"),
      e("calm", "I'm here, {name}. Look at the picture and count slowly.", "count-along"),
      e("calm", "Let's take a small step. What can you count in the picture?"),
      e("calm", "Try pointing as you count, {name}. Take your time."),
      e("calm", "Let's look at what the problem asks. Which parts will you use?", "highlight-numbers"),
      e("calm", "We can work together. Look closely at each part of the picture."),
    ],
    "8-11": [
      e("calm", "Let's work through it together. Start by checking what the problem asks.", "highlight-numbers"),
      e("calm", "Take your time, {name}. Use the picture to keep track of your steps."),
      e("calm", "Let's break the problem into small steps. Where could you begin?"),
      e("calm", "Look at each part of the picture. What does it tell you?"),
      e("calm", "I'm here to help. Try pointing to each part as you work through it."),
      e("calm", "Let's read the problem again and look for the parts we need.", "highlight-numbers"),
    ],
  },
  explain: {
    "5-7": [
      e("calm", "Let's count it together. The answer is {answer}.", "count-along"),
      e("calm", "Look at the picture with me. We get {answer}!", "show-style"),
      e("cheer", "Here's how it works, {name}. It makes {answer}!"),
      e("calm", "Nova will show you. The answer is {answer}.", "count-along"),
    ],
    "8-11": [
      e("calm", "Let's walk through it together. The answer is {answer}.", "show-style"),
      e("calm", "Here's how it works, {name}: the answer is {answer}.", "highlight-numbers"),
      e("cheer", "Let me show you the steps. That gives us {answer}."),
      e("calm", "Follow along with Nova. We end up with {answer}.", "count-along"),
    ],
  },
  celebrate: {
    "5-7": [
      e("cheer", "Hooray, {name}! You worked so hard!", "sparkle"),
      e("cheer", "You are a star! Nova is so proud!", "sparkle"),
      e("cheer", "Yay! What a great job!", "sparkle"),
      e("cheer", "Super, {name}! You did it!", "sparkle"),
    ],
    "8-11": [
      e("cheer", "Fantastic work, {name}! You should be proud.", "sparkle"),
      e("cheer", "Nova is impressed. You kept going and it shows!", "sparkle"),
      e("cheer", "Great session, {name}! Your effort really counts.", "sparkle"),
      e("cheer", "That was great thinking! Keep it up.", "sparkle"),
    ],
  },
  "kid-said": {
    "5-7": [
      e("calm", "Thanks for telling me, {name}! Let's keep going."),
      e("cheer", "I hear you! Let's try together."),
      e("calm", "Okay, {name}! Nova is right here with you."),
      e("curious", "Got it! Shall we try the next step?"),
    ],
    "8-11": [
      e("calm", "Thanks for telling me, {name}. Let's keep going together."),
      e("calm", "I hear you. Let's go step by step."),
      e("cheer", "Good to know, {name}. Nova is here to help."),
      e("curious", "Okay! Want to take another look at the problem together?"),
    ],
  },
};

// Without an answer, an unrevealed explain must not speak it.
const EXPLAIN_HIDDEN: Record<AgeBand, Entry[]> = {
  "5-7": [
    e("calm", "Let's count it together, {name}.", "count-along"),
    e("calm", "Look at the picture with me. What do you see?", "show-style"),
    e("cheer", "Let's go step by step. Nova is here!"),
  ],
  "8-11": [
    e("calm", "Let's walk through it together, {name}.", "show-style"),
    e("calm", "Look at the key numbers and take it step by step.", "highlight-numbers"),
    e("cheer", "Let's break it into steps. Nova will help."),
  ],
};

export function cannedLine(plan: TurnPlan, seed: number): TutorLine {
  const n = Number.isFinite(seed) ? Math.trunc(seed) : 0;
  const hide = plan.event === "explain" && plan.revealed !== true;
  const list = hide ? EXPLAIN_HIDDEN[plan.ageBand] : TABLE[plan.event][plan.ageBand];
  const entry = list[((n % list.length) + list.length) % list.length]!;
  return { ...entry, say: entry.say.replaceAll("{answer}", String(plan.answer)) };
}

/** Every canned `say` template, unfilled ({name} and {answer} left in). */
export function allCannedSays(): string[] {
  const out: string[] = [];
  for (const byBand of Object.values(TABLE)) for (const list of Object.values(byBand)) for (const x of list) out.push(x.say);
  for (const list of Object.values(EXPLAIN_HIDDEN)) for (const x of list) out.push(x.say);
  return out;
}
