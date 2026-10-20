import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("./supabase", () => ({ createServerSupabase: vi.fn() }));
vi.mock("./retention", () => ({ touchActivity: vi.fn() }));
import { createServerSupabase } from "./supabase";
import { touchActivity } from "./retention";
import { SupabaseRepo } from "./persist/supabaseRepo";
import { parentRepo } from "./playApi";

const getClaims = vi.fn();
const getUser = vi.fn();
const client = { auth: { getClaims, getUser } };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createServerSupabase).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createServerSupabase>>);
  getUser.mockResolvedValue({ data: { user: { id: "parent-id" } }, error: null });
});

describe("parentRepo", () => {
  it.each([
    { data: null, error: null },
    { data: null, error: new Error("invalid token") },
    { data: { claims: { sub: "parent-id" } }, error: new Error("invalid token") },
  ])("returns null without touching activity when claims are missing or an error exists: %j", async (result) => {
    getClaims.mockResolvedValue(result);
    expect(await parentRepo()).toBeNull();
    expect(getClaims).toHaveBeenCalledExactlyOnceWith();
    expect(getUser).not.toHaveBeenCalled();
    expect(touchActivity).not.toHaveBeenCalled();
  });

  it("returns a repo using the caller's client and touches activity when claims exist", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "parent-id" } }, error: null });
    const repo = await parentRepo();
    expect(repo).toBeInstanceOf(SupabaseRepo);
    expect(repo?.client).toBe(client);
    expect(getClaims).toHaveBeenCalledExactlyOnceWith();
    expect(getUser).not.toHaveBeenCalled();
    expect(touchActivity).toHaveBeenCalledExactlyOnceWith(client);
  });
});
