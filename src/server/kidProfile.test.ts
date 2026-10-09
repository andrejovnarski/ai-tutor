import { ageBandFor, AVATARS, parseKidProfile } from "./kidProfile";

const parse = (nickname: unknown, grade: unknown = "K", avatar: unknown = "fox") =>
  parseKidProfile({ nickname, grade, avatar });

describe("parseKidProfile", () => {
  it("trims the nickname", () => {
    expect(parse("  Mia ")).toEqual({ ok: true, value: { nickname: "Mia", grade: "K", avatar: "fox" } });
  });

  it.each(["José", "Anne-Marie", "O'Neil", "Sam Smith"])("accepts %s", (name) => {
    expect(parse(name).ok).toBe(true);
  });

  it.each(["", "   ", "A".repeat(21), "<script>", "<b>x</b>", "Mia😀", "Mia2"])("rejects %j", (name) => {
    const r = parse(name);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.nickname).toMatch(/first name/i);
  });

  it("accepts exactly 20 letters", () => {
    expect(parse("A".repeat(20)).ok).toBe(true);
  });

  it("rejects non-string input", () => {
    expect(parse(undefined).ok).toBe(false);
  });

  it("rejects a bad grade or avatar", () => {
    const g = parse("Mia", "6");
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.errors.grade).toBeTruthy();
    const a = parse("Mia", "K", "dragon");
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.errors.avatar).toBeTruthy();
  });

  it("lists the eight avatars", () => {
    expect([...AVATARS]).toEqual(["fox", "bear", "owl", "frog", "duck", "rabbit", "cat", "turtle"]);
  });
});

describe("ageBandFor", () => {
  it.each([["K", "5-7"], ["1", "5-7"], ["2", "5-7"], ["3", "8-11"], ["4", "8-11"], ["5", "8-11"]] as const)(
    "grade %s -> %s",
    (g, band) => expect(ageBandFor(g)).toBe(band),
  );
});
