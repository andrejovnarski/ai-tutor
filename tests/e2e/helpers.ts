// Shared e2e steps. The app under test runs on :3000, which is Supabase's site_url, so mailed links are used as is.
import { expect, type Page } from "@playwright/test";
import { admin, latestEmailLink } from "../helpers/admin";

export const unique = (prefix = "parent") => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

/** Asks for a sign-in link and waits for the "Check your email" page. */
export async function requestLink(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send link" }).click();
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
  await page.getByRole("link", { name: "Add kid" }).click();
  await expect(page).toHaveURL(/\/parent\/kids\/new$/);
  await page.getByLabel("First name only").fill(name);
  await page.getByLabel("Grade").selectOption("K");
  await page.getByLabel("fox").check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/parent$/);
}
