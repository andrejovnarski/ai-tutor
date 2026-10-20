// Rewards end to end (REWARDS=on in the web server's env): the end card's strip, the picker card, the child page.
import { expect, test, type Page } from "@playwright/test";
import { admin } from "../helpers/admin";
import { setUpMia } from "./helpers";

/** Answers by tapping the first choice (or 1 then OK on the pad) and waits for the screen to move on. */
async function answerOnce(page: Page) {
  const before = await page.locator("main").getAttribute("data-version");
  if (await page.getByTestId("choices").count()) await page.getByTestId("choices").getByRole("button").first().click();
  else {
    await page.getByRole("button", { name: "1", exact: true }).click();
    await page.getByRole("button", { name: "OK" }).click();
  }
  await expect(page.locator("main")).not.toHaveAttribute("data-version", before!);
}

/** Seeds Mia just below a cube, plays, ages the session 25 minutes, and answers until the end card shows. */
async function finishSession(page: Page, parentId: string) {
  const { data: kid } = await admin().from("kids").select("id").eq("parent_id", parentId).single();
  const kidId = kid!.id as string;
  await admin().from("kids").update({ placed: true }).eq("id", kidId);
  // Two problems with no first-try bonus + finished = 40 XP. Even the next session's
  // guaranteed finish bonus crosses 50 XP, regardless of which answers are right.
  // Last week keeps the picker from resuming an end card and leaves this week's day count unchanged.
  const priorEnd = Date.now() - 7 * 24 * 60 * 60_000;
  const { error: seedError } = await admin().from("sessions").insert({
    kid_id: kidId,
    started_at: new Date(priorEnd - 10 * 60_000).toISOString(),
    ended_at: new Date(priorEnd).toISOString(),
    state: { problems: 2, firstTryCorrect: 0, mastered: [], lastActivity: priorEnd },
  });
  if (seedError) throw seedError;
  await page.getByRole("link", { name: /Mia/ }).click();
  await expect(page.getByTestId("say")).toBeVisible();
  const { data: open } = await admin().from("sessions").select("id, state").eq("kid_id", kidId).is("ended_at", null).single();
  const state = open!.state as { startedAt: number };
  const { error } = await admin().from("sessions").update({ state: { ...state, startedAt: Date.now() - 25 * 60_000 } }).eq("id", open!.id);
  if (error) throw error;
  const card = page.getByTestId("end-card");
  for (let i = 0; i < 12 && !(await card.isVisible()); i++) {
    await expect(page.getByTestId("say").or(card)).toBeVisible();
    if (await card.isVisible()) break;
    await answerOnce(page);
  }
  await expect(card).toBeVisible();
}

const rodOf = (page: Page) => page.getByTestId("rewards-strip").getByRole("img", { name: /^\d+ of 10 shells$/ }).last();

test("a finished session shows XP, the rod and the week; the picker and the child page show the rewards", async ({ page }) => {
  const parentId = await setUpMia(page);
  await finishSession(page, parentId);

  const strip = page.getByTestId("rewards-strip");
  await expect(strip).toBeVisible();
  await expect(strip.getByText(/^\+\d+$/)).toBeVisible();
  await expect(rodOf(page)).toHaveAttribute("aria-label", /^[1-9]\d* of 10 shells$/);
  await expect(rodOf(page).locator("[data-drop=true]").first()).toBeAttached();
  await expect(strip.getByRole("img", { name: /^Played 1 day this week$/ })).toBeVisible();
  expect(await page.getByTestId("end-card").innerText()).not.toMatch(/lose|lost|miss|break|broke/i);
  const shown = await strip.innerText();
  const label = await rodOf(page).getAttribute("aria-label");

  await page.reload();
  await expect(strip).toBeVisible();
  expect(await strip.innerText()).toBe(shown);
  expect(await rodOf(page).getAttribute("aria-label")).toBe(label);

  await page.getByRole("link", { name: "Back to kids" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: /Mia/ })).toContainText(/Level \d+/);

  await page.goto("/parent");
  await page.getByRole("link", { name: /Mia/ }).first().click();
  await expect(page.getByRole("heading", { name: "Rewards" })).toBeVisible();
  await expect(page.getByText(/First game/)).toBeVisible();
});

test("with reduced motion the rod's new cubes are already in place, with no animation running", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const parentId = await setUpMia(page);
  await finishSession(page, parentId);
  const rod = rodOf(page);
  await expect(rod).toBeVisible();
  // The new cubes are marked to drop; reduced motion drops nothing and shows them filled.
  await expect(rod.locator("[data-drop=true]").first()).toBeAttached();
  expect(await rod.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
});

test("a finished session keeps both progress lines on reload", async ({ page }) => {
  const parentId = await setUpMia(page);
  await finishSession(page, parentId);
  const today = page.getByTestId("progress-today");
  const next = page.getByTestId("progress-next");
  await expect(today).toBeVisible();
  await expect(next).toBeVisible();
  const shownToday = await today.innerText();
  const shownNext = await next.innerText();
  expect(shownToday).toMatch(/^You .+/);
  expect(shownNext).toMatch(/^Next time: .+/);

  await page.reload();
  await expect(today).toBeVisible();
  await expect(next).toBeVisible();
  await expect(today).toHaveText(shownToday);
  await expect(next).toHaveText(shownNext);
});
