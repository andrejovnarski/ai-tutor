import { expect, test } from "@playwright/test";
import { latestEmailLink as mailedLink } from "../helpers/admin";

// The mail links to Supabase's site_url (:3000); point it at the server under test.
async function latestEmailLink(email: string): Promise<string> {
  const u = new URL(await mailedLink(email));
  const base = new URL(process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? 3000}`);
  u.protocol = base.protocol;
  u.host = base.host;
  return u.toString();
}

const unique = () => `parent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

async function requestLink(page: import("@playwright/test").Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
}

test("signed-out visitor is sent to sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("link opened in the same browser signs the parent in", async ({ page }) => {
  const email = unique();
  await requestLink(page, email);
  await page.goto(await latestEmailLink(email));
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Add your first kid" })).toHaveAttribute("href", "/parent");
});

test("link opened in a different browser context signs that context in", async ({ page, browser }) => {
  const email = unique();
  await requestLink(page, email);
  const link = await latestEmailLink(email);
  const other = await browser.newContext();
  const page2 = await other.newPage();
  await page2.goto(link);
  await expect(page2).toHaveURL(/\/$/);
  await expect(page2.getByRole("link", { name: "Add your first kid" })).toBeVisible();
  await other.close();
});

test("a used link and a garbage token both show the expired message", async ({ page, browser }) => {
  const email = unique();
  await requestLink(page, email);
  const link = await latestEmailLink(email);
  await page.goto(link);
  await expect(page).toHaveURL(/\/$/);

  const other = await browser.newContext();
  const page2 = await other.newPage();
  await page2.goto(link);
  await expect(page2).toHaveURL(/\/sign-in\?error=link$/);
  await expect(page2.getByText("That link expired. Send a new one.")).toBeVisible();

  await page2.goto("/auth/confirm?token_hash=garbage&type=email");
  await expect(page2).toHaveURL(/\/sign-in\?error=link$/);
  await expect(page2.getByText("That link expired. Send a new one.")).toBeVisible();
  await other.close();
});

test("an unknown email gets the same confirmation as a known one", async ({ page }) => {
  const known = unique();
  await requestLink(page, known);
  await page.goto(await latestEmailLink(known));
  await page.context().clearCookies();

  await requestLink(page, known);
  const knownText = await page.locator("main").innerText();
  await requestLink(page, unique());
  expect(await page.locator("main").innerText()).toBe(knownText);
});
