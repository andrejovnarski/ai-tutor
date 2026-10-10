import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { admin } from "../helpers/admin";
import { parentId, setPin, signIn, unique } from "./helpers";

const ERROR = "We couldn't verify that. No charge was made. Please try again.";

async function consentRows(id: string) {
  const { data, error } = await admin().from("consents").select("notice_version, method, ref").eq("parent_id", id);
  if (error) throw error;
  return data;
}
async function consentAt(id: string) {
  const { data } = await admin().from("parents").select("consent_at").eq("id", id).single();
  return data?.consent_at ?? null;
}

test("consent through the UI: checkbox gates the button, then Add kid appears", async ({ page }) => {
  const email = unique();
  await signIn(page, email);
  await setPin(page);
  await page.getByRole("link", { name: "Give consent" }).click();
  await expect(page).toHaveURL(/\/parent\/consent$/);
  const verify = page.getByRole("button", { name: "Verify with a card (no charge)" });
  await expect(verify).toBeDisabled();
  await page.getByLabel("I have read the privacy notice and I am this child's parent or guardian").check();
  await expect(verify).toBeEnabled();
  await verify.click();
  await expect(page).toHaveURL(/\/parent\?consented=1$/);
  await expect(page.getByRole("link", { name: "Add kid" })).toBeVisible();
  const rows = await consentRows(await parentId(email));
  expect(rows).toHaveLength(1);
  expect(rows[0]!.notice_version).toBe("2026-10-10-draft");
  expect(rows[0]!.method).toBe("fake");
});

test("the privacy notice is marked as a draft", async ({ page }) => {
  await signIn(page, unique());
  await setPin(page);
  await page.goto("/parent/privacy");
  await expect(page.getByText("Draft — pending legal review")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Not a crisis service" })).toBeVisible();
});

async function fakeReturnUrl(page: import("@playwright/test").Page): Promise<string> {
  await page.goto("/parent/consent");
  await page.getByLabel(/I have read the privacy notice/).check();
  // Stop at the redirect so the return URL is not used yet.
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/parent/consent/return")),
    page.getByRole("button", { name: "Verify with a card (no charge)" }).click(),
  ]);
  return res.url();
}

test("another parent cannot use A's return link; replay leaves one row; garbage errors", async ({ page, browser }) => {
  const a = unique();
  await signIn(page, a);
  await setPin(page);
  const idA = await parentId(a);
  const url = await fakeReturnUrl(page);
  await expect(page).toHaveURL(/\/parent\?consented=1$/);

  // Replay by A.
  await page.goto(url);
  await expect(page).toHaveURL(/\/parent\?consented=1$/);
  expect(await consentRows(idA)).toHaveLength(1);

  // Parent B, no consent, opens A's link.
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const b = await ctx.newPage();
  const emailB = unique();
  await signIn(b, emailB);
  await setPin(b);
  await b.goto(url);
  await expect(b).toHaveURL(/\/parent\/consent\?error=1$/);
  await expect(b.locator("main").getByRole("alert")).toContainText(ERROR);
  expect(await consentAt(await parentId(emailB))).toBeNull();
  expect(await consentRows(await parentId(emailB))).toHaveLength(0);

  // Garbage.
  await b.goto("/parent/consent/return?session_id=nonsense");
  await expect(b).toHaveURL(/\/parent\/consent\?error=1$/);
  await b.goto("/parent/consent/return");
  await expect(b).toHaveURL(/\/parent\/consent\?error=1$/);
  await ctx.close();
});

test("a signed-in parent without the PIN cookie still gets consent from their own return link", async ({ page, context }) => {
  const email = unique();
  await signIn(page, email);
  await setPin(page);
  const id = await parentId(email);
  const mac = createHmac("sha256", process.env.PARENT_COOKIE_SECRET!).update(`consent.${id}`).digest("hex");
  await context.clearCookies({ name: "parent_ok" });
  await page.goto(`/parent/consent/return?session_id=fake_${id}_${mac}`);
  expect(await consentRows(id)).toHaveLength(1);
  expect(await consentAt(id)).not.toBeNull();
  await expect(page).toHaveURL(/\/parent\/pin$/);
});
