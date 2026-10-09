import { vi, afterEach } from "vitest";

vi.mock("server-only", () => ({}));
process.env.PARENT_COOKIE_SECRET = "test-secret-test-secret-test-secret";
process.env.APP_ORIGIN = "http://localhost:3000";

const { fakeGateway, stripeGateway, getConsentGateway } = await import("./gateway");

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";

describe("fakeGateway", () => {
  const idOf = async (parent: string) => {
    const { redirectUrl } = await fakeGateway.start(parent, "http://x/parent/consent/return");
    expect(redirectUrl.startsWith("/parent/consent/return?session_id=")).toBe(true);
    return new URL(redirectUrl, "http://x").searchParams.get("session_id")!;
  };

  it("accepts its own start id", async () => {
    const id = await idOf(A);
    expect(await fakeGateway.verify(id)).toEqual({ ok: true, parentId: A, ref: id, method: "fake" });
  });

  it("rejects a tampered HMAC", async () => {
    const id = await idOf(A);
    const bad = id.slice(0, -1) + (id.endsWith("0") ? "1" : "0");
    expect(await fakeGateway.verify(bad)).toEqual({ ok: false });
  });

  it("rejects another parent's id with A's HMAC", async () => {
    const id = await idOf(A);
    const swapped = id.replace(A, B);
    expect(await fakeGateway.verify(swapped)).toEqual({ ok: false });
  });

  it("rejects garbage", async () => {
    expect(await fakeGateway.verify("garbage")).toEqual({ ok: false });
  });
});

function stubClient(session: unknown) {
  return {
    checkout: { sessions: { retrieve: vi.fn().mockResolvedValue(session), create: vi.fn().mockResolvedValue({ url: "https://stripe.test/pay" }) } },
    paymentMethods: { detach: vi.fn().mockResolvedValue({}) },
  };
}

describe("stripeGateway", () => {
  it("start creates a setup-mode session", async () => {
    const c = stubClient({});
    const r = await stripeGateway(c as never).start(A, "http://localhost:3000/parent/consent/return");
    expect(r.redirectUrl).toBe("https://stripe.test/pay");
    expect(c.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "setup",
        currency: "usd",
        customer_creation: "if_required",
        allowed_payment_method_types: ["card"],
        metadata: { parent_id: A },
        success_url: "http://localhost:3000/parent/consent/return?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "http://localhost:3000/parent/consent?cancelled=1",
      }),
    );
  });

  it("rejects an open session", async () => {
    const c = stubClient({ id: "cs_1", status: "open", metadata: { parent_id: A }, setup_intent: { status: "succeeded", payment_method: "pm_1" }, customer: "cus_1" });
    expect(await stripeGateway(c as never).verify("cs_1")).toEqual({ ok: false });
    expect(c.paymentMethods.detach).not.toHaveBeenCalled();
  });

  it("rejects a setup intent that did not succeed", async () => {
    const c = stubClient({ id: "cs_1", status: "complete", metadata: { parent_id: A }, setup_intent: { status: "requires_payment_method", payment_method: null }, customer: null });
    expect(await stripeGateway(c as never).verify("cs_1")).toEqual({ ok: false });
  });

  it("accepts a complete session and detaches the card once", async () => {
    const c = stubClient({ id: "cs_1", status: "complete", metadata: { parent_id: A }, customer: "cus_1", setup_intent: { status: "succeeded", payment_method: "pm_1" } });
    expect(await stripeGateway(c as never).verify("cs_1")).toEqual({ ok: true, parentId: A, ref: "cs_1", method: "stripe" });
    expect(c.checkout.sessions.retrieve).toHaveBeenCalledWith("cs_1", { expand: ["setup_intent"] });
    expect(c.paymentMethods.detach).toHaveBeenCalledTimes(1);
    expect(c.paymentMethods.detach).toHaveBeenCalledWith("pm_1");
  });

  it("returns not ok when Stripe throws", async () => {
    const c = stubClient({});
    c.checkout.sessions.retrieve.mockRejectedValue(new Error("no such session"));
    expect(await stripeGateway(c as never).verify("cs_x")).toEqual({ ok: false });
  });
});

describe("getConsentGateway", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("refuses the fake gateway in production and on Vercel previews", () => {
    vi.stubEnv("CONSENT_GATEWAY", "fake");
    for (const v of ["production", "preview"]) {
      vi.stubEnv("VERCEL_ENV", v);
      expect(() => getConsentGateway()).toThrow();
    }
  });
  it("allows the fake gateway in Vercel development or off Vercel", () => {
    vi.stubEnv("CONSENT_GATEWAY", "fake");
    vi.stubEnv("VERCEL_ENV", "development");
    expect(getConsentGateway()).toBe(fakeGateway);
    vi.stubEnv("VERCEL_ENV", undefined);
    expect(getConsentGateway()).toBe(fakeGateway);
  });
});
