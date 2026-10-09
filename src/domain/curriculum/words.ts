import type { Icon } from "../types";

export const ANIMALS = ["Fox", "Bear", "Owl", "Frog", "Duck", "Rabbit"] as const;

export const ITEMS: { word: string; one: string; icon: Icon }[] = [
  { word: "apples", one: "apple", icon: "apple" },
  { word: "stars", one: "star", icon: "star" },
  { word: "fish", one: "fish", icon: "fish" },
  { word: "balls", one: "ball", icon: "ball" },
  { word: "shells", one: "shell", icon: "shell" },
  { word: "blocks", one: "block", icon: "block" },
  { word: "cookies", one: "cookie", icon: "cookie" },
];

/** "1 apple", "3 apples". */
export const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
