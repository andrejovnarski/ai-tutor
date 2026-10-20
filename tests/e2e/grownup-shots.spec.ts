// Screenshots of every grown-up screen at tablet, phone and big-tablet sizes, saved to test-results/grownup/ (git-ignored).
// Also checks horizontal overflow, clipped text and 44 px targets on every screen. With REWARDS=on, Mia finishes a session so her page shows Rewards.
import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { CLUSTERS } from "../../src/domain/curriculum/index";
import { admin } from "../helpers/admin";
import { hideDevBadge, parentId, requestLink, signIn, unique } from "./helpers";

// The brief asked for the 40-character "Alexandria Maximiliana Wolfeschlegelstei" (the input's maxLength), but the
// server (parseKidProfile) and the database (kids_nickname_check) both cap a nickname at 20. So the stress case is
// the widest possible stored name: 20 capital Ws with no break opportunity.
const LONG = "W".repeat(20);
const SIZES = [
  { name: "tablet", width: 1024, height: 768 },
  { name: "narrow", width: 320, height: 568 },
  { name: "phone", width: 390, height: 844 },
  { name: "portrait", width: 768, height: 1024 },
  { name: "pro", width: 1366, height: 1024 },
];

async function addKidWith(page: Page, name: string, avatar: string) {
  await page.goto("/parent/kids/new");
  await page.getByLabel("First name only").fill(name);
  await page.getByLabel("Grade").selectOption("K");
  await page.locator("label", { hasText: avatar }).click(); // the radio itself is visually hidden
}

for (const size of SIZES) {
  test(`grown-up screens at ${size.name} size`, async ({ page }) => {
    test.setTimeout(120_000);
    mkdirSync("test-results/grownup", { recursive: true });
    await page.setViewportSize({ width: size.width, height: size.height });
    await hideDevBadge(page);
    const shot = async (screen: string) => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${size.name} ${screen} scrolls sideways`).toBeLessThanOrEqual(0);
      const SLACK = 6; // Glyph tails may overhang; a clipped line is about 20 px.
      const clipped = await page.evaluate(() => {
        const problems: { text: string; x: number; y: number }[] = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          const el = node.parentElement!;
          if (!node.textContent?.trim() || el.closest("script, style, nextjs-portal")) continue;
          const style = getComputedStyle(el);
          if (style.visibility === "hidden" || !el.getClientRects().length) continue;
          let left = 0, right = innerWidth, top = -Infinity, bottom = Infinity;
          let hidden = false;
          for (let ancestor: Element | null = el; ancestor; ancestor = ancestor.parentElement) {
            const css = getComputedStyle(ancestor), box = ancestor.getBoundingClientRect();
            if (css.clipPath === "inset(50%)" || css.clip === "rect(0px, 0px, 0px, 0px)") { hidden = true; break; }
            if (css.overflowX !== "visible") { left = Math.max(left, box.left); right = Math.min(right, box.right); }
            // Full-page shots may scroll vertically, but nested containers must not cut off text.
            if (css.overflowY !== "visible" && ancestor !== document.body && ancestor !== document.documentElement) {
              top = Math.max(top, box.top); bottom = Math.min(bottom, box.bottom);
            }
          }
          if (hidden) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const box of range.getClientRects()) problems.push({
            text: node.textContent.trim().slice(0, 80),
            x: Math.max(0, left - box.left, box.right - right),
            y: Math.max(0, top - box.top, box.bottom - bottom),
          });
        }
        return problems;
      });
      for (const text of clipped) {
        expect.soft(text.x, `${size.name} ${screen} "${text.text}" clips horizontally`).toBeLessThanOrEqual(SLACK);
        expect.soft(text.y, `${size.name} ${screen} "${text.text}" clips vertically`).toBeLessThanOrEqual(SLACK);
      }
      for (const control of await page.locator("a, button, input, select").all()) {
        if (!(await control.isVisible())) continue;
        // Visually hidden avatar radios, and checkboxes, use their wrapping label as the tap target.
        const target = await control.evaluate(el => {
          const css = getComputedStyle(el);
          const hidden = css.clipPath === "inset(50%)" || css.clip === "rect(0px, 0px, 0px, 0px)";
          const labelled = el instanceof HTMLInputElement && (hidden || el.type === "checkbox" || el.type === "radio");
          const surface = labelled ? (el as HTMLInputElement).labels?.[0] ?? el : el;
          return { height: surface?.getBoundingClientRect().height ?? 0, name: el.getAttribute("aria-label") ?? el.getAttribute("name") ?? el.textContent?.trim() };
        });
        expect.soft(target.height, `${size.name} ${screen} ${target.name} target height`).toBeGreaterThanOrEqual(44);
      }
      await page.screenshot({ path: `test-results/grownup/${size.name}-${screen}.png`, fullPage: true });
    };

    const email = unique("shots");
    await page.goto("/sign-in");
    await shot("1-sign-in");
    await requestLink(page, email);
    await shot("2-check-email");
    await signIn(page, email);
    await page.goto("/parent");
    await expect(page).toHaveURL(/\/parent\/pin$/);
    await shot("3-set-pin");
    await page.getByLabel("New PIN", { exact: true }).fill("1234");
    await page.getByLabel("Repeat PIN").fill("1234");
    await shot("4-set-pin-filled");
    await page.getByRole("button", { name: "Save PIN" }).click();
    await expect(page).toHaveURL(/\/parent$/);
    await shot("5-home-before-consent");

    // Unlock screen: drop the PIN cookie.
    await page.context().clearCookies({ name: "parent_ok" });
    await page.goto("/parent");
    await expect(page.getByRole("heading", { name: "Enter your PIN" })).toBeVisible();
    await page.getByLabel("PIN", { exact: true }).fill("12");
    await shot("6-unlock");
    await page.getByLabel("PIN", { exact: true }).fill("1234");
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page).toHaveURL(/\/parent$/);

    await page.goto("/parent/consent");
    await shot("7-consent");
    await page.goto("/parent/privacy");
    await shot("8-privacy");

    await page.goto("/parent/consent");
    await page.getByLabel(/I have read the privacy notice/).check();
    await page.getByRole("button", { name: "Verify with a card (no charge)" }).click();
    await expect(page).toHaveURL(/\/parent\?consented=1$/);
    await shot("9-consented");

    await addKidWith(page, "Mia", "fox");
    await shot("10-add-child");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/parent$/);
    // Added straight to the database: the form's name rules are not what this test is about.
    const { error } = await admin().from("kids")
      .insert({ parent_id: await parentId(email), nickname: LONG, grade: "K", age_band: "5-7", avatar: "owl" });
    if (error) throw error;

    // Mia finishes a session: it began 25 minutes ago, so it winds down after an answer or two.
    const { data: mia } = await admin().from("kids").select("id").eq("parent_id", await parentId(email)).eq("nickname", "Mia").single();
    await admin().from("kids").update({ placed: true }).eq("id", mia!.id);
    await page.goto("/");
    await page.getByRole("link", { name: /Mia/ }).click();
    await expect(page.getByTestId("say")).toBeVisible();
    const { data: open } = await admin().from("sessions").select("id, state").eq("kid_id", mia!.id).is("ended_at", null).single();
    await admin().from("sessions")
      .update({ state: { ...(open!.state as object), startedAt: Date.now() - 25 * 60_000 } }).eq("id", open!.id);
    const card = page.getByTestId("end-card");
    for (let i = 0; i < 12 && !(await card.isVisible()); i++) {
      await expect(page.getByTestId("say").or(card)).toBeVisible();
      if (await card.isVisible()) break;
      const before = await page.locator("main").getAttribute("data-version");
      if (await page.getByTestId("choices").count()) await page.getByTestId("choices").getByRole("button").first().click();
      else {
        await page.getByRole("button", { name: "1", exact: true }).click();
        await page.getByRole("button", { name: "OK" }).click();
      }
      await expect(page.locator("main")).not.toHaveAttribute("data-version", before!);
    }
    await expect(card).toBeVisible();

    await page.goto("/parent");
    await shot("11-your-kids");
    await page.getByRole("link", { name: /Mia/ }).first().click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Mia");
    await expect(page.getByRole("heading", { name: "Rewards" })).toBeVisible();
    await expect(page.getByText(/First game/)).toBeVisible();
    await shot("12-mia-progress-and-sessions");

    await page.goto("/parent");
    await page.getByRole("link", { name: /WWWW/ }).first().click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("WWWW");
    await shot("13-long-name-child");

    // Retain the maximum-width name screenshot, then show exactly Mia + Alexandrina.
    const { error: renameError } = await admin().from("kids").update({ nickname: "Alexandrina" })
      .eq("parent_id", await parentId(email)).eq("nickname", LONG);
    if (renameError) throw renameError;
    const learned = CLUSTERS.slice(0, 2).flatMap(cluster => cluster.skills.map(skill => skill.id));
    const { error: clearError } = await admin().from("skill_state").delete().eq("kid_id", mia!.id);
    if (clearError) throw clearError;
    const { error: seedError } = await admin().from("skill_state").insert(learned.map(skillId => ({
      kid_id: mia!.id, skill_id: skillId, p_known: 0.99, attempts: 10, level: 1,
      correct_streak: 5, wrong_streak: 0, placed: false, recent_tags: [],
      check_due: new Date(Date.UTC(9999, 0, 1)).toISOString(),
    })));
    if (seedError) throw seedError;
    const { data: flags, error: flagError } = await admin().from("skill_state").select("mastered_at").eq("kid_id", mia!.id);
    if (flagError) throw flagError;
    expect(flags).toHaveLength(learned.length);
    for (const flag of flags!) expect(flag.mastered_at, "learned skill has a permanent flag").toBeTruthy();
    await page.goto("/parent");
    await expect(page.getByRole("link", { name: /Mia/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Alexandrina/ })).toBeVisible();
    await shot("11a-your-kids-long-name");
    await page.getByRole("link", { name: /Mia/ }).click();
    const map = page.getByRole("img", { name: /^Map:/ });
    await expect(map).toHaveAttribute("aria-label", /2 islands done. Now on Adding Island, 0 of/);
    await expect(map.locator('[data-flag="up"]')).toHaveCount(learned.length);
    await shot("12a-mia-islands-flags");

    await page.goto("/parent/account");
    await shot("14-account");
  });
}
