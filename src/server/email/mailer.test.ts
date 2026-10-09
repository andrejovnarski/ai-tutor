import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("server-only", () => ({}));
const { getMailer, mailpitMailer } = await import("./mailer");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("mailpitMailer", () => {
  it("posts the message to Mailpit's send API", async () => {
    vi.stubEnv("EMAIL_FROM", "Math Friend <hello@localhost>");
    vi.stubEnv("MAILPIT_URL", "");
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await mailpitMailer.send({ to: "p@x.dev", subject: "S", text: "T", html: "<b>H</b>" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:54324/api/v1/send");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(Object.keys(body).sort()).toEqual(["From", "HTML", "Subject", "Text", "To"]);
    expect(body.To).toEqual([{ Email: "p@x.dev" }]);
    expect(body.From.Email).toBe("hello@localhost");
    expect(body).toMatchObject({ Subject: "S", Text: "T", HTML: "<b>H</b>" });
  });

  it("throws when Mailpit rejects", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500 })));
    await expect(mailpitMailer.send({ to: "a@b.c", subject: "", text: "", html: "" })).rejects.toThrow();
  });
});

describe("getMailer", () => {
  it("refuses mailpit in production", () => {
    vi.stubEnv("MAILER", "mailpit");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(() => getMailer()).toThrow();
  });
  it("returns mailpit elsewhere", () => {
    vi.stubEnv("MAILER", "mailpit");
    vi.stubEnv("VERCEL_ENV", "development");
    expect(getMailer()).toBe(mailpitMailer);
  });
});
