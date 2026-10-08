import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { test, expect } from "@playwright/test";
import { E2E_API_URL } from "../e2e/env";
// No Memory Stitch reference exists; inherit the live shell/tokens without changing global parity.
test("Memory has readable editor states at desktop and mobile widths", async ({
  page,
  request,
}) => {
  const response = await request.post(E2E_API_URL + "/api/agents", {
    data: {
      name: "Memory Design",
      role: "Engineer",
      providerId: "fake",
    },
  });
  expect(response.status()).toBe(201);
  const agent = (await response.json()).agent;
  try {
    const url = E2E_API_URL + "/api/agents/" + agent.id + "/memory";
    const m = (await (await request.get(url)).json()).memory;
    await request.put(url, {
      data: {
        content:
          "# Agent Memory\n\nPrefers concise API responses.\nKeep private project notes local.\n",
        expectedRevision: m.revision,
      },
    });
    await page.goto("/memory?agent=" + agent.id);
    const editor = page.getByLabel("Agent memory content");
    await expect(editor).toContainText("Prefers concise");
    await editor.fill(
      "# Agent Memory\n\nPrefers concise API responses.\nAn unsaved note, ready to save.\n",
    );
    const save = page.getByRole("button", { name: "Save", exact: true });
    await expect(save).toBeEnabled();
    expect(await save.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(60, 0, 145)");
    await page.evaluate(() => document.fonts.ready);
    const captures = resolve(".impeccable/review");
    await mkdir(captures, { recursive: true });
    for (const [name, width, height] of [
      ["desktop", 1440, 900],
      ["mobile", 390, 844],
    ] as const) {
      await page.setViewportSize({ width, height });
      await expect(page.getByRole("heading", { name: "Memory", exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const main = await page.getByRole("region", { name: "Agent memory editor" }).boundingBox();
      const info = await page
        .getByRole("complementary", { name: "Memory information" })
        .boundingBox();
      if (!main || !info) throw new Error("Missing Memory panels");
      expect(main.width).toBeGreaterThan(width > 1000 ? 600 : 280);
      if (width > 1000) expect(info.x).toBeGreaterThanOrEqual(main.x + main.width);
      else expect(info.y).toBeGreaterThanOrEqual(main.y + main.height);
      expect(await editor.evaluate((el) => getComputedStyle(el).fontFamily)).toContain(
        "JetBrains Mono",
      );
      expect(await editor.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
        "rgb(14, 14, 16)",
      );
      await page.screenshot({ path: resolve(captures, name + ".png"), fullPage: true });
    }
  } finally {
    await request.delete(E2E_API_URL + "/api/agents/" + agent.id);
  }
});
