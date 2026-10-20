import { expect, test, type Page } from "@playwright/test";
import { SKILLS } from "../../src/domain/curriculum/index";
import { admin } from "../helpers/admin";
import { forcePending, setUpMia } from "./helpers";

async function pending(kidId: string) {
  const { data, error } = await admin().from("sessions").select("state")
    .eq("kid_id", kidId).is("ended_at", null).single();
  if (error) throw error;
  return (data!.state as { pending: { templateId: string; seed: number; try: number; help?: number; problem: { answer: number } } }).pending;
}

async function answer(page: Page, value: number) {
  await expect(page.locator("main")).not.toHaveAttribute("data-hold", "true");
  const before = await page.locator("main").getAttribute("data-version");
  await page.getByTestId("choices").getByRole("button", { name: String(value), exact: true }).click();
  await expect(page.locator("main")).not.toHaveAttribute("data-version", before!);
  await expect(page.locator("main")).not.toHaveAttribute("data-hold", "true");
}

test("fill frame supports taps, undo, start over and keyboard, and resets on retry", async ({ page }) => {
  test.setTimeout(180_000);
  const parentId = await setUpMia(page);
  const { data: kid, error } = await admin().from("kids").select("id").eq("parent_id", parentId).single();
  if (error) throw error;
  const kidId = kid!.id as string;
  const db = admin();
  const { error: placedError } = await db.from("kids").update({ placed: true }).eq("id", kidId);
  if (placedError) throw placedError;
  const frontier = SKILLS.findIndex((skill) => skill.id === "add-within-10.make-ten");
  expect(frontier, "Make 10 exists in curriculum order").toBeGreaterThan(0);
  const { error: seedError } = await db.from("skill_state").insert(SKILLS.slice(0, frontier).map((skill) => ({
    kid_id: kidId, skill_id: skill.id, p_known: 0.99, attempts: 10, level: 1,
    correct_streak: 5, wrong_streak: 0, placed: false, recent_tags: [],
    mastered_at: new Date().toISOString(), check_due: new Date(Date.UTC(9999, 0, 1)).toISOString(),
  })));
  if (seedError) throw seedError;

  await page.getByRole("link", { name: /Mia/ }).click();
  await expect(page.getByTestId("say")).toBeVisible();
  // Seed 0 gives four empty cells at level 1; pin the capacity needed by the four taps.
  const current = await forcePending(page, kidId, {
    templateId: "make-ten-frame", skillId: "add-within-10.make-ten", seed: 0, level: 1,
  });
  expect(current.templateId).toBe("make-ten-frame");
  expect(current.problem.answer, "fixed frame seed has at least four empty cells").toBeGreaterThanOrEqual(4);
  expect(current.try).toBe(1);
  const empty = page.getByRole("button", { name: "Empty space, add a counter", exact: true });
  const added = page.locator('[data-counter="added"]');
  for (let i = 0; i < 4; i++) await empty.last().click();
  await expect(added).toHaveCount(4);
  await page.getByRole("button", { name: "Your counter, take it back", exact: true }).first().click();
  await expect(added).toHaveCount(3);
  await page.getByRole("button", { name: "Start over", exact: true }).click();
  await expect(added).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start over", exact: true })).toHaveCount(0);
  await empty.first().focus();
  await page.keyboard.press("Enter");
  await expect(added).toHaveCount(1);

  const tiles = page.getByTestId("choices").getByRole("button");
  const wrong = (await tiles.allTextContents()).map((text) => Number(text.trim())).find((n) => n !== current.problem.answer);
  expect(wrong, "a wrong answer tile exists").toBeDefined();
  await answer(page, wrong!);
  expect(await pending(kidId)).toMatchObject({ templateId: current.templateId, seed: current.seed, try: 2 });
  await expect(empty).toHaveCount(current.problem.answer);
  await expect(added).toHaveCount(0);
  // Help 2 on the same try keeps the child's counters while Nova shows how.
  for (let i = 0; i < 2; i++) await empty.last().click();
  await expect(added).toHaveCount(2);
  await page.getByRole("button", { name: "Help me" }).click();
  await expect.poll(async () => (await pending(kidId)).help).toBe(2);
  await expect(page.getByRole("button", { name: "Help me" })).toHaveCount(0);
  await expect(added).toHaveCount(2);
  await answer(page, current.problem.answer);
  expect((await pending(kidId)).try).toBe(1);
  await expect(page.getByTestId("say")).toBeVisible();
});
