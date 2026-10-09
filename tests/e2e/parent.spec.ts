import { expect, test } from "@playwright/test";
import { admin } from "../helpers/admin";
import { addKid, consent, parentId, setPin, signIn, unique } from "./helpers";

test("without consent: set a PIN, see the consent notice and no Add kid", async ({ page }) => {
  await signIn(page, unique());
  await setPin(page);
  await expect(page.getByText("Before your kid can play, we need a parent's consent.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Add kid" })).toHaveCount(0);
});

test("with consent: add Mia, she shows in the parent list and on the home page", async ({ page }) => {
  const email = unique();
  await signIn(page, email);
  await setPin(page);
  await consent(email);
  await addKid(page, "Mia");
  await expect(page.getByRole("list").getByText("Mia")).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("list").getByText("Mia")).toBeVisible();
});

test("a markup nickname shows the error and saves nothing", async ({ page }) => {
  const email = unique();
  await signIn(page, email);
  await setPin(page);
  const id = await consent(email);
  await page.goto("/parent/kids/new");
  await page.getByLabel("First name only").fill("<b>x</b>");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("first name only");
  await page.goto("/parent");
  await expect(page.getByRole("list")).toHaveCount(0);
  const { count } = await admin().from("kids").select("id", { count: "exact", head: true }).eq("parent_id", id);
  expect(count).toBe(0);
});

test("five wrong PINs lock it for 10 minutes", async ({ page, context }) => {
  await signIn(page, unique());
  await setPin(page);
  await context.clearCookies({ name: "parent_ok" });
  await page.goto("/parent");
  await expect(page).toHaveURL(/\/parent\/pin$/);
  for (let i = 0; i < 5; i++) {
    await page.getByLabel("PIN", { exact: true }).fill("9999");
    await page.getByRole("button", { name: "Unlock" }).click();
  }
  await expect(page.getByText("Locked for 10 minutes")).toBeVisible();
  // even the right PIN is refused while locked
  await page.getByLabel("PIN", { exact: true }).fill("1234");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page).toHaveURL(/\/parent\/pin/);
  await expect(page.getByText("Locked for 10 minutes")).toBeVisible();
});

test("the right PIN unlocks and clears the failure count, and without the cookie /parent redirects to the PIN page", async ({ page, context }) => {
  const email = unique();
  await signIn(page, email);
  await setPin(page);
  await context.clearCookies({ name: "parent_ok" });
  await page.goto("/parent");
  await expect(page).toHaveURL(/\/parent\/pin$/);
  await page.getByLabel("PIN", { exact: true }).fill("0000");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByText("That PIN is not right")).toBeVisible();
  await page.getByLabel("PIN", { exact: true }).fill("1234");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page).toHaveURL(/\/parent$/);
  const { data } = await admin().from("parents").select("pin_failed, pin_locked_until").eq("id", await parentId(email)).single();
  expect(data).toEqual({ pin_failed: 0, pin_locked_until: null });
});

test("Forgot PIN right after email sign-in lets the parent set a new PIN", async ({ page, context }) => {
  await signIn(page, unique());
  await setPin(page);
  await context.clearCookies({ name: "parent_ok" });
  await page.goto("/parent/pin");
  await page.getByRole("button", { name: "Forgot PIN" }).click();
  await expect(page.getByRole("heading", { name: "Set a PIN" })).toBeVisible();
  await page.getByLabel("New PIN", { exact: true }).fill("4321");
  await page.getByLabel("Repeat PIN").fill("4321");
  await page.getByRole("button", { name: "Save PIN" }).click();
  await expect(page).toHaveURL(/\/parent$/);
});
