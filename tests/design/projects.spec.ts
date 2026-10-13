import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { test, expect } from "@playwright/test";
import { ProjectRegistry } from "../../apps/server/src/projects/project-registry";
import { fixtureRepository } from "../fixtures/git-repository";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("Projects keeps the existing shell and usable repository details on desktop and mobile", async ({
  page,
}) => {
  const root = await mkdtemp(join(tmpdir(), "qelvra-project-design-"));
  await mkdir(join(root, "data"));
  const repo = await fixtureRepository(
    join(root, "a-long-repository-path-for-responsive-verification"),
  );
  const registry = await ProjectRegistry.open(join(root, "data"));
  try {
    await registry.register({ name: "Foundation repository", path: repo });
    await page.route("**/api/projects", (route) => route.fulfill({ json: registry.list() }));
    await page.goto("/projects");
    await expect(page.getByRole("region", { name: "Repository details" })).toContainText("main");
    await page.evaluate(() => document.fonts.ready);
    const captures = resolve(".impeccable/review/projects");
    await mkdir(captures, { recursive: true });
    for (const [name, width, height] of [
      ["desktop", 1440, 900],
      ["mobile", 390, 844],
    ] as const) {
      await page.setViewportSize({ width, height });
      await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const form = await page.getByRole("region", { name: "Register repository" }).boundingBox();
      const details = await page.getByRole("region", { name: "Repository details" }).boundingBox();
      expect(details?.width).toBeGreaterThan(width > 1000 ? 500 : 280);
      expect(form?.y).toBeGreaterThan(48);
      const action = page.getByRole("button", { name: "Register project", exact: true });
      expect(await action.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(60, 0, 145)");
      await page.getByLabel("Display name", { exact: true }).focus();
      expect(
        await page
          .getByLabel("Display name", { exact: true })
          .evaluate((el) => getComputedStyle(el).outlineStyle),
      ).toBe("solid");
      await page.screenshot({ path: resolve(captures, name + ".png"), fullPage: true });
    }
  } finally {
    await registry.close();
    await rm(root, { recursive: true, force: true });
  }
});
