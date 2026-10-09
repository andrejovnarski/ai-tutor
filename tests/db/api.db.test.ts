// Calls the play route handlers directly. Only createServerSupabase is swapped (for a client signed in as a chosen
// parent), so RLS, validation and the real SupabaseRepo are all exercised.
import { describe, it, expect, beforeAll, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { admin, anon, makeParent } from "../helpers/admin";
import { SupabaseRepo } from "../../src/server/persist/supabaseRepo";

const who = vi.hoisted(() => ({ client: null as unknown as SupabaseClient }));
vi.mock("server-only", () => ({}));
vi.mock("../../src/server/supabase", () => ({ createServerSupabase: async () => who.client }));

import { POST as turnPost } from "../../src/app/api/kids/[kidId]/turn/route";
import { POST as answerPost } from "../../src/app/api/kids/[kidId]/answer/route";

const run = Date.now();
let A: { userId: string; client: SupabaseClient };
let B: { userId: string; client: SupabaseClient };
let kidA: string;

const ctx = (kidId: string) => ({ params: Promise.resolve({ kidId }) });
const post = (body: unknown) => new Request("http://x/api", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });
const counts = async (kid: string) => ({
  attempts: (await admin().from("attempts").select("*", { count: "exact", head: true }).eq("kid_id", kid)).count,
  sessions: (await admin().from("sessions").select("*", { count: "exact", head: true }).eq("kid_id", kid)).count,
});

beforeAll(async () => {
  A = await makeParent(`api-a-${run}@test.dev`, { consent: true });
  B = await makeParent(`api-b-${run}@test.dev`, { consent: true });
  const { data, error } = await A.client.from("kids")
    .insert({ parent_id: A.userId, nickname: "Ann", grade: "K", age_band: "5-7", avatar: "fox" }).select().single();
  expect(error).toBeNull();
  kidA = data.id;
});

describe("play API", () => {
  it("another family's kid is a 404 on both routes and nothing is written", async () => {
    who.client = B.client;
    const before = await counts(kidA);
    expect((await turnPost(post({}), ctx(kidA))).status).toBe(404);
    expect((await answerPost(post({ version: 1, given: 3 }), ctx(kidA))).status).toBe(404);
    expect(await counts(kidA)).toEqual(before);
    expect(before).toEqual({ attempts: 0, sessions: 0 });
  });

  it("a signed-out caller and a malformed kid id are 404, not 500", async () => {
    who.client = anon();
    expect((await turnPost(post({}), ctx(kidA))).status).toBe(404);
    expect((await answerPost(post({ version: 1, given: 3 }), ctx(kidA))).status).toBe(404);
    who.client = A.client;
    expect((await turnPost(post({}), ctx("not-a-uuid"))).status).toBe(404);
    expect((await answerPost(post({ version: 1, given: 3 }), ctx("not-a-uuid"))).status).toBe(404);
  });

  it("rejects malformed answer bodies with 400 and writes nothing", async () => {
    who.client = A.client;
    const bodies: unknown[] = [
      { version: 1, given: "7" }, { given: 7 }, { version: 1 }, { version: 1.5, given: 7 }, { version: -1, given: 7 },
      { version: "1", given: 7 }, { version: 1, given: null }, '{"version":1,"given":1e999}', null, [], "not json{",
      { version: 1, given: 2.5 }, { version: 1, given: 1e12 }, { version: 1, given: -(2 ** 31) - 1 },
    ];
    for (const b of bodies) {
      const res = await answerPost(post(typeof b === "string" ? b : JSON.stringify(b)), ctx(kidA));
      expect(res.status, JSON.stringify(b)).toBe(400);
    }
    expect(await counts(kidA)).toEqual({ attempts: 0, sessions: 0 });
  });

  it("the owner gets a turn with no answer or mistakes, then a stale version is a 409 with the current turn", async () => {
    who.client = A.client;
    const t = await turnPost(post({}), ctx(kidA));
    expect(t.status).toBe(200);
    const text = await t.text();
    expect(text).not.toMatch(/"answer"|"mistakes"/);
    const { version, turn } = JSON.parse(text);
    expect(turn.kind).toBe("problem");
    const stale = await answerPost(post({ version: version + 7, given: 1 }), ctx(kidA));
    expect(stale.status).toBe(409);
    const body = await stale.json();
    expect(body.version).toBe(version);
    expect(body.turn.prompt).toEqual(turn.prompt);
    expect((await counts(kidA)).attempts).toBe(0);
  });

  it("a valid answer is saved and the response carries no answer or mistakes fields", async () => {
    who.client = A.client;
    const { version } = await (await turnPost(post({}), ctx(kidA))).json();
    const res = await answerPost(post({ version, given: 999999 }), ctx(kidA));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toMatch(/"answer"|"mistakes"/);
    expect(JSON.parse(text).version).toBeGreaterThan(version);
    expect((await counts(kidA)).attempts).toBe(1);
  });

  it("an unexpected repo error is a 503 'try again' on both routes, not a 500", async () => {
    who.client = A.client;
    const spy = vi.spyOn(SupabaseRepo.prototype, "loadKid").mockRejectedValue(new Error("db down"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      for (const res of [await turnPost(post({}), ctx(kidA)), await answerPost(post({ version: 1, given: 3 }), ctx(kidA))]) {
        expect(res.status).toBe(503);
        expect(await res.json()).toEqual({ error: "try again" });
      }
      expect(log).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      log.mockRestore();
    }
  });
});
