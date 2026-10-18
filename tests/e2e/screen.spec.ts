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
    const tiles = page.getByTestId("choices").getByRole("button");
    await tiles.nth(Math.min(pick, (await tiles.count()) - 1)).click();
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

/** Answers problems until a number-pad problem is on screen; fails loudly if none shows within `max` problems. */
async function reachPad(page: Page, max = 8) {
  await waitForProblem(page);
  for (let i = 0; i < max && !(await pad(page).count()); i++) {
    await answer(page);
    await waitForProblem(page);
  }
  await expect(pad(page), `no number-pad problem within ${max} problems`).toBeVisible();
}

test("ages 8-11: a number-pad problem is answered with the keys and OK", async ({ page }) => {
  const errors = collectErrors(page);
  const kidId = await setUpKid(page, "Theo", "3");
  await page.goto(`/play/${kidId}`);
  await waitForProblem(page);
  await expect(page.getByTestId("nova-line")).toHaveCSS("font-size", "22px");
  await reachPad(page);
  // The keys: digits, Delete and OK; OK is off while the entry is empty.
  const ok = pad(page).getByRole("button", { name: "OK" });
  await expect(ok).toBeDisabled();
  await pad(page).getByRole("button", { name: "4", exact: true }).click();
  await expect(pad(page).getByLabel("Your answer")).toHaveText("4");
  await pad(page).getByRole("button", { name: "Delete" }).click();
  await expect(pad(page).getByLabel("Your answer")).toHaveText("");
  await expect(ok).toBeDisabled();
  expect(await answer(page)).toBe("pad");
  expect(await attempts(kidId)).toBeGreaterThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("a lost response: the server saved the answer, the retry gets a 409 and adopts the turn; one attempt", async ({ page }) => {
  const errors = collectErrors(page);
  const kidId = await setUpKid(page, "Ava", "K");
  await page.goto(`/play/${kidId}`);
  await waitForProblem(page);
  let first = true;
  const retried: number[] = [];
  await page.route("**/api/kids/*/answer", async (route) => {
    const res = await route.fetch(); // the server sees and commits the answer
    if (first) {
      first = false;
      await route.abort("failed"); // ...but the browser never gets the reply
    } else {
      retried.push(res.status());
      await route.fulfill({ response: res });
    }
  });
  const before = await version(page);
  await page.getByTestId("choices").getByRole("button").first().click();
  await expect(page.getByTestId("connection-notice")).toContainText("Trying to reach Nova");
  await expect(page.locator("main")).not.toHaveAttribute("data-version", before!);
  await expect(page.getByTestId("connection-notice")).toHaveCount(0);
  await expect(page.locator("main")).toHaveAttribute("data-phase", "problem");
  await waitForProblem(page);
  expect(retried).toEqual([409]); // the same { version, given } re-sent: a duplicate, adopted, not saved again
  await expect.poll(() => attempts(kidId)).toBe(1);
  await page.waitForTimeout(500);
  expect(await attempts(kidId)).toBe(1);
  // Chromium logs the aborted request and the 409 as resource errors; no other error (and no page error) may appear.
  const network = /^Failed to load resource: (net::ERR_FAILED|the server responded with a status of 409 \(Conflict\))$/;
  expect(errors.filter((e) => !network.test(e))).toEqual([]);
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
    // .screen is 100dvh with overflow hidden, so the document never scrolls: check what is actually on screen.
    await expect(page.getByTestId("say")).toBeInViewport({ ratio: 1 });
    const board = (await page.getByTestId("board").boundingBox())!;
    const tray = (await page.getByTestId("tray").boundingBox())!;
    expect(board.y + board.height).toBeLessThanOrEqual(tray.y);
    expect(tray.y + tray.height).toBeLessThanOrEqual(1024);
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
    await reachPad(page);
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
  await page.route("**/api/kids/*/turn", (route) => route.fulfill({ json: { version: 9, turn: { kind: "end", summary: { problems: 12, firstTryCorrect: 9, minutes: 14, mastered: [] } } } }));
  let playAgains = 0;
  await page.route("**/api/kids/*/play-again", async (route) => {
    playAgains++;
    await route.fulfill({ json: turnBody({ kind: "equation", text: "3 + 4 = ?" }, "What is 3 plus 4?") });
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
  expect(playAgains).toBe(1);
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
    ["story", { kind: "story", text: "Mia has 4 apples. She picks 3 more. How many apples does she have now?", icon: "apple", groups: [4, 3] },
      "Mia has 4 apples. She picks 3 more. How many apples does she have now?", [6, 7, 8]],
  ];
  for (const [name, show, say, choices] of shots) {
    await page.unroute("**/api/kids/*/turn");
    await showTurn(page, kidId, turnBody(show, say, choices));
    await expect(page.getByTestId("board").locator('svg[role="img"]')).toBeVisible();
    // A story picture prints the sentence itself; the h1 is then for screen readers only, so it is not printed twice.
    if (name === "story") await expect(page.getByTestId("say")).toHaveCSS("position", "absolute");
    else await expect(page.getByTestId("say")).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: `test-results/screens/${name}.png` });
  }
  // A number-pad problem (ages 8-11 get number-pad input), for the owner too.
  const eq = turnBody({ kind: "equation", text: "34 + 25 = ?" }, "What is 34 plus 25?");
  await page.unroute("**/api/kids/*/turn");
  await showTurn(page, kidId, { ...eq, turn: { ...eq.turn, input: "number-pad", choices: undefined } });
  await expect(pad(page)).toBeVisible();
  await page.screenshot({ path: "test-results/screens/number-pad.png" });
});

// ---- Final review: bubble rules, leaving on 401/404, focus, and the longest lines -------------------------------

const LONG = "Nice try, Mia! Let's count the red counters together, one at a time, and then add the yellow counters to find how many there are.";
const tenFrames = { kind: "ten-frames", first: 8, second: 5 };
const step = (version: number, line: { say: string; tone: string }) => ({
  version, turn: turnBody(tenFrames, "How many counters are on the felt board in all?", [12, 13, 14]).turn, line,
});
const reply = (correct: boolean, over: Record<string, unknown> = {}) => ({
  version: 2,
  feedback: { result: { kind: correct ? "correct" : "wrong" }, then: "next", reveal: !correct },
  next: step(2, { say: "x", tone: "calm" }).turn,
  line: { say: correct ? "Yes! That's it, Mia." : "8 and 5 make 13.", tone: correct ? "cheer" : "calm" },
  nextLine: { say: "Here is a new one for you.", tone: "curious" },
  ...(correct ? {} : { revealed: 13 }),
  ...over,
});

async function stubPlay(page: Page, kidId: string, turn: unknown, answerBody: unknown) {
  await page.route("**/api/kids/*/turn", (r) => r.fulfill({ json: turn }));
  await page.route("**/api/kids/*/answer", (r) => r.fulfill({ json: answerBody }));
  await page.goto(`/play/${kidId}`);
  await waitForProblem(page);
}

test("a correct answer holds its line, then swaps; a wrong move-on keeps the explain line with its note", async ({ page }) => {
  const kidId = await setUpKid(page, "Kai", "K");
  const bubble = page.getByTestId("nova-line");
  await stubPlay(page, kidId, step(1, { say: "Let's count.", tone: "curious" }), reply(true));
  await page.getByTestId("choices").getByRole("button").first().click();
  await expect(bubble).toHaveText("Yes! That's it, Mia.");
  await expect(page.locator("main")).toHaveAttribute("data-hold", "true");
  await expect(bubble).toHaveAttribute("data-tone", "cheer");
  await expect(bubble).toHaveText("Here is a new one for you.");
  await expect(page.locator("main")).not.toHaveAttribute("data-hold", "true");

  await page.unroute("**/api/kids/*/turn");
  await page.unroute("**/api/kids/*/answer");
  await stubPlay(page, kidId, step(1, { say: "Let's count.", tone: "curious" }), reply(false));
  await page.getByTestId("choices").getByRole("button").first().click();
  await expect(bubble.locator("[data-lead]")).toHaveText("8 and 5 make 13.");
  await expect(bubble).toContainText("Here is a new one for you.");
  await expect(page.locator("main")).not.toHaveAttribute("data-hold", "true");
  await page.waitForTimeout(1500); // past any hold: the explain line is still there
  await expect(bubble.locator("[data-lead]")).toHaveText("8 and 5 make 13.");
  await expect(bubble.locator("[data-note]")).toHaveCount(0); // the line states 13, so no note is needed
});

test("the longest lines (25 words at 28 px, a lead and a note) leave the prompt and board clear of the tray", async ({ page }) => {
  const kidId = await setUpKid(page, "Noa", "K");
  await stubPlay(page, kidId, step(1, { say: LONG, tone: "curious" }),
    reply(false, { line: { say: LONG, tone: "calm" }, nextLine: { say: LONG, tone: "curious" }, revealed: 13 }));
  await page.getByTestId("choices").getByRole("button").first().click();
  const bubble = page.getByTestId("nova-line");
  await expect(bubble.locator("[data-lead]")).toHaveText(LONG);
  await expect(bubble.locator("[data-note]")).toHaveText("The answer is 13.");
  await expect(bubble).toHaveCSS("font-size", "28px");
  mkdirSync("test-results/screens", { recursive: true });
  await page.screenshot({ path: "test-results/screens/longest-lines.png" });
  const box = async (id: string) => (await page.getByTestId(id).boundingBox())!;
  const [b, board, tray, say] = [await box("nova-line"), await box("board"), await box("tray"), await box("say")];
  await expect(page.getByTestId("say")).toBeInViewport({ ratio: 1 });
  expect(b.y + b.height).toBeLessThanOrEqual(board.y);
  expect(say.y + say.height).toBeLessThanOrEqual(board.y + board.height);
  expect(board.y + board.height).toBeLessThanOrEqual(tray.y);
  expect(tray.y + tray.height).toBeLessThanOrEqual(768);
  // What is drawn (not the SVG box): the ten-frames must stay big enough to count.
  const drawn = await page.getByTestId("board").locator('svg[role="img"]').evaluate((svg: SVGSVGElement) =>
    svg.getBBox().height * (svg.getBoundingClientRect().height / svg.viewBox.baseVal.height));
  expect(drawn).toBeGreaterThanOrEqual(60);
});

test("a 404 on answer after the page loaded (session or kid gone) goes home instead of 'can't connect'", async ({ page }) => {
  const kidId = await setUpKid(page, "Sol", "K");
  await page.goto(`/play/${kidId}`);
  await waitForProblem(page);
  await page.route("**/api/kids/*/answer", (r) => r.fulfill({ status: 404, json: { error: "not found" } }));
  await page.getByTestId("choices").getByRole("button").first().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: /Sol/ })).toBeVisible();
});

test("a 401 on the turn load goes home too", async ({ page }) => {
  const kidId = await setUpKid(page, "Uma", "K");
  await page.route("**/api/kids/*/turn", (r) => r.fulfill({ status: 401, json: { error: "signed out" } }));
  await page.goto(`/play/${kidId}`);
  await expect(page).toHaveURL(/\/$/);
});

test("focus: not taken on load; after a keyboard answer it lands on the new problem's first button", async ({ page }) => {
  const kidId = await setUpKid(page, "Ezra", "K");
  await page.goto(`/play/${kidId}`);
  await waitForProblem(page);
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  const before = await version(page);
  await page.getByTestId("choices").getByRole("button").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).not.toHaveAttribute("data-version", before!);
  await waitForProblem(page);
  await expect.poll(() => page.evaluate(() => {
    const a = document.activeElement;
    return !!a && a.tagName === "BUTTON" && !!a.closest('[data-testid="tray"]');
  })).toBe(true);
});
