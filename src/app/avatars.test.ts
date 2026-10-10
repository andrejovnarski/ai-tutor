import { AVATARS } from "@/server/kidProfile";
import { AVATAR_COLOR, AVATAR_FACE, colorOf, faceOf } from "./avatars";
it("has a face and a tab colour for every avatar", () => {
  for (const a of AVATARS) { expect(AVATAR_FACE[a]).toBeTruthy(); expect(AVATAR_COLOR[a]).toMatch(/^#[0-9a-f]{6}$/); }
  expect(AVATAR_COLOR.fox).toBe("#e4413b"); expect(AVATAR_COLOR.turtle).toBe("#3b7dd8");
});
it("falls back for an unknown avatar", () => { expect(faceOf("yeti")).toBe("yeti"); expect(colorOf("yeti")).toBe("#2e6b5e"); });
