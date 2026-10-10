// Speech (Plan 5b) on the play screen, with SPEECH=fake on the server: the recogniser always hears "twelve" and the
// voice returns a silent frame. Chromium's fake mic plays tests/fixtures/loud-then-quiet.wav on a loop.
import { mkdirSync } from "node:fs";
import { expect, test, type Page, type Request } from "@playwright/test";
import { attempts, setUpMia } from "./helpers";

const mic = (page: Page) => page.getByRole("button", { name: "Talk to Nova" });
const tiles = (page: Page) => page.getByTestId("choices").getByRole("button");

/** Opens Mia's play screen and waits for a problem with the mic. */
async function openMia(page: Page) {
  await page.getByRole("link", { name: /Mia/ }).click();
  await expect(page.getByTestId("say")).toBeVisible();
  await expect(mic(page)).toBeEnabled();
}

/** Collects the bodies of /answer requests. */
function answers(page: Page): Array<{ version: number; given: number }> {
  const out: Array<{ version: number; given: number }> = [];
  page.on("request", (r) => { if (/\/api\/kids\/[^/]+\/answer$/.test(r.url())) out.push(r.postDataJSON()); });
  return out;
}

const listenWith = (page: Page, body: unknown, delayMs = 0) =>
  page.route("**/api/kids/*/listen", async (route) => {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    await route.fulfill({ json: body }).catch(() => {}); // the page may have aborted it
  });

test("real path: the fake mic and the fake recogniser answer twelve; one attempt with given 12", async ({ page }) => {
  const parentId = await setUpMia(page);
  const sent = answers(page);
  await openMia(page);
  const before = await attempts(parentId);
  const version = await page.locator("main").getAttribute("data-version");
  const listen = page.waitForRequest((r) => r.url().endsWith("/listen") && r.method() === "POST", { timeout: 10_000 });
  await mic(page).click();
  await expect(mic(page)).toHaveAttribute("data-mic", /listening|thinking/);
  const req = await listen;
  expect(req.headers()["content-type"]).toBe("audio/wav");
  await expect(page.locator("main")).not.toHaveAttribute("data-version", version!, { timeout: 15_000 });
  await expect.poll(() => attempts(parentId)).toBe(before + 1);
  expect(sent.map((a) => a.given)).toEqual([12]);
});

test("confirm: Did you say 12? and Yes tapped twice saves exactly one attempt", async ({ page }) => {
  const parentId = await setUpMia(page);
  const sent = answers(page);
  await listenWith(page, { heard: "twelve", route: { kind: "confirm", n: 12 } });
  await openMia(page);
  await mic(page).click();
  const yes = page.getByRole("button", { name: "Yes", exact: true });
  await expect(page.getByText("Did you say 12?")).toBeVisible({ timeout: 10_000 });
  const box = (await yes.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(88);
  expect(box.height).toBeGreaterThanOrEqual(88);
  mkdirSync("test-results/screens", { recursive: true });
  await page.screenshot({ path: "test-results/screens/did-you-say.png" });
  // Two taps in the same tick, before React re-renders: the button is still there for the second one.
  await yes.evaluate((b: HTMLElement) => { b.click(); b.click(); });
  await expect.poll(() => attempts(parentId)).toBe(1);
  await page.waitForTimeout(500);
  expect(await attempts(parentId)).toBe(1);
  expect(sent.map((a) => a.given)).toEqual([12]);
});

test("confirm: No says Let's try again, saves nothing, and the mic is ready again", async ({ page }) => {
  const parentId = await setUpMia(page);
  await listenWith(page, { heard: "twelve", route: { kind: "confirm", n: 12 } });
  await openMia(page);
  await mic(page).click();
  await expect(page.getByText("Did you say 12?")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "No", exact: true }).click();
  await expect(page.getByText("Let's try again.")).toBeVisible();
  await expect(page.getByText("Did you say 12?")).toHaveCount(0);
  await expect(mic(page)).toBeEnabled();
  expect(await attempts(parentId)).toBe(0);
});

test("say: words that are not a number go to /say, and Nova's reply shows above the problem line", async ({ page }) => {
  const parentId = await setUpMia(page);
  await listenWith(page, { heard: "I like cats", route: { kind: "say", text: "I like cats" } });
  await openMia(page);
  const line = await page.getByTestId("nova-line").innerText();
  const say = page.waitForRequest((r) => r.url().endsWith("/say") && r.method() === "POST", { timeout: 10_000 });
  await mic(page).click();
  expect((await say).postDataJSON()).toEqual({ text: "I like cats" });
  await expect(page.getByText("I heard: I like cats")).toBeVisible();
  const lead = page.getByTestId("nova-line").locator("[data-lead]");
  await expect(lead).toBeVisible();
  await expect(lead).not.toHaveText("");
  await expect(page.getByTestId("nova-line")).toContainText(line);
  expect(await attempts(parentId)).toBe(0);
});

test("mic denied: the mic goes away and the tiles still answer", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
  });
  const parentId = await setUpMia(page);
  await openMia(page);
  await mic(page).click();
  await expect(mic(page)).toHaveCount(0);
  const version = await page.locator("main").getAttribute("data-version");
  await tiles(page).first().click();
  await expect(page.locator("main")).not.toHaveAttribute("data-version", version!);
  await expect.poll(() => attempts(parentId)).toBe(1);
  await expect(mic(page)).toHaveCount(0); // hidden for the page's life
});

test("Nova speaks: the first line is voiced without the name, and tapping Nova asks again", async ({ page }) => {
  await setUpMia(page);
  const voiced: Request[] = [];
  page.on("request", (r) => { if (r.url().endsWith("/speak") || r.url().includes("/audio/nova/")) voiced.push(r); });
  await openMia(page);
  await expect.poll(() => voiced.length).toBeGreaterThanOrEqual(1);
  const first = voiced[0]!;
  expect(first.url()).toMatch(/\/speak$/); // no clips in the test manifest
  const { text, token } = first.postDataJSON() as { text: string; token: string };
  expect(text.length).toBeGreaterThan(0);
  expect(token.length).toBeGreaterThan(0);
  expect(text).not.toContain("Mia");
  const res = await first.response();
  expect(res?.status()).toBe(200);
  expect(res?.headers()["content-type"]).toBe("audio/mpeg");
  const n = voiced.length;
  await page.getByRole("button", { name: "Hear Nova again" }).click();
  await expect.poll(() => voiced.length).toBeGreaterThan(n);
  expect(voiced.slice(n).some((r) => r.url().endsWith("/speak") && (r.postDataJSON() as { text: string }).text === text)).toBe(true);
});

test("leaving mid-listen: the hanging /listen is dropped and nothing is answered afterwards", async ({ page }) => {
  const parentId = await setUpMia(page);
  const sent = answers(page);
  await page.route("**/api/kids/*/listen", () => {}); // never answers
  await openMia(page);
  await mic(page).click();
  await expect(mic(page)).toHaveAttribute("data-mic", "thinking", { timeout: 10_000 });
  await page.getByRole("link", { name: "I'm done for now" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.waitForTimeout(2000);
  expect(sent).toEqual([]);
  expect(await attempts(parentId)).toBe(0);
});

test("problem changed mid-listen: a tile tap wins and a late /listen answer is dropped", async ({ page }) => {
  const parentId = await setUpMia(page);
  const sent = answers(page);
  await listenWith(page, { heard: "twelve", route: { kind: "answer", n: 12 } }, 1500);
  await openMia(page);
  const tile = tiles(page).first();
  const given = Number(await tile.innerText());
  await mic(page).click();
  await tile.click();
  await expect.poll(() => attempts(parentId)).toBe(1);
  await page.waitForTimeout(3000); // past the stubbed /listen delay and a full recording
  expect(await attempts(parentId)).toBe(1);
  expect(sent.map((a) => a.given)).toEqual([given]);
});
