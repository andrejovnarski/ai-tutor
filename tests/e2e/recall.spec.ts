import { expect, test } from "@playwright/test";
import { CLUSTERS, SKILLS } from "../../src/domain/curriculum/index";
import { ISLAND_NAMES } from "../../src/domain/rewards/map";
import { admin } from "../helpers/admin";
import { setUpMia } from "./helpers";

test("a due skill gets two correct recall answers and the parent page says remembered", async ({ page }) => {
  const parentId = await setUpMia(page);
  const db = admin();
  const { data: kid, error: kidError } = await db.from("kids").select("id").eq("parent_id", parentId).single();
  if (kidError) throw kidError;
  const kidId = kid!.id as string;
  const { error: placedError } = await db.from("kids").update({ placed: true }).eq("id", kidId);
  if (placedError) throw placedError;

  const seeded = SKILLS.filter((skill) => skill.grade === "K").slice(0, 3);
  const target = seeded[0]!;
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString();
  const notDue = new Date(Date.UTC(9999, 0, 1)).toISOString();
  const { error: seedError } = await db.from("skill_state").insert(seeded.map((skill) => ({
    kid_id: kidId, skill_id: skill.id, p_known: 0.99, attempts: 10, level: 1,
    correct_streak: 5, wrong_streak: 0, placed: false, recent_tags: [],
    mastered_at: twoDaysAgo, last_seen: twoDaysAgo,
    check_due: skill.id === target.id ? twoDaysAgo : notDue,
  })));
  if (seedError) throw seedError;

  await page.getByRole("link", { name: /Mia/ }).click();
  await expect(page.getByTestId("say")).toBeVisible();

  const recallAttempts = async () => {
    const { data, error } = await db.from("attempts").select("result, try")
      .eq("kid_id", kidId).eq("skill_id", target.id).eq("mode", "recall");
    if (error) throw error;
    return data;
  };
  let recalls = await recallAttempts();
  for (let i = 0; i < 12 && recalls.length < 2; i++) {
    const { data: open, error } = await db.from("sessions").select("state")
      .eq("kid_id", kidId).is("ended_at", null).single();
    if (error) throw error;
    const pending = (open!.state as { pending: { problem: { answer: number } } }).pending;
    const right = String(pending.problem.answer);
    const before = await page.locator("main").getAttribute("data-version");
    if (await page.getByTestId("choices").count()) {
      await page.getByTestId("choices").getByRole("button", { name: right, exact: true }).click();
    } else {
      for (const digit of right) await page.getByRole("button", { name: digit, exact: true }).click();
      await page.getByRole("button", { name: "OK" }).click();
    }
    await expect(page.locator("main")).not.toHaveAttribute("data-version", before!);
    recalls = await recallAttempts();
  }
  expect(recalls, `two recall attempts for ${target.id} within 12 problems`).toHaveLength(2);
  for (const recall of recalls) expect(recall).toEqual({ result: "correct", try: 1 });

  await page.getByRole("link", { name: "I'm done for now" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/parent");
  await page.getByRole("link", { name: /Mia/ }).first().click();
  // Skills sit in closed island folds; open the target's island first.
  const island = ISLAND_NAMES[CLUSTERS.find((c) => c.skills.some((s) => s.id === target.id))!.id]!;
  await page.locator("summary", { hasText: island }).click();
  const skillRow = page.getByRole("listitem").filter({ has: page.getByText(target.name, { exact: true }) });
  await expect(skillRow).toContainText("remembered");
});
