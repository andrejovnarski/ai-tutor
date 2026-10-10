import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { forKid } from "../playApi";
import { allCannedSays } from "../tutor/canned";

const KID = "00000000-0000-4000-8000-000000000001";

describe("forKid: the name never reaches the voice", () => {
  beforeAll(() => { vi.stubEnv("SPEECH", "fake"); vi.stubEnv("SPEECH_TOKEN_SECRET", "test-secret"); });
  afterAll(() => vi.unstubAllEnvs());

  it("every canned template (answer filled) is voiced without the nickname, and shown with it", () => {
    const templates = allCannedSays();
    expect(templates.length).toBeGreaterThan(10);
    let named = 0;
    for (const t of templates) {
      const out = forKid({ say: t.replaceAll("{answer}", "7"), tone: "calm" }, "Ann", KID);
      expect(out.speech, t).toBeDefined();
      expect(out.speech!.text, t).not.toMatch(/ann/i);
      if (t.includes("{name}")) { named++; expect(out.say).toContain("Ann"); }
    }
    expect(named).toBeGreaterThan(0);
  });

  it("a line that already spells the nickname (a Claude line) is shown but not voiced", () => {
    const out = forKid({ say: "Great job, ann! Let's count.", tone: "cheer" }, "Ann", KID);
    expect(out.say).toBe("Great job, ann! Let's count.");
    expect(out.speech).toBeUndefined();
  });

  it("the nickname inside another word does not count; no nickname means always voiced", () => {
    expect(forKid({ say: "Count the bananas, {name}.", tone: "calm" }, "Ann", KID).speech?.text).toBe("Count the bananas.");
    expect(forKid({ say: "Hi Zoë!", tone: "calm" }, "Zoë", KID).speech).toBeUndefined();
    expect(forKid({ say: "Hi Ann!", tone: "calm" }, null, KID).speech).toBeDefined();
  });
});
