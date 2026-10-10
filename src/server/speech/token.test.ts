import { checkSpeechToken, speechToken } from "./token";

describe("speech token", () => {
  const t = speechToken("s3cret", "kid-1", "Hello there!");
  it("round trips", () => expect(checkSpeechToken("s3cret", "kid-1", "Hello there!", t)).toBe(true));
  it("rejects changed text", () => expect(checkSpeechToken("s3cret", "kid-1", "Hello there", t)).toBe(false));
  it("rejects changed kid", () => expect(checkSpeechToken("s3cret", "kid-2", "Hello there!", t)).toBe(false));
  it("rejects wrong secret", () => expect(checkSpeechToken("other", "kid-1", "Hello there!", t)).toBe(false));
  it("rejects garbage without throwing", () => {
    for (const g of ["", "x", "!!!", "abc", "a".repeat(500), t + "A"]) {
      expect(checkSpeechToken("s3cret", "kid-1", "Hello there!", g)).toBe(false);
    }
  });
});
