import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { test, expect } from "@playwright/test";
import { E2E_API_URL } from "../e2e/env";
// Files had no Stitch design or parity fixture. Its new operate surface inherits the
// app shell/tokens; verify layout and readability without changing global tolerances.
test("Files inherits the app shell and stays usable at desktop/mobile widths", async ({
  page,
  request,
}) => {
  const agent = (
    await (
      await request.post(`${E2E_API_URL}/api/agents`, {
        data: {
          name: `Files Design ${randomBytes(3).toString("hex")}`,
          role: "Frontend Engineer",
          providerId: "fake",
        },
      })
    ).json()
  ).agent;
  try {
    const base = `${E2E_API_URL}/api/agents/${agent.id}/files`;
    await request.post(base + "/directory", { data: { path: "src" } });
    await request.post(base + "/file", { data: { path: "README.md" } });
    const file = (await (await request.get(base + "/content?path=README.md")).json()).file;
    await request.put(base + "/content", {
      data: {
        path: file.path,
        revision: file.revision,
        content:
          "# Qelvra workspace\n\nHELLO_QELVRA\n\nThis file belongs to one agent’s isolated workspace.\n",
      },
    });
    await page.goto(`/files?agent=${agent.id}&file=README.md`);
    await expect(page.getByLabel("File content")).toContainText("HELLO_QELVRA");
    await page
      .getByLabel("File content")
      .fill("# Qelvra workspace\n\nHELLO_QELVRA\n\nAn unsaved edit, ready for review.\n");
    const save = page.getByRole("button", { name: "Save", exact: true });
    await expect(save).toBeEnabled();
    expect(await save.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(60, 0, 145)");
    await page.getByRole("button", { name: "New File", exact: true }).click();
    await page
      .getByRole("form", { name: "New file" })
      .getByLabel("Name", { exact: true })
      .fill("notes.txt");
    const create = page
      .getByRole("form", { name: "New file" })
      .getByRole("button", { name: "Create", exact: true });
    await expect(create).toBeEnabled();
    expect(await create.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(60, 0, 145)");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.evaluate(() => document.fonts.ready);
    const captures = resolve(".impeccable/review");
    await mkdir(captures, { recursive: true });
    for (const [name, width, height] of [
      ["desktop", 1440, 900],
      ["mobile", 390, 844],
    ] as const) {
      await page.setViewportSize({ width, height });
      await expect(page.getByRole("heading", { name: "Files", exact: true })).toBeVisible();
      const directory = await page
        .getByRole("region", { name: "Workspace directory" })
        .boundingBox();
      const editor = await page.getByRole("region", { name: "File editor" }).boundingBox();
      if (!directory || !editor) throw new Error("Missing Files panels");
      const filename = await page
        .getByRole("heading", { name: "README.md", exact: true })
        .boundingBox();
      expect(filename?.height).toBeLessThan(40);
      expect(editor.width).toBeGreaterThan(width > 1000 ? 500 : 280);
      if (width > 1000) expect(editor.x).toBeGreaterThan(directory.x + directory.width - 1);
      else expect(editor.y).toBeGreaterThanOrEqual(directory.y + directory.height - 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(
        await page.getByLabel("File content").evaluate((el) => getComputedStyle(el).fontFamily),
      ).toContain("JetBrains Mono");
      expect(
        await page
          .getByLabel("File content")
          .evaluate((el) => getComputedStyle(el).backgroundColor),
      ).toBe("rgb(14, 14, 16)");
      await page.screenshot({ path: resolve(captures, `${name}.png`), fullPage: true });
    }
  } finally {
    await request.delete(`${E2E_API_URL}/api/agents/${agent.id}`);
  }
});
