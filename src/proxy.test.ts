import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { proxy } from "./proxy";

vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }));
const getClaims = vi.fn();
const getUser = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createServerClient).mockReturnValue({ auth: { getClaims, getUser } } as unknown as ReturnType<typeof createServerClient>);
});

it.each([
  { data: { claims: { sub: "parent-id" } }, error: null },
  { data: null, error: null },
  { data: null, error: new Error("invalid token") },
])("checks claims without calling getUser and continues the request: %j", async (result) => {
  getClaims.mockResolvedValue(result);
  const response = await proxy(new NextRequest("https://example.com/play"));
  expect(getClaims).toHaveBeenCalledExactlyOnceWith();
  expect(getUser).not.toHaveBeenCalled();
  expect(response.headers.get("x-middleware-next")).toBe("1");
});

it("forwards refreshed cookies to the request and response during the claims check", async () => {
  const request = new NextRequest("https://example.com/play", { headers: { cookie: "session=old" } });
  getClaims.mockImplementation(async () => {
    const options = vi.mocked(createServerClient).mock.calls[0]![2];
    expect(options.cookies.getAll!()).toEqual([{ name: "session", value: "old" }]);
    await options.cookies.setAll!([{ name: "session", value: "refreshed", options: { httpOnly: true, path: "/" } }], {});
    return { data: { claims: { sub: "parent-id" } }, error: null };
  });
  const response = await proxy(request);
  expect(request.cookies.get("session")?.value).toBe("refreshed");
  expect(response.cookies.get("session")).toMatchObject({ value: "refreshed", httpOnly: true, path: "/" });
  expect(getUser).not.toHaveBeenCalled();
});
