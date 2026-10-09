import type { Icon } from "../types";

export const ANIMALS = ["Fox", "Bear", "Owl", "Frog", "Duck", "Rabbit"] as const;

export const ITEMS: { word: string; icon: Icon }[] = [
  { word: "apples", icon: "apple" },
  { word: "stars", icon: "star" },
  { word: "fish", icon: "fish" },
  { word: "balls", icon: "ball" },
  { word: "shells", icon: "shell" },
  { word: "blocks", icon: "block" },
  { word: "cookies", icon: "cookie" },
];
