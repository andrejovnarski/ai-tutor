// Shared e2e steps. The app under test runs on :3000, which is Supabase's site_url, so mailed links are used as is.
import { expect, type Page } from "@playwright/test";
import { generate } from "../../src/domain/curriculum/index";
import { adaptInput } from "../../src/domain/problems/build";
import type { AgeBand, Level } from "../../src/domain/types";
import type { Session } from "../../src/domain/session/types";
import { admin, latestEmailLink } from "../helpers/admin";

export const unique = (prefix = "parent") => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

/** Asks for a sign-in link and waits for the "Check your email" page. */
export async function requestLink(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Your email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
}

/** Signs in through the mailed link and lands on the home page. */
export async function signIn(page: Page, email: string) {
  await requestLink(page, email);
  await page.goto(await latestEmailLink(email));
  await expect(page).toHaveURL(/\/$/);
}

/** First visit to /parent: chooses a PIN and lands on /parent. */
export async function setPin(page: Page, pin = "1234") {
  await page.goto("/parent");
  await expect(page).toHaveURL(/\/parent\/pin$/);
  await expect(page.getByRole("heading", { name: "Set a PIN" })).toBeVisible();
  await page.getByLabel("New PIN", { exact: true }).fill(pin);
  await page.getByLabel("Repeat PIN").fill(pin);
  await page.getByRole("button", { name: "Save PIN" }).click();
  await expect(page).toHaveURL(/\/parent$/);
}

/** The parent id for a signed-up email. */
export async function parentId(email: string): Promise<string> {
  const { data, error } = await admin().auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => u.email === email)!.id;
}

/** Records consent via admin (the consent flow is not built yet). Returns the parent id. */
export async function consent(email: string): Promise<string> {
  const id = await parentId(email);
  const { error } = await admin().from("parents").update({ consent_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
  return id;
}

/** From /parent (PIN entered, consent given): adds a grade K kid with the fox avatar and returns to /parent. */
export async function addKid(page: Page, name: string) {
  await page.goto("/parent");
  await page.getByRole("link", { name: "Add a child" }).click();
  await expect(page).toHaveURL(/\/parent\/kids\/new$/);
  await page.getByLabel("First name only").fill(name);
  await expect(page.getByLabel("Grade")).toHaveAccessibleDescription(/kindergarten to grade 2 math/);
  await page.getByLabel("Grade").selectOption("K");
  await page.getByLabel("fox").check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/parent$/);
}

/** Signs in, consents via admin, sets a PIN, adds Mia, and lands on the picker. Returns Mia's parent id. */
export async function setUpMia(page: Page): Promise<string> {
  const email = unique("play");
  await signIn(page, email);
  const parentId = await consent(email);
  await setPin(page);
  await addKid(page, "Mia");
  await page.goto("/");
  return parentId;
}

/** How many attempts the parent's (only) kid has saved. */
export const attempts = async (parentId: string) => {
  const { data: kid } = await admin().from("kids").select("id").eq("parent_id", parentId).single();
  const { count } = await admin().from("attempts").select("*", { count: "exact", head: true }).eq("kid_id", kid!.id);
  return count ?? 0;
};

/** Against `next dev`, its badge sits over the bottom-left tile on a phone. It is not part of the app: hide it. */
export async function hideDevBadge(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = "nextjs-portal { display: none !important; }";
      document.head.append(s);
    });
  });
}

/** Replaces only the open session's pending problem, preserving its state and version. */
export async function forcePending(
  page: Page,
  kidId: string,
  { templateId, skillId, seed, level }: { templateId: string; skillId: string; seed: number; level: Level },
) {
  const db = admin();
  const results = await Promise.allSettled([
    db.from("sessions").select("id, state").eq("kid_id", kidId).is("ended_at", null).single(),
    db.from("kids").select("age_band").eq("id", kidId).single(),
  ]);
  for (const result of results) {
    if (result.status === "rejected") throw result.reason;
    if (result.value.error) throw result.value.error;
  }
  const [sessionResult, kidResult] = results;
  if (sessionResult!.status !== "fulfilled" || kidResult!.status !== "fulfilled") throw new Error("Fixture reads failed");
  const session = sessionResult.value.data!;
  const ageBand = kidResult.value.data!.age_band as AgeBand;
  const problem = adaptInput(generate(templateId, seed, level), ageBand);
  const pending = {
    skillId, templateId, seed, level, mode: "practice" as const, try: 1 as const, help: 0 as const,
    presentedAt: Date.now(), style: null, problem, shown: true,
  };
  const { error } = await db.from("sessions").update({
    state: { ...(session.state as Session), pending },
  }).eq("id", session.id);
  if (error) throw error;
  await page.reload();
  await expect(page.getByTestId("board")).toBeVisible();
  return pending;
}
