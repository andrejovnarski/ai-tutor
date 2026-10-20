import { expect, test } from "@playwright/test";
import { admin } from "../helpers/admin";
import { setUpMia } from "./helpers";

test("Help me gives a hint, keeps both help levels on reload, then lets Mia finish", async ({ page }) => {
  const parentId = await setUpMia(page);
  const { data: kid, error: kidError } = await admin().from("kids").select("id").eq("parent_id", parentId).single();
  if (kidError) throw kidError;
  const kidId = kid!.id as string;
  const { error: placedError } = await admin().from("kids").update({ placed: true }).eq("id", kidId);
  if (placedError) throw placedError;
  await page.getByRole("link", { name: /Mia/ }).click();
  const bubble = page.getByTestId("nova-line");
  const help = page.getByRole("button", { name: "Help me", exact: true });
  await expect(help).toBeEnabled();
  const originalLine = await bubble.innerText();
  const prompt = await page.getByTestId("say").innerText();
  const { data: open, error: sessionError } = await admin().from("sessions").select("state").eq("kid_id", kidId).is("ended_at", null).single();
  if (sessionError) throw sessionError;
  const pending = (open!.state as { pending: { problem: { answer: number } } }).pending;
  const answer = pending.problem.answer;
  const answerNumber = new RegExp(`(^|[^\\d-])${answer}(?!\\d)`);

  const hintResponse = page.waitForResponse((r) => r.url().endsWith(`/kids/${kidId}/help`) && r.request().method() === "POST");
  await help.click();
  const hint = await (await hintResponse).json();
  expect(hint.next.help).toBe(1);
  await expect(bubble).not.toHaveText(originalLine);
  await expect(bubble).toContainText(hint.line.say);
  expect(await bubble.innerText()).not.toMatch(answerNumber);
  await expect(help).toBeEnabled();
  await expect(page.getByTestId("say")).toHaveText(prompt);
  await expect(page.getByTestId("board").getByRole("img")).toBeVisible();
  const hintLine = await bubble.innerText();
  const hintPicture = await page.getByTestId("board").getByRole("img").getAttribute("aria-label");
  await page.reload();
  await expect(bubble).toHaveText(hintLine);
  await expect(help).toBeEnabled();
  await expect(page.getByTestId("board").getByRole("img")).toHaveAttribute("aria-label", hintPicture!);

  await help.click();
  await expect(help).toHaveCount(0);
  await expect(bubble).toContainText(answerNumber);
  await expect(page.getByTestId("say")).toHaveText(prompt);
  const demoLine = await bubble.innerText();
  await page.reload();
  await expect(bubble).toHaveText(demoLine);
  await expect(help).toHaveCount(0);
  await expect(page.getByTestId("say")).toHaveText(prompt);

  const response = page.waitForResponse((r) => r.url().endsWith(`/kids/${kidId}/answer`) && r.request().method() === "POST");
  if (await page.getByTestId("choices").count()) {
    await page.getByTestId("choices").getByRole("button", { name: String(answer), exact: true }).click();
  } else {
    for (const digit of String(answer)) await page.getByRole("button", { name: digit, exact: true }).click();
    await page.getByRole("button", { name: "OK", exact: true }).click();
  }
  const body = await (await response).json();
  expect(body.feedback.then).toBe("next");
  expect(body.next.try).toBe(1);
  await expect(page.locator("main")).toHaveAttribute("data-version", String(body.version));
  await expect(page.getByTestId("say")).toHaveText(body.next.prompt.say);
  await expect(help).toBeEnabled();
});
