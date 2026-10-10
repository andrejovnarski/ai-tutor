// The kid play screen (Plan 5a): felt board, Nova's bubble, answer tray, connection notice, end card.
import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { admin } from "../helpers/admin";
import { consent, signIn, unique } from "./helpers";

type Grade = "K" | "1" | "2" | "3" | "4" | "5";

/** Signs a consenting parent in and adds a kid straight to the DB. Returns the kid's id. */
async function setUpKid(page: Page, name: string, grade: Grade): Promise<string> {
  const email = unique("screen");
  await signIn(page, email);
  const parentId = await consent(email);
  const ageBand = grade === "K" || grade === "1" || grade === "2" ? "5-7" : "8-11";
  const { data, error } = await admin().from("kids")
    .insert({ parent_id: parentId, nickname: name, grade, age_band: ageBand, avatar: "owl" }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

const attempts = async (kidId: string) => {
  const { count } = await admin().from("attempts").select("*", { count: "exact", head: true }).eq("kid_id", kidId);
  return count ?? 0;
};

const version = (page: Page) => page.locator("main").getAttribute("data-version");
const pad = (page: Page) => page.getByTestId("number-pad");

async function waitForProblem(page: Page) {
  await expect(page.getByTestId("say")).toBeVisible();
  await expect(page.getByTestId("choices").or(pad(page))).toBeVisible();
}

/** Answers the problem on screen (first tile, or "1" then OK on the pad) and waits for the next step. */
async function answer(page: Page, pick = 0): Promise<"tiles" | "pad"> {
  await waitForProblem(page);
  const before = await version(page);
  let used: "tiles" | "pad";
  if (await page.getByTestId("choices").count()) {
    await page.getByTestId("choices").getByRole("button").nth(pick).click();
    used = "tiles";
  } else {
    await pad(page).getByRole("button", { name: "1", exact: true }).click();
    await pad(page).getByRole("button", { name: "OK" }).click();
    used = "pad";
  }
  await expect(page.locator("main")).not.toHaveAttribute("data-version", before!);
  return used;
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

test("ages 5-7: five tapped answers on the felt board, Nova's line changes, no console errors", async ({ page }) => {
  const errors = collectErrors(page);
  const kidId = await setUpKid(page, "Mia", "K");
  await page.goto("/");
  mkdirSync("test-results/screens", { recursive: true });
  await page.screenshot({ path: "test-results/screens/picker.png" });
  await page.getByRole("link", { name: /Mia/ }).click();
  await expect(page).toHaveURL(`/play/${kidId}`);
  const board = page.getByTestId("board");
  const bubble = page.getByTestId("nova-line");
  await waitForProblem(page);
  await expect(page.getByTestId("tray")).toBeVisible();
  await expect(bubble).toHaveCSS("font-size", "28px");
  const seen = new Set([await bubble.innerText()]);
  for (let i = 0; i < 5; i++) {
    await expect(board.locator('svg[role="img"]')).toHaveCount(1);
    expect(await board.locator('svg[role="img"]').getAttribute("aria-label")).toBeTruthy();
    expect(await answer(page, i % 3)).toBe("tiles");
    seen.add(await bubble.innerText());
  }
  expect(seen.size).toBeGreaterThan(1);
  expect(errors).toEqual([]);
});

test("ages 8-11: a number-pad problem is answered with the keys and OK", async ({ page }) => {
  const errors = collectErrors(page);
  const kidId = await setUpKid(page, "Theo", "3");
  await page.goto(`/play/${kidId}`);
  await waitForProblem(page);
  await expect(page.getByTestId("nova-line")).toHaveCSS("font-size", "22px");
  let padAnswers = 0;
  for (let i = 0; i < 6 && padAnswers === 0; i++) if ((await answer(page)) === "pad") padAnswers++;
  expect(padAnswers).toBe(1);
  // The keys: digits, Delete and OK; OK is off while the entry is empty.
  await waitForProblem(page);
  if (await pad(page).count()) {
    await expect(pad(page).getByRole("button", { name: "OK" })).toBeDisabled();
    await pad(page).getByRole("button", { name: "4", exact: true }).click();
    await pad(page).getByRole("button", { name: "Delete" }).click();
    await expect(pad(page).getByRole("button", { name: "OK" })).toBeDisabled();
  }
  expect(errors).toEqual([]);
});

test("a lost answer request shows the connection notice, then the next problem, and saves one attempt", async ({ page }) => {
  const kidId = await setUpKid(page, "Ava", "K");
  await page.goto(`/play/${kidId}`);
  await waitForProblem(page);
  let first = true;
  await page.route("**/api/kids/*/answer", async (route) => {
    if (first) { first = false; await route.abort("failed"); } else await route.continue();
  });
  const before = await version(page);
  await page.getByTestId("choices").getByRole("button").first().click();
  await expect(page.getByTestId("connection-notice")).toContainText("Trying to reach Nova");
  await expect(page.locator("main")).not.toHaveAttribute("data-version", before!);
  await expect(page.getByTestId("connection-notice")).toHaveCount(0);
  await waitForProblem(page);
  await page.waitForTimeout(300);
  expect(await attempts(kidId)).toBe(1);
});

test("I'm done for now goes home, and reopening the kid resumes the same problem", async ({ page }) => {
  const kidId = await setUpKid(page, "Lu", "K");
  await page.goto(`/play/${kidId}`);
  await answer(page);
  await waitForProblem(page);
  const say = await page.getByTestId("say").innerText();
  const v = await version(page);
  await page.getByRole("link", { name: "I'm done for now" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("link", { name: /Lu/ }).click();
  await expect(page.getByTestId("say")).toHaveText(say);
  expect(await version(page)).toBe(v);
});

test("leaving while a request is retrying stops it: nothing is posted after the kid has left", async ({ page }) => {
  const kidId = await setUpKid(page, "Bo", "K");
  await page.goto(`/play/${kidId}`);
  await waitForProblem(page);
  let hits = 0;
  await page.route("**/api/kids/*/answer", async (route) => { hits++; await route.abort("failed"); });
  await page.getByTestId("choices").getByRole("button").first().click();
  await expect(page.getByTestId("connection-notice")).toBeVisible();
  await expect(page.getByTestId("say")).toBeInViewport({ ratio: 1 });
  mkdirSync("test-results/screens", { recursive: true });
  await page.screenshot({ path: "test-results/screens/retrying.png" });
  await page.getByRole("link", { name: "I'm done for now" }).click();
  await expect(page).toHaveURL(/\/$/);
  const atLeave = hits;
  await page.waitForTimeout(4000); // past the 0.5 + 1 + 2 s backoff
  expect(hits).toBe(atLeave);
  expect(await attempts(kidId)).toBe(0);
});

test.describe("portrait 768 x 1024", () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  async function fits(page: Page) {
    const { scroll, inner, width, innerW } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollHeight, inner: window.innerHeight,
      width: document.documentElement.scrollWidth, innerW: window.innerWidth,
    }));
    expect(scroll).toBeLessThanOrEqual(inner);
    expect(width).toBeLessThanOrEqual(innerW);
    const tray = (await page.getByTestId("tray").boundingBox())!;
    for (const b of await page.getByTestId("tray").getByRole("button").all()) {
      const box = (await b.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(88);
      expect(box.height).toBeGreaterThanOrEqual(88);
      expect(box.x).toBeGreaterThanOrEqual(tray.x);
      expect(box.y).toBeGreaterThanOrEqual(tray.y);
      expect(box.x + box.width).toBeLessThanOrEqual(tray.x + tray.width);
      expect(box.y + box.height).toBeLessThanOrEqual(Math.min(tray.y + tray.height, 1024));
    }
  }

  test("tiles: nothing scrolls and every tile is fully in view", async ({ page }) => {
    const kidId = await setUpKid(page, "Pia", "K");
    await page.goto(`/play/${kidId}`);
    await waitForProblem(page);
    await expect(page.getByTestId("choices")).toBeVisible();
    await fits(page);
    mkdirSync("test-results/screens", { recursive: true });
    await page.screenshot({ path: "test-results/screens/portrait-tiles.png" });
  });

  test("number pad: nothing scrolls and every key is fully in view", async ({ page }) => {
    const kidId = await setUpKid(page, "Rex", "3");
    await page.goto(`/play/${kidId}`);
    for (let i = 0; i < 6 && !(await pad(page).count()); i++) await answer(page);
    await expect(pad(page)).toBeVisible();
    await expect(pad(page).getByRole("button")).toHaveCount(12);
    await fits(page);
    mkdirSync("test-results/screens", { recursive: true });
    await page.screenshot({ path: "test-results/screens/portrait-pad.png" });
  });
});

// The server rolls an ended session straight into a new one, and nothing in src/server can end a session quickly,
// so the end card and the picture kinds are shown by answering the turn request with a fixed body.
const turnBody = (show: unknown, say: string, choices = [6, 7, 8]) => ({
  version: 1,
  turn: { kind: "problem", mode: "practice", try: 1, prompt: { say, show }, input: "tap-choice", choices },
  line: { say: "Let's look at the felt board together, Mia.", tone: "curious" },
});

async function showTurn(page: Page, kidId: string, body: unknown) {
  await page.route("**/api/kids/*/turn", (route) => route.fulfill({ json: body }));
  await page.goto(`/play/${kidId}`);
}

test("the end card shows the counts and Play again asks for a new turn", async ({ page }) => {
  const kidId = await setUpKid(page, "Ivy", "K");
  let turns = 0;
  await page.route("**/api/kids/*/turn", async (route) => {
    turns++;
    if (turns === 1) await route.fulfill({ json: { version: 9, turn: { kind: "end", summary: { problems: 12, firstTryCorrect: 9, minutes: 14, mastered: [] } } } });
    else await route.continue();
  });
  await page.goto(`/play/${kidId}`);
  const card = page.getByTestId("end-card");
  await expect(card).toContainText("Great work today!");
  await expect(card).toContainText("12 problems");
  await expect(card).toContainText("9 right on the first try");
  await expect(page.getByRole("link", { name: "I'm done for now" })).toHaveCount(0);
  mkdirSync("test-results/screens", { recursive: true });
  await page.screenshot({ path: "test-results/screens/end-card.png" });
  await card.getByRole("button", { name: "Play again" }).click();
  await waitForProblem(page);
  expect(turns).toBe(2);
});

test("Back to kids on the end card goes to the picker", async ({ page }) => {
  const kidId = await setUpKid(page, "Max", "K");
  await showTurn(page, kidId, { version: 9, turn: { kind: "end", summary: { problems: 3, firstTryCorrect: 1, minutes: 11, mastered: [] } } });
  await page.getByTestId("end-card").getByRole("link", { name: "Back to kids" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: /Max/ })).toBeVisible();
});

test("screenshots of the picture kinds at 1024 x 768", async ({ page }) => {
  mkdirSync("test-results/screens", { recursive: true });
  const kidId = await setUpKid(page, "Mia", "K");
  const shots: Array<[string, unknown, string, number[]?]> = [
    ["ten-frame", { kind: "ten-frames", first: 8, second: 5 }, "How many counters in all?", [12, 13, 14]],
    ["number-line", { kind: "number-line", from: 0, to: 20, marks: [6], jump: { from: 6, by: 5 } }, "Start at 6 and jump 5. Where do you land?", [10, 11, 12]],
    ["blocks", { kind: "blocks", groups: [{ tens: 3, ones: 4 }, { tens: 2, ones: 5 }] }, "How many blocks in all?", [57, 59, 69]],
  ];
  for (const [name, show, say, choices] of shots) {
    await page.unroute("**/api/kids/*/turn");
    await showTurn(page, kidId, turnBody(show, say, choices));
    await expect(page.getByTestId("board").locator('svg[role="img"]')).toBeVisible();
    await page.screenshot({ path: `test-results/screens/${name}.png` });
  }
  // A number-pad problem (ages 8-11 get number-pad input), for the owner too.
  const eq = turnBody({ kind: "equation", text: "34 + 25 = ?" }, "What is 34 plus 25?");
  await page.unroute("**/api/kids/*/turn");
  await showTurn(page, kidId, { ...eq, turn: { ...eq.turn, input: "number-pad", choices: undefined } });
  await expect(pad(page)).toBeVisible();
  await page.screenshot({ path: "test-results/screens/number-pad.png" });
});
