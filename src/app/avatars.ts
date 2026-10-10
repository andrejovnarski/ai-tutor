import type { Avatar } from "@/server/kidProfile";

export const AVATAR_FACE: Record<Avatar, string> = {
  fox: "🦊", bear: "🐻", owl: "🦉", frog: "🐸", duck: "🦆", rabbit: "🐰", cat: "🐱", turtle: "🐢",
};

export const AVATAR_COLOR: Record<Avatar, string> = {
  fox: "#e4413b", bear: "#a0673a", owl: "#8a6bbf", frog: "#4c9a52",
  duck: "#f6c531", rabbit: "#e88fb0", cat: "#ef8a2f", turtle: "#3b7dd8",
};

const FELT = "#2e6b5e";

export function faceOf(avatar: string): string {
  return (AVATAR_FACE as Record<string, string>)[avatar] ?? avatar;
}

export function colorOf(avatar: string): string {
  return (AVATAR_COLOR as Record<string, string>)[avatar] ?? FELT;
}
