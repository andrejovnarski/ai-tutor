// Screenshots of every grown-up screen at tablet and phone size, saved to test-results/grownup/ (git-ignored).
// Also checks that no screen scrolls sideways.
import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { admin } from "../helpers/admin";
import { parentId, requestLink, signIn, unique } from "./helpers";

// The brief asked for the 40-character "Alexandria Maximiliana Wolfeschlegelstei" (the input's maxLength), but the
// server (parseKidProfile) and the database (kids_nickname_check) both cap a nickname at 20. So the stress case is
// the widest possible stored name: 20 capital Ws with no break opportunity.
const LONG = "W".repeat(20);
const SIZES = [
  { name: "tablet", width: 1024, height: 768 },
  { name: "phone", width: 390, height: 844 },
];

async function addKidWith(page: Page, name: string, avatar: string) {
  await page.goto("/parent/kids/new");
  await page.getByLabel("First name only").fill(name);
  await page.getByLabel("Grade").selectOption("K");
  await page.locator("label", { hasText: avatar }).click(); // the radio itself is visually hidden
}

for (const size of SIZES) {
  test(`grown-up screens at ${size.name} size`, async ({ page }) => {
    test.setTimeout(120_000);
    mkdirSync("test-results/grownup", { recursive: true });
    await page.setViewportSize({ width: size.width, height: size.height });
    const shot = async (screen: string) => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${size.name} ${screen} scrolls sideways`).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `test-results/grownup/${size.name}-${screen}.png`, fullPage: true });
    };

    const email = unique("shots");
    await page.goto("/sign-in");
    await shot("1-sign-in");
    await requestLink(page, email);
    await shot("2-check-email");
    await signIn(page, email);
    await page.goto("/parent");
    await expect(page).toHaveURL(/\/parent\/pin$/);
    await shot("3-set-pin");
    await page.getByLabel("New PIN", { exact: true }).fill("1234");
    await page.getByLabel("Repeat PIN").fill("1234");
    await shot("4-set-pin-filled");
    await page.getByRole("button", { name: "Save PIN" }).click();
    await expect(page).toHaveURL(/\/parent$/);
    await shot("5-home-before-consent");

    // Unlock screen: drop the PIN cookie.
    await page.context().clearCookies({ name: "parent_ok" });
    await page.goto("/parent");
    await expect(page.getByRole("heading", { name: "Enter your PIN" })).toBeVisible();
    await page.getByLabel("PIN", { exact: true }).fill("12");
    await shot("6-unlock");
    await page.getByLabel("PIN", { exact: true }).fill("1234");
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page).toHaveURL(/\/parent$/);

    await page.goto("/parent/consent");
    await shot("7-consent");
    await page.goto("/parent/privacy");
    await shot("8-privacy");

    await page.goto("/parent/consent");
    await page.getByLabel(/I have read the privacy notice/).check();
    await page.getByRole("button", { name: "Verify with a card (no charge)" }).click();
    await expect(page).toHaveURL(/\/parent\?consented=1$/);
    await shot("9-consented");

    await addKidWith(page, "Mia", "fox");
    await shot("10-add-child");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/parent$/);
    // Added straight to the database: the form's name rules are not what this test is about.
    const { error } = await admin().from("kids")
      .insert({ parent_id: await parentId(email), nickname: LONG, grade: "K", age_band: "5-7", avatar: "owl" });
    if (error) throw error;

    // Answer one problem as Mia.
    await page.goto("/");
    await page.getByRole("link", { name: /Mia/ }).click();
    await expect(page.getByTestId("say")).toBeVisible();
    const before = await page.locator("main").getAttribute("data-version");
    if (await page.getByTestId("choices").count()) await page.getByTestId("choices").getByRole("button").first().click();
    else {
      await page.getByRole("button", { name: "1", exact: true }).click();
      await page.getByRole("button", { name: "OK" }).click();
    }
    await expect(page.locator("main")).not.toHaveAttribute("data-version", before!);

    await page.goto("/parent");
    await shot("11-your-kids");
    await page.getByRole("link", { name: /Mia/ }).first().click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Mia");
    await page.locator("details summary").first().click();
    await shot("12-mia-details-open");

    await page.goto("/parent");
    await page.getByRole("link", { name: /WWWW/ }).first().click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("WWWW");
    await page.locator("details summary").first().click();
    await shot("13-long-name-child");

    await page.goto("/parent/account");
    await shot("14-account");
  });
}
