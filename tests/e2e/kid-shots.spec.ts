// Screenshots of the kid screens at tablet sizes (and a phone, for reference), saved to test-results/kid/ (git-ignored).
// Also checks that no screen scrolls sideways or down. With REWARDS=on the end card carries the rewards strip and the
// picker cards their level, mini map and shells.
import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { CLUSTERS, SKILLS } from "../../src/domain/curriculum/index";
import { admin } from "../helpers/admin";
import { consent, forcePending, hideDevBadge, signIn, unique } from "./helpers";

const SIZES = [
  { name: "landscape", width: 1024, height: 768 },
  { name: "portrait", width: 768, height: 1024 },
  { name: "pro", width: 1366, height: 1024 },
  { name: "phone", width: 390, height: 844 },
  // Between the narrow layout (600 px and under) and a tablet: the end card's strip and the picker cards at the seam.
  { name: "small", width: 600, height: 960 },
  { name: "mid", width: 640, height: 900 },
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

/** Seed earned flags separately from known-at-start flags; suppress recall checks. */
async function seedMap(kidId: string, learned: string[], placed: string[] = []) {
  const db = admin();
  const { error: kidError } = await db.from("kids").update({ placed: true }).eq("id", kidId);
  if (kidError) throw kidError;
  // Earlier screenshot play may have placed extra skills; make this fixture exact.
  const { error: clearError } = await db.from("skill_state").delete().eq("kid_id", kidId);
  if (clearError) throw clearError;
  const { error } = await db.from("skill_state").insert([...learned, ...placed].map(skillId => ({
    kid_id: kidId, skill_id: skillId, p_known: 0.99, attempts: 10, level: 1,
    correct_streak: 5, wrong_streak: 0, placed: placed.includes(skillId), recent_tags: [],
    check_due: new Date(Date.UTC(9999, 0, 1)).toISOString(),
  })));
  if (error) throw error;
  const { data, error: readError } = await db.from("skill_state").select("skill_id, mastered_at")
    .eq("kid_id", kidId).in("skill_id", learned);
  if (readError) throw readError;
  expect(data).toHaveLength(learned.length);
  for (const row of data!) expect(row.mastered_at, `${row.skill_id} earned a permanent flag`).toBeTruthy();
}

/** Start with a real engine state, then persist a finished session that earned a flag. */
async function mapEndCard(page: Page, kidId: string, learnedNow: string[]) {
  await page.goto(`/play/${kidId}`);
  await expect(page.getByTestId("say")).toBeVisible();
  const open = await pending(kidId);
  const now = Date.now();
  const { error } = await admin().from("sessions").update({
    ended_at: new Date(now).toISOString(),
    state: { ...open.state, ended: true, pending: null, problems: 2, firstTryCorrect: 1,
      mastered: learnedNow, startedAt: now - 10 * 60_000, lastActivity: now },
  }).eq("id", open.id);
  if (error) throw error;
  await page.reload();
  await expect(page.getByTestId("end-card")).toBeVisible();
  const map = page.getByTestId("end-card").getByRole("img", { name: /^Map:/ });
  await expect(map.locator('[data-new="true"]').first()).toBeAttached();
  for (const flag of await map.locator('[data-new="true"]').all()) await expect(flag).toHaveAttribute("data-flag", "up");
  return map;
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
      const endMap = page.getByTestId("end-card").locator('svg[role="img"][aria-label^="Map:"]');
      if (await page.getByTestId("end-card").count()) {
        await expect(endMap).toBeVisible();
        const cardOverflow = await page.getByTestId("end-card").evaluate(el => el.parentElement!.scrollHeight - el.parentElement!.clientHeight);
        expect.soft(cardOverflow, `${size.name} ${screen} end card scrolls inside its area`).toBeLessThanOrEqual(0);
        const mapBox = await endMap.boundingBox();
        const floor = ["landscape", "portrait", "pro"].includes(size.name) ? 140 : 90;
        expect.soft(mapBox!.height, `${size.name} ${screen} map height`).toBeGreaterThanOrEqual(floor);
      }
      for (const name of await page.locator('[data-picker-name]').all()) {
        const metrics = await name.evaluate((el) => ({
          scroll: el.scrollWidth, width: el.clientWidth, height: el.getBoundingClientRect().height,
          line: parseFloat(getComputedStyle(el).lineHeight),
        }));
        expect.soft(metrics.scroll, `${size.name} ${screen} name overflows`).toBeLessThanOrEqual(metrics.width);
        expect.soft(metrics.height, `${size.name} ${screen} name wraps too far`).toBeLessThanOrEqual(2 * metrics.line);
      }
      // Glyph tails can overhang by a few px; a clipped line is ~20 px or more.
      const SLACK = 6;
      for (const surface of await page.locator('[data-testid="end-card"], svg[aria-label^="Map:"], [data-picker-name]').all()) {
        const clipped = await surface.evaluate((el, scrolls) => {
          const box = el.getBoundingClientRect();
          let left = 0, top = scrolls ? -Infinity : 0, right = innerWidth, bottom = scrolls ? Infinity : innerHeight;
          for (let node = el.parentElement; node; node = node.parentElement) {
            const style = getComputedStyle(node), rect = node.getBoundingClientRect();
            if (style.overflowX !== "visible") { left = Math.max(left, rect.left); right = Math.min(right, rect.right); }
            if (style.overflowY !== "visible" && !(scrolls && (node === document.body || node === document.documentElement))) { top = Math.max(top, rect.top); bottom = Math.min(bottom, rect.bottom); }
          }
          return { x: Math.max(0, left - box.left, box.right - right), y: Math.max(0, top - box.top, box.bottom - bottom) };
        }, !!opts.scrolls);
        expect.soft(clipped.x, `${size.name} ${screen} surface clips horizontally`).toBeLessThanOrEqual(SLACK);
        expect.soft(clipped.y, `${size.name} ${screen} surface clips vertically`).toBeLessThanOrEqual(SLACK);
      }
      for (const id of ["progress-today", "progress-next"]) {
        const line = page.getByTestId(id);
        if (!(await line.count())) continue;
        const overflow = await line.evaluate((el) => [el.parentElement!, el].map((node) => ({
          x: node.scrollWidth - node.clientWidth,
          y: node.scrollHeight - node.clientHeight,
        })));
        for (const [index, over] of overflow.entries()) {
          expect.soft(over.x, `${size.name} ${screen} ${id} text ${index} clips horizontally`).toBeLessThanOrEqual(SLACK);
          expect.soft(over.y, `${size.name} ${screen} ${id} text ${index} clips vertically`).toBeLessThanOrEqual(SLACK);
        }
      }
      if (await page.getByTestId("say").count()) {
        const bubble = page.getByTestId("nova-line");
        // Check both the scrolling bubble and its text blocks: a full-height child can still be clipped by its parent.
        const overflow = await bubble.evaluate((el) => [el, ...el.children].map((node) => ({
          x: node.scrollWidth - node.clientWidth,
          y: node.scrollHeight - node.clientHeight,
        })));
        // Glyph tails overhang the line box by a few px; a clipped line is ~20 px or more.
        for (const [index, over] of overflow.entries()) {
          expect.soft(over.x, `${size.name} ${screen} Nova text ${index} clips horizontally`).toBeLessThanOrEqual(SLACK);
          expect.soft(over.y, `${size.name} ${screen} Nova text ${index} clips vertically`).toBeLessThanOrEqual(SLACK);
        }
        const help = page.getByTestId("help");
        if (await help.count()) {
          const lines = await help.evaluate((el) => {
            const range = document.createRange();
            range.selectNodeContents(el);
            return range.getClientRects().length;
          });
          expect.soft(lines, `${size.name} ${screen} Help me wraps`).toBe(1);
        }
      }
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
    await expect(page.getByTestId("rewards-strip")).toBeVisible();
    await expect(page.getByTestId("progress-today")).toBeVisible();
    await expect(page.getByTestId("progress-next")).toBeVisible();
    // The card's area scrolls rather than cut a tall card off; at these sizes the whole card fits.
    const cardOver = await card.evaluate((el) => el.parentElement!.scrollHeight - el.parentElement!.clientHeight);
    expect.soft(cardOver, `${size.name} end card scrolls inside its area`).toBeLessThanOrEqual(0);
    await shot("6-end-card");

    // Exercise the longest kid name through the real end-card rendering, keeping the earned rewards.
    await page.route("**/api/kids/*/turn", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      if (body.turn.kind === "end") body.turn.progress = {
        today: "You practiced Big taking away with borrowing.",
        next: "Next time: more Big taking away with borrowing",
      };
      await route.fulfill({ response, json: body });
    });
    await page.reload();
    await expect(page.getByTestId("progress-today")).toHaveText("You practiced Big taking away with borrowing.");
    await expect(page.getByTestId("progress-next")).toHaveText("Next time: more Big taking away with borrowing");
    if (size.name === "phone") {
      for (const id of ["progress-today", "progress-next"]) {
        const lines = await page.getByTestId(id).evaluate((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          return range.getClientRects().length;
        });
        expect(lines, `${id} wraps on a phone`).toBeGreaterThan(1);
      }
    }
    const longCardOver = await card.evaluate((el) => el.parentElement!.scrollHeight - el.parentElement!.clientHeight);
    expect.soft(longCardOver, `${size.name} long-progress end card scrolls inside its area`).toBeLessThanOrEqual(0);
    await shot("6a-end-card-long-progress");
    await page.unroute("**/api/kids/*/turn");

    // Back on the picker, Mia's card shows the level her session earned.
    await page.getByRole("link", { name: "Back to kids" }).click();
    await expect(page.getByRole("link", { name: /Mia/ })).toContainText(/Level \d+/);
    await shot("6b-picker-levels", { scrolls: true });

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

    // A fresh placed kid keeps the existing placement and end-card screenshots intact.
    await page.goto("/");
    const { data: family, error: familyError } = await admin().from("kids").select("parent_id").eq("id", ids.Mia!).single();
    if (familyError) throw familyError;
    const { data: frameKid, error: frameKidError } = await admin().from("kids").insert({
      parent_id: family!.parent_id, nickname: "Finn", grade: "K", age_band: "5-7", avatar: "fox",
    }).select("id").single();
    if (frameKidError) throw frameKidError;
    const kidId = frameKid!.id as string;
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

    await page.goto(`/play/${kidId}`);
    await expect(page.getByTestId("say")).toBeVisible();
    const current = await forcePending(page, kidId, {
      templateId: "make-ten-frame", skillId: "add-within-10.make-ten", seed: 0, level: 1,
    });
    expect(current.templateId).toBe("make-ten-frame");
    expect(current.problem.answer, "fixed frame seed has at least four empty cells").toBeGreaterThanOrEqual(4);
    expect(current.problem.answer, "at least three empty cells for screenshots").toBeGreaterThanOrEqual(3);
    await expect(page.locator("main")).not.toHaveAttribute("data-hold", "true");
    const frame = page.locator('[data-frame="true"]');
    const empty = frame.getByRole("button", { name: "Empty space, add a counter", exact: true });
    // Measure before adding: a frame with exactly three spaces has no empty buttons afterwards.
    if (size.name === "landscape") {
      expect(await empty.count()).toBeGreaterThanOrEqual(3);
      for (const cell of await empty.all()) {
        const box = await cell.boundingBox();
        expect(box, "tablet cell has a box").not.toBeNull();
        expect.soft(box!.width, "tablet cell width").toBeGreaterThanOrEqual(48);
        expect.soft(box!.height, "tablet cell height").toBeGreaterThanOrEqual(48);
      }
    }
    for (let i = 0; i < 3; i++) await empty.last().click();
    await expect(frame.locator('[data-counter="added"]')).toHaveCount(3);
    const reset = page.getByRole("button", { name: "Start over", exact: true });
    await expect(reset).toBeVisible();
    const SLACK = 6;
    for (const [name, controls] of [
      ["frame", frame], ["Start over", reset], ["answer tile", page.getByTestId("choices").getByRole("button")],
    ] as const) {
      expect(await controls.count(), `${size.name} ${name} exists`).toBeGreaterThan(0);
      for (const control of await controls.all()) {
        await expect(control).toBeVisible();
        // Intersect viewport with every ancestor, including overflow-hidden board/tray containers.
        const clipping = await control.evaluate((el) => {
          const box = el.getBoundingClientRect();
          let left = 0, top = 0, right = innerWidth, bottom = innerHeight;
          for (let node = el.parentElement; node; node = node.parentElement) {
            const style = getComputedStyle(node);
            const rect = node.getBoundingClientRect();
            if (style.overflowX !== "visible") { left = Math.max(left, rect.left); right = Math.min(right, rect.right); }
            if (style.overflowY !== "visible") { top = Math.max(top, rect.top); bottom = Math.min(bottom, rect.bottom); }
          }
          return { x: Math.max(0, left - box.left, box.right - right, el.scrollWidth - el.clientWidth),
            y: Math.max(0, top - box.top, box.bottom - bottom, el.scrollHeight - el.clientHeight) };
        });
        expect.soft(clipping.x, `${size.name} ${name} clips horizontally`).toBeLessThanOrEqual(SLACK);
        expect.soft(clipping.y, `${size.name} ${name} clips vertically`).toBeLessThanOrEqual(SLACK);
      }
    }
    await shot("9-fill-frame");

    const learned = CLUSTERS.slice(0, 2).flatMap(c => c.skills.map(s => s.id));
    const placed = CLUSTERS[2]!.skills.slice(0, 2).map(s => s.id);
    await seedMap(ids.Theo!, learned, placed);
    await seedMap(ids.Alexandrina!, SKILLS.map(s => s.id));
    await page.goto("/");
    const theoMap = page.getByRole("link", { name: /Theo/ }).locator('svg[aria-label^="Map:"]');
    await expect(theoMap).toHaveAttribute("aria-label", /2 islands done. Now on Adding Island, 2 of/);
    await expect(theoMap.locator('[data-flag="up"]')).toHaveCount(learned.length + placed.length);
    await expect(page.getByRole("link", { name: /Alexandrina/ }).locator('svg[aria-label="Map: all islands done!"]')).toBeVisible();
    await shot("10-picker-flags", { scrolls: true });

    // Earlier pad screenshots left these sessions open: finish those real states.
    const map = await mapEndCard(page, ids.Theo!, [learned[0]!]);
    await expect(map.locator('[data-rise="true"]').first()).toBeAttached();
    await expect(map.locator('[data-sail="true"]')).toBeAttached();
    await shot("11-end-card-new-flags");
    if (size.name === "landscape") {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.reload();
      await expect(card).toBeVisible();
      await expect(map.locator('[data-new="true"]')).toHaveCount(1);
      for (const flag of await map.locator('[data-new="true"]').all()) await expect(flag).toHaveAttribute("data-flag", "up");
      const nova = page.getByRole("img", { name: "Nova", exact: true });
      await expect(nova).toBeVisible();
      expect(await map.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
      expect(await nova.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
      await shot("11a-end-card-reduced-motion");
      await page.emulateMedia({ reducedMotion: "no-preference" });
    }

    const doneMap = await mapEndCard(page, ids.Alexandrina!, [SKILLS[0]!.id]);
    await expect(doneMap).toHaveAttribute("aria-label", "Map: all islands done!");
    await expect(doneMap.locator('[data-flag="up"]')).toHaveCount(SKILLS.length);
    await shot("12-end-card-all-islands");
  });
}
