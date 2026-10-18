import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { admin } from "../helpers/admin";
import { addKid, consent, setPin, signIn, unique } from "./helpers";

test("view, export, delete a kid, then delete the account", async ({ page }) => {
  const email = unique("rights");
  await signIn(page, email);
  const id = await consent(email);
  await setPin(page);
  await addKid(page, "Mia");

  // Play one answer.
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

  // The kid page shows the session in plain words, with no ids; the export is JSON with the nickname.
  await page.goto("/parent");
  await page.getByRole("link", { name: "Mia" }).click();
  await expect(page.getByRole("heading", { name: /Mia's week/ })).toBeVisible();
  const sessions = page.locator("section", { has: page.getByRole("heading", { name: "Sessions" }) });
  await expect(sessions.locator("li")).toHaveCount(1);
  await expect(sessions.locator("li")).toContainText("1 problem,");
  // Skill progress is saved after the placement round, so one answer is not enough to list a skill yet.
  await expect(page.locator("section", { has: page.getByRole("heading", { name: "Progress" }) }))
    .toContainText("Skills show up here once Mia has played a little more.");
  expect(await page.locator("main").innerText()).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: /Download everything we store about Mia/ }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("Mia-data.json");
  expect(await readFile((await file.path())!, "utf8")).toContain('"nickname":"Mia"');

  // A wrong name is refused; the right name removes Mia.
  await page.getByLabel(/Type Mia to confirm/).fill("mia");
  await page.getByRole("button", { name: "Delete Mia" }).click();
  await expect(page.getByText("That name did not match. Nothing was deleted.")).toBeVisible();
  await page.getByLabel(/Type Mia to confirm/).fill("Mia");
  await page.getByRole("button", { name: "Delete Mia" }).click();
  await expect(page).toHaveURL(/\/parent$/);
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Mia/ })).toHaveCount(0);
  const { count } = await admin().from("kids").select("*", { count: "exact", head: true }).eq("parent_id", id);
  expect(count).toBe(0);

  // Account deletion: wrong word refused, then deleted and signed out.
  await page.goto("/parent/account");
  await page.getByLabel(/Type DELETE to confirm/).fill("delete");
  await page.getByRole("button", { name: "Revoke consent and delete account" }).click();
  await expect(page.getByText("Type DELETE exactly. Nothing was deleted.")).toBeVisible();
  await page.getByLabel(/Type DELETE to confirm/).fill("DELETE");
  await page.getByRole("button", { name: "Revoke consent and delete account" }).click();
  await expect(page).toHaveURL(/\/sign-in\?deleted=1$/);
  await expect(page.getByText("Your account and all data were deleted.")).toBeVisible();
  expect((await admin().from("parents").select("id").eq("id", id)).data).toEqual([]);

  // Signing in again with the same email makes a fresh parent with no consent.
  await signIn(page, email);
  await setPin(page);
  await expect(page.getByRole("link", { name: "Give consent" })).toBeVisible();
  const fresh = (await admin().auth.admin.listUsers({ perPage: 1000 })).data.users.find((u) => u.email === email)!;
  expect(fresh.id).not.toBe(id);
  const { data } = await admin().from("parents").select("consent_at").eq("id", fresh.id).single();
  expect(data!.consent_at).toBeNull();
});
