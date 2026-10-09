import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test, expect } from "@playwright/test";
import { createApp } from "../../apps/server/src/app";
import { loadConfig } from "../../apps/server/src/config/env";
import { ProviderRegistry, PROVIDER_DEFINITIONS } from "../../apps/server/src/providers";

test("Automations uses Qelvra tokens, readable persistent data and native forms on desktop/mobile", async ({
  page,
}) => {
  // Generated tasks and Activity are retained, so this fixture owns separate storage.
  const dir = await mkdtemp(join(tmpdir(), "qelvra-automations-design-"));
  const app = await createApp(
    loadConfig({ DATA_DIR: dir, WORKSPACE_ROOT: dir, NODE_ENV: "test", LOG_LEVEL: "silent" }),
    {
      logger: false,
      providerRegistry: new ProviderRegistry({
        allowFake: true,
        definitions: PROVIDER_DEFINITIONS.map((d) =>
          d.id === "fake"
            ? {
                ...d,
                execution: {
                  args: [resolve("tests/fixtures/execution-cli.mjs"), "failure"],
                  input: "json" as const,
                  output: "json" as const,
                },
              }
            : d,
        ),
      }),
      executionOptions: { timeoutMs: 10000 },
    },
  );
  try {
    await app.ready();
    const agentId = "automation-design";
    await app.runtime.create({
      id: agentId,
      name: "Workspace reviewer",
      role: "Disposable",
      providerId: "fake",
    });
    const { automation: a } = await app.automations.create({
      title: "Review workspace changes",
      taskTitle: "Check the latest changes",
      description:
        "Review recent edits in this agent’s isolated workspace. Report issues and leave the result for human review.",
      agentId,
      schedule: { kind: "interval", startsAt: "2035-01-01T09:00:00.000Z", everyMinutes: 60 },
    });
    await app.automations.runNow(a.id, a.revision);
    await expect
      .poll(() => app.automations.history(a.id).runs[0]?.status, { timeout: 15000 })
      .toBe("failed");
    // Render real persisted API responses without mutating the shared parity server.
    await page.route("**/api/**", async (route) => {
      expect(route.request().method()).toBe("GET");
      const url = new URL(route.request().url());
      const response = await app.inject({ method: "GET", url: url.pathname + url.search });
      await route.fulfill({
        status: response.statusCode,
        contentType: "application/json",
        body: response.body,
      });
    });
    await page.goto(`/automations?automation=${a.id}`);
    await expect(
      page.getByRole("region", { name: "Automation details", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Run history", exact: true })).toContainText(
      "Inspect the generated task",
    );
    await page.evaluate(() => document.fonts.ready);
    const captures = resolve(".impeccable/review/automations");
    await mkdir(captures, { recursive: true });
    for (const [name, width, height] of [
      ["desktop", 1440, 900],
      ["mobile", 390, 844],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(page.getByRole("main")).toHaveCount(1);
      expect(
        (await page.getByRole("heading", { name: "Automations", exact: true }).boundingBox())?.y,
      ).toBeGreaterThanOrEqual(48);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(
        await page
          .getByRole("button", { name: "New automation", exact: true })
          .evaluate((e) => getComputedStyle(e).color),
      ).toBe("rgb(60, 0, 145)");
      await page.screenshot({ path: resolve(captures, `${name}.png`), fullPage: true });
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      await expect(page.getByLabel("Task instructions", { exact: true })).toHaveValue(
        a.description,
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: resolve(captures, `${name}-form.png`), fullPage: true });
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
    }
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});
