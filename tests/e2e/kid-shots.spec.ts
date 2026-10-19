// Screenshots of the kid screens at tablet sizes (and a phone, for reference), saved to test-results/kid/ (git-ignored).
// Also checks that no screen scrolls sideways or down.
import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { admin } from "../helpers/admin";
import { consent, hideDevBadge, signIn, unique } from "./helpers";

const SIZES = [
  { name: "landscape", width: 1024, height: 768 },
  { name: "portrait", width: 768, height: 1024 },
  { name: "pro", width: 1366, height: 1024 },
  { name: "phone", width: 390, height: 844 },
];

async function addKids(page: Page) {
  const email = unique("kidshots");
  await signIn(page, email);
  const parentId = await consent(email);
  const { data, error } = await admin().from("kids").insert([
    { parent_id: parentId, nickname: "Mia", grade: "K", age_band: "5-7", avatar: "fox" },
    { parent_id: parentId, nickname: "Theo", grade: "2", age_band: "5-7", avatar: "owl" },
    { parent_id: parentId, nickname: "Alexandrina", grade: "4", age_band: "8-11", avatar: "cat" },
  ]).select("id, nickname");
  if (error) throw error;
  return Object.fromEntries(data.map((k) => [k.nickname as string, k.id as string]));
}

const pending = async (kidId: string) => {
  const { data } = await admin().from("sessions").select("id, state").eq("kid_id", kidId).is("ended_at", null).single();
  return data as { id: string; state: { startedAt: number; pending: { problem: { answer: number } } } };
};

async function answerWith(page: Page, value: number) {
  const before = await page.locator("main").getAttribute("data-version");
  if (await page.getByTestId("choices").count()) {
    const tiles = page.getByTestId("choices").getByRole("button");
    const n = await tiles.count();
    let hit = false;
    for (let t = 0; t < n && !hit; t++) {
      if ((await tiles.nth(t).innerText()).trim() === String(value)) { await tiles.nth(t).click(); hit = true; }
    }
    if (!hit) await tiles.last().click();
  } else {
    for (const d of String(value)) await page.getByTestId("number-pad").getByRole("button", { name: d, exact: true }).click();
    await page.getByTestId("number-pad").getByRole("button", { name: "OK" }).click();
  }
  await expect(page.locator("main")).not.toHaveAttribute("data-version", before!);
}

for (const size of SIZES) {
  test(`kid screens at ${size.name} size`, async ({ page }) => {
    test.setTimeout(180_000);
    mkdirSync("test-results/kid", { recursive: true });
    await page.setViewportSize({ width: size.width, height: size.height });
    await hideDevBadge(page);
    const shot = async (screen: string, opts: { scrolls?: boolean } = {}) => {
      await page.waitForTimeout(450); // let Nova's hop finish
      const over = await page.evaluate(() => ({
        x: document.documentElement.scrollWidth - window.innerWidth,
        y: document.documentElement.scrollHeight - window.innerHeight,
      }));
      expect.soft(over.x, `${size.name} ${screen} scrolls sideways`).toBeLessThanOrEqual(0);
      if (!opts.scrolls) expect.soft(over.y, `${size.name} ${screen} scrolls down`).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `test-results/kid/${size.name}-${screen}.png` });
    };

    const ids = await addKids(page);
    await page.goto("/");
    await shot("1-picker", { scrolls: true });

    // Mia (K): tiles.
    await page.getByRole("link", { name: /Mia/ }).click();
    await expect(page.getByTestId("say")).toBeVisible();
    await shot("2-tiles");
    const p1 = await pending(ids.Mia!);
    await answerWith(page, p1.state.pending.problem.answer);
    await shot("3-after-correct");
    const p2 = await pending(ids.Mia!);
    await answerWith(page, p2.state.pending.problem.answer + 1);
    await shot("4-after-wrong");

    // Offline: the answer never reaches the server.
    await page.route("**/api/kids/*/answer", (route) => route.abort("failed"));
    if (await page.getByTestId("choices").count()) await page.getByTestId("choices").getByRole("button").first().click();
    await expect(page.getByTestId("connection-notice")).toBeVisible();
    await shot("5-offline");
    await page.unroute("**/api/kids/*/answer");

    // End card: the session began 25 minutes ago, so it winds down.
    await page.goto("/");
    await admin().from("kids").update({ placed: true }).eq("id", ids.Mia!);
    await page.getByRole("link", { name: /Mia/ }).click();
    await expect(page.getByTestId("say")).toBeVisible();
    const open = await pending(ids.Mia!);
    await admin().from("sessions").update({ state: { ...open.state, startedAt: Date.now() - 25 * 60_000 } }).eq("id", open.id);
    const card = page.getByTestId("end-card");
    for (let i = 0; i < 12 && !(await card.isVisible()); i++) {
      await expect(page.getByTestId("say").or(card)).toBeVisible();
      if (await card.isVisible()) break;
      await answerWith(page, (await pending(ids.Mia!)).state.pending.problem.answer);
    }
    await expect(card).toBeVisible();
    await shot("6-end-card");

    // Theo (grade 2) and Alexandrina (grade 4): the number pad, if their problems use it.
    for (const name of ["Theo", "Alexandrina"] as const) {
      await page.goto("/");
      await page.getByRole("link", { name: new RegExp(name) }).click();
      await expect(page.getByTestId("say")).toBeVisible();
      await shot(`7-${name.toLowerCase()}`);
      for (let i = 0; i < 4 && !(await page.getByTestId("number-pad").count()); i++) {
        await answerWith(page, (await pending(ids[name]!)).state.pending.problem.answer);
      }
      if (await page.getByTestId("number-pad").count()) {
        await page.getByTestId("number-pad").getByRole("button", { name: "4", exact: true }).click();
        await page.getByTestId("number-pad").getByRole("button", { name: "2", exact: true }).click();
        await shot(`8-${name.toLowerCase()}-pad`);
      }
    }
  });
}
