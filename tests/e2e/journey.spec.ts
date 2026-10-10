// Spec §10 end to end on a tablet: sign-up, PIN, consent (fake gateway), kid, 5 answers, weekly report.
import { expect, test } from "@playwright/test";
import { latestEmailTo, mailCountTo } from "../helpers/admin";
import { addKid, setPin, signIn, unique } from "./helpers";

const ET = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "2-digit", hourCycle: "h23" });

/** The first Sunday 17:00 America/New_York after `from` (at most about a week ahead), as epoch ms. */
function nextSunday5pmET(from: Date): number {
  const t = new Date(from);
  t.setUTCMinutes(0, 0, 0);
  for (let i = 0; i < 24 * 8; i++) {
    t.setTime(t.getTime() + 3_600_000);
    const p = Object.fromEntries(ET.formatToParts(t).map((x) => [x.type, x.value]));
    if (p.weekday === "Sun" && Number(p.hour) === 17) return t.getTime();
  }
  throw new Error("no Sunday 17:00 found");
}

test("parent journey: sign up, PIN, consent, kid, play 5 answers, weekly report arrives", async ({ page, request }) => {
  test.setTimeout(180_000);
  const email = unique("journey");

  await signIn(page, email);
  await setPin(page);

  await page.getByRole("link", { name: "Give consent" }).click();
  await page.getByLabel(/I have read the privacy notice/).check();
  await page.getByRole("button", { name: "Verify with a card (no charge)" }).click();
  await expect(page).toHaveURL(/\/parent\?consented=1$/);

  await addKid(page, "Juno");
  await page.goto("/");
  await page.getByRole("link", { name: /Juno/ }).click();
  await expect(page).toHaveURL(/\/play\/[0-9a-f-]{36}$/);

  await expect(page.getByTestId("say")).toBeVisible();
  for (let i = 0; i < 5; i++) {
    await expect(page.getByTestId("choices").or(page.getByRole("button", { name: "OK" }))).toBeVisible();
    const before = await page.locator("main").getAttribute("data-version");
    if (await page.getByTestId("choices").count()) await page.getByTestId("choices").getByRole("button").first().click();
    else {
      await page.getByRole("button", { name: "1", exact: true }).click();
      await page.getByRole("button", { name: "OK" }).click();
    }
    await expect(page.locator("main")).not.toHaveAttribute("data-version", before!);
  }

  const now = nextSunday5pmET(new Date());
  const res = await request.get(`/api/cron/weekly-report?now=${now}`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    timeout: 150_000,
  });
  expect(res.status()).toBe(200);

  await expect.poll(() => mailCountTo(email, 'subject:"Your week with Math Friend"')).toBe(1);
  const mail = await latestEmailTo(email);
  expect(mail.Text).toContain("Juno");
  const m = /(\d+) sessions?/.exec(mail.Text);
  expect(m, mail.Text).not.toBeNull();
  expect(Number(m![1])).toBeGreaterThanOrEqual(1);
});
