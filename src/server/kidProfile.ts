import type { KidGrade } from "@/domain/kid/types";
import type { AgeBand } from "@/domain/types";

export const AVATARS = ["fox", "bear", "owl", "frog", "duck", "rabbit", "cat", "turtle"] as const;
export type Avatar = (typeof AVATARS)[number];

export const GRADES: readonly KidGrade[] = ["K", "1", "2", "3", "4", "5"];

export type KidProfile = { nickname: string; grade: KidGrade; avatar: Avatar };
type Field = "nickname" | "grade" | "avatar";

export const KID_ERRORS: Record<Field, string> = {
  nickname: "Use a first name only: 1 to 20 letters (spaces, hyphens and apostrophes are fine).",
  grade: "Pick a grade.",
  avatar: "Pick an avatar.",
};

// Letters (with combining marks) first, then letters, marks, space, hyphen, apostrophe.
const NICKNAME = /^\p{L}[\p{L}\p{M} '’-]*$/u;

export function parseKidProfile(
  input: unknown,
): { ok: true; value: KidProfile } | { ok: false; errors: Record<Field, string> } {
  const raw = (input ?? {}) as Record<string, unknown>;
  const nickname = typeof raw.nickname === "string" ? raw.nickname.trim() : "";
  const nicknameOk = [...nickname].length <= 20 && NICKNAME.test(nickname);
  const gradeOk = typeof raw.grade === "string" && (GRADES as readonly string[]).includes(raw.grade);
  const avatarOk = typeof raw.avatar === "string" && (AVATARS as readonly string[]).includes(raw.avatar);
  if (nicknameOk && gradeOk && avatarOk) {
    return { ok: true, value: { nickname, grade: raw.grade as KidGrade, avatar: raw.avatar as Avatar } };
  }
  return {
    ok: false,
    errors: {
      nickname: nicknameOk ? "" : KID_ERRORS.nickname,
      grade: gradeOk ? "" : KID_ERRORS.grade,
      avatar: avatarOk ? "" : KID_ERRORS.avatar,
    },
  };
}

export function ageBandFor(grade: KidGrade): AgeBand {
  return grade === "K" || grade === "1" || grade === "2" ? "5-7" : "8-11";
}
