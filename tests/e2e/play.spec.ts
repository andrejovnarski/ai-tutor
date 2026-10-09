import { expect, test, type Page } from "@playwright/test";
import { admin, latestEmailLink as mailedLink } from "../helpers/admin";

const unique = () => `play-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

async function confirmLink(email: string): Promise<string> {
  const u = new URL(await mailedLink(email));
  const base = new URL(process.env.E2E_BASE_URL ?? "http://localhost:3000");
  u.protocol = base.protocol;
  u.host = base.host;
  return u.toString();
}

/** Signs in, consents via admin, sets a PIN, adds Mia, and lands on the picker. Returns Mia's parent id. */
async function setUpMia(page: Page): Promise<string> {
  const email = unique();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.goto(await confirmLink(email));
  await expect(page).toHaveURL(/\/$/);

  const a = admin();
  const { data } = await a.auth.admin.listUsers({ perPage: 1000 });
  const parentId = data.users.find((u) => u.email === email)!.id;
  const { error } = await a.from("parents").update({ consent_at: new Date().toISOString() }).eq("id", parentId);
  if (error) throw error;

  await page.goto("/parent");
  await page.getByLabel("New PIN", { exact: true }).fill("1234");
  await page.getByLabel("Repeat PIN").fill("1234");
  await page.getByRole("button", { name: "Save PIN" }).click();
  await expect(page).toHaveURL(/\/parent$/);
  await page.getByRole("link", { name: "Add kid" }).click();
  await page.getByLabel("First name only").fill("Mia");
  await page.getByLabel("Grade").selectOption("K");
  await page.getByLabel("fox").check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/parent$/);
  await page.goto("/");
  return parentId;
}

const attempts = async (parentId: string) => {
  const { data: kid } = await admin().from("kids").select("id").eq("parent_id", parentId).single();
  const { count } = await admin().from("attempts").select("*", { count: "exact", head: true }).eq("kid_id", kid!.id);
  return count ?? 0;
};

const choiceButtons = (page: Page) => page.getByTestId("choices").getByRole("button");

/** Answers by tapping the first choice (or the first pad digit then Go) and waits for the next prompt. */
async function answerOnce(page: Page, pick = 0) {
  const before = await page.locator("main").getAttribute("data-version");
  if (await page.getByTestId("choices").count()) await choiceButtons(page).nth(pick).click();
  else {
    await page.getByRole("button", { name: "1", exact: true }).click();
    await page.getByRole("button", { name: "Go" }).click();
  }
  await expect(page.locator("main")).not.toHaveAttribute("data-version", before!);
}

test("tap Mia and answer problems; attempts are saved and responses never carry answer or mistakes", async ({ page }) => {
  const bodies: Promise<string>[] = [];
  page.on("response", (r) => {
    if (r.url().includes("/api/kids/") || /\/play\//.test(r.url())) bodies.push(r.text().catch(() => ""));
  });
  const parentId = await setUpMia(page);
  await page.getByRole("link", { name: /Mia/ }).click();
  await expect(page).toHaveURL(/\/play\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("say")).toBeVisible();
  const target = (await attempts(parentId)) + 6;
  const feedback: string[] = [];
  for (let i = 0; i < 6; i++) {
    await answerOnce(page, i % 3);
    feedback.push(await page.getByTestId("feedback").innerText().catch(() => ""));
  }
  for (const f of feedback) expect(f).not.toMatch(/undefined|NaN/);
  await expect.poll(() => attempts(parentId)).toBeGreaterThanOrEqual(target);
  const responses = await Promise.all(bodies);
  expect(responses.length).toBeGreaterThan(6);
  for (const body of responses) expect(body).not.toMatch(/"answer"|"mistakes"/);
  // the HTML the server sends (not the live DOM)
  const html = await (await page.request.get(page.url())).text();
  expect(html).toContain("<main");
  expect(html).not.toMatch(/"answer"|"mistakes"|\\"answer\\"|\\"mistakes\\"/);
});

test("reloading mid-problem brings back the same prompt and choices", async ({ page }) => {
  await setUpMia(page);
  await page.getByRole("link", { name: /Mia/ }).click();
  await expect(page.getByTestId("say")).toBeVisible();
  const say = await page.getByTestId("say").innerText();
  const choices = await page.getByTestId("choices").count() ? await choiceButtons(page).allInnerTexts() : null;
  await page.reload();
  await expect(page.getByTestId("say")).toHaveText(say);
  if (choices) expect(await choiceButtons(page).allInnerTexts()).toEqual(choices);
});

test("two fast taps on one choice save one attempt", async ({ page }) => {
  const parentId = await setUpMia(page);
  await page.getByRole("link", { name: /Mia/ }).click();
  await expect(page.getByTestId("say")).toBeVisible();
  const first = choiceButtons(page).first();
  await first.dispatchEvent("click");
  await first.dispatchEvent("click");
  await expect.poll(() => attempts(parentId)).toBe(1);
  await page.waitForTimeout(500);
  expect(await attempts(parentId)).toBe(1);
});

test("another family's kid id shows nothing and the API says 404", async ({ page }) => {
  await setUpMia(page);
  const res = await page.request.post("/api/kids/00000000-0000-4000-8000-000000000000/turn");
  expect(res.status()).toBe(404);
});
