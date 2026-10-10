import { expect, test, type Page } from "@playwright/test";
import { admin, makeParent } from "../helpers/admin";
import { addKid, consent, setPin, signIn, unique } from "./helpers";

/** Signs in, consents via admin, sets a PIN, adds Mia, and lands on the picker. Returns Mia's parent id. */
async function setUpMia(page: Page): Promise<string> {
  const email = unique("play");
  await signIn(page, email);
  const parentId = await consent(email);
  await setPin(page);
  await addKid(page, "Mia");
  await page.goto("/");
  return parentId;
}

const attempts = async (parentId: string) => {
  const { data: kid } = await admin().from("kids").select("id").eq("parent_id", parentId).single();
  const { count } = await admin().from("attempts").select("*", { count: "exact", head: true }).eq("kid_id", kid!.id);
  return count ?? 0;
};

const choiceButtons = (page: Page) => page.getByTestId("choices").getByRole("button");

/** Answers by tapping the first choice (or the first pad digit then OK) and waits for the next prompt. */
async function answerOnce(page: Page, pick = 0) {
  const before = await page.locator("main").getAttribute("data-version");
  if (await page.getByTestId("choices").count()) await choiceButtons(page).nth(pick).click();
  else {
    await page.getByRole("button", { name: "1", exact: true }).click();
    await page.getByRole("button", { name: "OK" }).click();
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
  const said: string[] = [];
  for (let i = 0; i < 6; i++) {
    await answerOnce(page, i % 3);
    // Straight after an answer the bubble holds the feedback line (1.2 s after a correct one).
    said.push(await page.getByTestId("nova-line").innerText());
  }
  for (const f of said) expect(f).not.toMatch(/undefined|NaN/);
  await expect.poll(() => attempts(parentId)).toBeGreaterThanOrEqual(target);
  const responses = await Promise.all(bodies);
  expect(responses.length).toBeGreaterThan(6);
  for (const body of responses) expect(body).not.toMatch(/"answer"|"mistakes"/);
  // the HTML the server sends (not the live DOM)
  const html = await (await page.request.get(page.url())).text();
  expect(html).toContain("<main");
  expect(html).not.toMatch(/"answer"|"mistakes"|\\"answer\\"|\\"mistakes\\"/);
});

test("Nova speaks above the problem and after each answer, with Mia's name filled in", async ({ page }) => {
  await setUpMia(page);
  await page.getByRole("link", { name: /Mia/ }).click();
  const bubble = page.getByTestId("nova-line");
  await expect(bubble).toBeVisible();
  const lines = [await bubble.innerText()];
  for (let i = 0; i < 6; i++) {
    await answerOnce(page, i % 3);
    // The feedback line first; after a correct answer the next problem's line replaces it 1.2 s later.
    lines.push(await bubble.innerText());
    await page.waitForTimeout(1300);
    lines.push(await bubble.innerText());
  }
  for (const l of lines) {
    expect(l.length).toBeGreaterThan(0);
    expect(l).not.toMatch(/\{name\}|\{answer\}|undefined/);
  }
  // Canned lines rotate and most use {name}: across these lines Mia's name shows up.
  expect(lines.some((l) => l.includes("Mia"))).toBe(true);
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
  // The play page itself is a 404 for an unknown kid and for another family's kid, and shows none of their data.
  const other = await makeParent(unique("other"), { consent: true });
  const { data: zed, error } = await admin().from("kids")
    .insert({ parent_id: other.userId, nickname: "Zedekiah", grade: "1", age_band: "5-7", avatar: "frog" }).select("id").single();
  if (error) throw error;
  for (const id of ["00000000-0000-4000-8000-000000000000", zed.id as string, "not-a-uuid"]) {
    const page404 = await page.goto(`/play/${id}`);
    expect(page404?.status()).toBe(404);
    await expect(page.getByTestId("board")).toHaveCount(0);
    const html = await page.content();
    expect(html).not.toContain("Zedekiah");
    expect(html).not.toContain("frog");
  }
});

test("a signed-out visitor to a play page is sent to sign-in", async ({ page }) => {
  await page.goto("/play/00000000-0000-4000-8000-000000000000");
  await expect(page).toHaveURL(/\/sign-in$/);
});
