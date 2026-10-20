import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteTestUsers } from "./cleanup";

const { createClient, listUsers, deleteUser } = vi.hoisted(() => ({
  createClient: vi.fn(), listUsers: vi.fn(), deleteUser: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

afterEach(() => vi.unstubAllEnvs());

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
  createClient.mockReturnValue({ auth: { admin: { listUsers, deleteUser } } });
  deleteUser.mockResolvedValue({ error: null });
});

const page = (users: { id: string; email?: string }[]) => ({ data: { users }, error: null });

describe("deleteTestUsers", () => {
  it.each(["https://remote.supabase.co", "http://localhost.evil.test", "invalid", ""])(
    "refuses non-local URL %s before creating a client", async (url) => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
      await expect(deleteTestUsers("@example.com")).rejects.toThrow("local Supabase stack");
      expect(createClient).not.toHaveBeenCalled();
    },
  );

  it.each(["127.0.0.1", "localhost"])("accepts %s and deletes only exact suffix matches", async (host) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `http://${host}:54321`);
    listUsers.mockResolvedValueOnce(page([
      { id: "match", email: "parent@example.com" },
      { id: "other", email: "parent@test.dev" },
      { id: "near", email: "parent@example.com.evil" },
      { id: "missing" },
    ])).mockResolvedValueOnce(page([]));
    await deleteTestUsers("@example.com");
    expect(deleteUser.mock.calls).toEqual([["match"]]);
    expect(createClient).toHaveBeenCalledWith(`http://${host}:54321`, "test-secret", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  it("walks full non-test pages and restarts page 1 after deletions shift users", async () => {
    const others = Array.from({ length: 200 }, (_, i) => ({ id: `other-${i}`, email: "other@real.dev" }));
    listUsers.mockResolvedValueOnce(page(others)).mockResolvedValueOnce(page(others))
      .mockResolvedValueOnce(page([{ id: "match", email: "old@test.dev" }]))
      .mockResolvedValueOnce(page(others)).mockResolvedValueOnce(page([]));
    await deleteTestUsers("@test.dev");
    expect(listUsers.mock.calls.map(([args]) => args)).toEqual(
      [1, 2, 3, 1, 2].map((n) => ({ page: n, perPage: 200 })),
    );
    expect(deleteUser.mock.calls).toEqual([["match"]]);
  });

  it("stops on listing errors", async () => {
    const error = new Error("list failed");
    listUsers.mockResolvedValue({ error });
    await expect(deleteTestUsers("@test.dev")).rejects.toThrow(error);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("stops on deletion errors instead of looping", async () => {
    const error = new Error("delete failed");
    listUsers.mockResolvedValue(page([{ id: "match", email: "old@test.dev" }]));
    deleteUser.mockResolvedValue({ error });
    await expect(deleteTestUsers("@test.dev")).rejects.toThrow(error);
    expect(listUsers).toHaveBeenCalledTimes(1);
  });
});
