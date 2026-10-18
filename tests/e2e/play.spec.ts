import { expect, test, type Page } from "@playwright/test";
import { admin, makeParent } from "../helpers/admin";
import { SKILLS } from "../../src/domain/curriculum/index";
import { attempts, setUpMia, unique } from "./helpers";

const choiceButtons = (page: Page) => page.getByTestId("choices").getByRole("button");

/** Answers by tapping the first choice (or the first pad digit then OK) and waits for the next prompt. */
async function answerOnce(page: Page, pick = 0) {
  const before = await page.locator("main").getAttribute("data-version");
  const tiles = await page.getByTestId("choices").count() ? await choiceButtons(page).count() : 0;
  if (tiles) await choiceButtons(page).nth(Math.min(pick, tiles - 1)).click();
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
    // A correct answer holds its feedback line (main[data-hold]), then the next problem's line replaces it. Anything
    // else shows both lines at once. Text is read before the flag: the flag only goes from on to off.
    const first = await bubble.innerText();
    const held = (await page.locator("main").getAttribute("data-hold")) === "true";
    lines.push(first);
    if (held) {
      await expect(page.locator("main")).not.toHaveAttribute("data-hold", "true");
      await expect.poll(() => bubble.innerText()).not.toBe(first);
      lines.push(await bubble.innerText());
    }
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

test("a finished session shows the end card, keeps it on reload, and Play again starts one new session", async ({ page }) => {
  const parentId = await setUpMia(page);
  const { data: kid } = await admin().from("kids").select("id").eq("parent_id", parentId).single();
  const kidId = kid!.id as string;
  await admin().from("kids").update({ placed: true }).eq("id", kidId);
  await page.getByRole("link", { name: /Mia/ }).click();
  await expect(page.getByTestId("say")).toBeVisible();

  // Pretend the session began 25 minutes ago: past both age bands' maximum, so it winds down and ends.
  const { data: open } = await admin().from("sessions").select("id, state").eq("kid_id", kidId).is("ended_at", null).single();
  const state = open!.state as { startedAt: number };
  const { error } = await admin().from("sessions").update({ state: { ...state, startedAt: Date.now() - 25 * 60_000 } }).eq("id", open!.id);
  if (error) throw error;

  const card = page.getByTestId("end-card");
  for (let i = 0; i < 10 && !(await card.isVisible()); i++) await answerOnce(page);
  await expect(card).toBeVisible();
  const stats = await card.innerText();

  await page.reload();
  await expect(card).toBeVisible();
  expect(await card.innerText()).toBe(stats);

  await page.getByRole("button", { name: "Play again" }).click();
  await expect(page.getByTestId("say")).toBeVisible();
  const { data: openNow } = await admin().from("sessions").select("id").eq("kid_id", kidId).is("ended_at", null);
  expect(openNow).toHaveLength(1);
});

// How each picture kind shows in the DOM (see src/app/play/visuals).
const KIND_MARK: Record<string, string> = {
  objects: "[data-group]", "ten-frames": "[data-frame]", "number-line": "[data-tick]",
  blocks: "[data-cube], [data-rod]", equation: "svg[role=img]", story: "[data-story-text]",
};
const SUMS = ["add-within-10.pictures", "add-within-10.within-5", "add-within-10.count-on"];

test("a wrong answer on a sum problem shows the retry picture the server sent, and a reload keeps it", async ({ page }) => {
  const parentId = await setUpMia(page);
  const { data: kid } = await admin().from("kids").select("id").eq("parent_id", parentId).single();
  const kidId = kid!.id as string;
  await admin().from("kids").update({ placed: true }).eq("id", kidId);
  // Everything outside the sum skills is mastered, so the sum skills are what she works on.
  const blocked = new Set(SUMS); // the sum skills and everything that needs them stay unmastered
  for (const sk of SKILLS) if (sk.needs.some((n) => blocked.has(n))) blocked.add(sk.id);
  const rows = SKILLS.filter((sk) => !blocked.has(sk.id)).map((sk) => ({
    kid_id: kidId, skill_id: sk.id, p_known: 0.99, attempts: 10, level: 1, correct_streak: 5, wrong_streak: 0,
    placed: true, recent_tags: [], mastered_at: new Date().toISOString(),
  }));
  const { error } = await admin().from("skill_state").insert(rows);
  if (error) throw error;

  await page.getByRole("link", { name: /Mia/ }).click();
  await expect(page.getByTestId("say")).toBeVisible();

  let kind: string | null = null;
  for (let i = 0; i < 5 && !kind; i++) {
    const { data: open } = await admin().from("sessions").select("state").eq("kid_id", kidId).is("ended_at", null).single();
    const pending = (open!.state as { pending: { problem: { answer: number }; skillId: string } }).pending;
    const right = pending.problem.answer;
    const before = await page.locator("main").getAttribute("data-version");
    const reply = page.waitForResponse((r) => /\/api\/kids\/[^/]+\/answer$/.test(r.url()) && r.request().method() === "POST");
    if (await page.getByTestId("choices").count()) {
      const tiles = choiceButtons(page);
      const n = await tiles.count();
      for (let t = 0; t < n; t++) {
        if ((await tiles.nth(t).innerText()).trim() !== String(right)) { await tiles.nth(t).click(); break; }
      }
    } else {
      for (const d of String(right + 1)) await page.getByRole("button", { name: d, exact: true }).click();
      await page.getByRole("button", { name: "OK" }).click();
    }
    const body = await (await reply).json();
    await expect(page.locator("main")).not.toHaveAttribute("data-version", before!);
    // A retry of a sum skill carries the picture; any other problem (or a prerequisite check) just moves on.
    if (SUMS.includes(pending.skillId) && body.next?.try === 2) {
      expect(body.next.prompt.show).toBeTruthy();
      kind = body.next.prompt.show.kind as string;
    }
  }
  expect(kind, "a sum retry within 5 problems").not.toBeNull();
  const mark = page.getByTestId("board").locator(KIND_MARK[kind!]!).first();
  await expect(mark).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("board").locator(KIND_MARK[kind!]!).first()).toBeVisible();
});
