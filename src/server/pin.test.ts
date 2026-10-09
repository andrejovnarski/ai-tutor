import { vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.PARENT_COOKIE_SECRET = "test-secret-test-secret-test-secret";

const { canResetPin, hashPin, isValidPin, nextLockState, signParentCookie, verifyParentCookie, verifyPin } =
  await import("./pin");

const MIN = 60_000;

describe("hashPin / verifyPin", () => {
  it("accepts the right PIN and rejects a wrong one", async () => {
    const { hash, salt } = await hashPin("1234");
    expect(await verifyPin("1234", hash, salt)).toBe(true);
    expect(await verifyPin("1235", hash, salt)).toBe(false);
  });

  it("salts: two hashes of the same PIN differ", async () => {
    const a = await hashPin("1234");
    const b = await hashPin("1234");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it("rejects garbage stored values instead of throwing", async () => {
    expect(await verifyPin("1234", "zz", "zz")).toBe(false);
  });
});

describe("isValidPin", () => {
  it.each(["1234", "0000"])("accepts %s", (p) => expect(isValidPin(p)).toBe(true));
  it.each(["123", "12a4", "12345", "", " 123"])("rejects %j", (p) => expect(isValidPin(p)).toBe(false));
});

describe("nextLockState", () => {
  it("counts failures without locking before the 5th", () => {
    expect(nextLockState(0, 1000)).toEqual({ failed: 1, lockedUntil: null });
    expect(nextLockState(3, 1000)).toEqual({ failed: 4, lockedUntil: null });
  });

  it("locks for 10 minutes on the 5th failure", () => {
    expect(nextLockState(4, 1000)).toEqual({ failed: 5, lockedUntil: 1000 + 10 * MIN });
  });
});

describe("parent cookie", () => {
  const now = 1_000_000;
  it("is valid at 14:59 and invalid at 15:01", () => {
    const c = signParentCookie("p1", now);
    expect(verifyParentCookie(c, "p1", now + 14 * MIN + 59_000)).toBe(true);
    expect(verifyParentCookie(c, "p1", now + 15 * MIN + 1000)).toBe(false);
  });

  it("is invalid for another parent", () => {
    expect(verifyParentCookie(signParentCookie("p1", now), "p2", now)).toBe(false);
  });

  it("is invalid when tampered with", () => {
    const c = signParentCookie("p1", now);
    const [exp, mac] = c.split(".");
    expect(verifyParentCookie(`${Number(exp) + 10 * MIN}.${mac}`, "p1", now)).toBe(false);
    expect(verifyParentCookie(`${exp}.${mac!.replace(/.$/, mac!.endsWith("0") ? "1" : "0")}`, "p1", now)).toBe(false);
    expect(verifyParentCookie("junk", "p1", now)).toBe(false);
    expect(verifyParentCookie("", "p1", now)).toBe(false);
  });
});

describe("canResetPin", () => {
  it("is true at 9 minutes and false at 11", () => {
    expect(canResetPin(0, 9 * MIN)).toBe(true);
    expect(canResetPin(0, 11 * MIN)).toBe(false);
  });
});
