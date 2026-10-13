import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test, expect } from "@playwright/test";
import { ProjectResponseSchema } from "@qelvra/shared";
import { fixtureRepository } from "../fixtures/git-repository";
import { E2E_API_URL } from "./env";

test("register, inspect, refresh, reload and unregister a real local repository", async ({
  page,
  request,
}) => {
  const root = await mkdtemp(join(tmpdir(), "qelvra-project-browser-"));
  const repo = await fixtureRepository(join(root, "repo"));
  let id = "";
  try {
    await page.goto("/files");
    await page.getByRole("link", { name: "Projects — inspect local repositories" }).click();
    await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
    await page.getByLabel("Display name", { exact: true }).fill("Browser project");
    await page.getByLabel("Absolute repository path").fill(repo);
    const admitted = page.waitForResponse(
      (r) => r.url().endsWith("/api/projects") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Register project", exact: true }).click();
    const response = await admitted;
    expect(response.status()).toBe(201);
    id = ProjectResponseSchema.parse(await response.json()).project.id;
    const details = page.getByRole("region", { name: "Repository details" });
    await expect(details).toContainText("main");
    await expect(details).toContainText("0 staged · 0 unstaged");
    await expect(details).toContainText("Stored snapshot");
    await writeFile(join(repo, "README.md"), "Modified\n");
    await page.reload();
    await expect(details).toContainText("0 staged · 0 unstaged");
    await page.getByRole("button", { name: "Refresh inspection" }).click();
    await expect(details).toContainText("0 staged · 1 unstaged");
    await page.getByRole("button", { name: "Reload list" }).click();
    await expect(details).toContainText("0 staged · 1 unstaged");
    await page.getByRole("button", { name: "Unregister project", exact: true }).click();
    await expect(
      page.getByText("Remove this registration? Repository files will stay on disk."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(details).toBeVisible();
    await page.getByRole("button", { name: "Unregister project", exact: true }).click();
    await page.getByRole("button", { name: "Confirm unregister" }).click();
    await expect(page.getByRole("main").getByRole("status")).toContainText(
      "Repository files were preserved",
    );
    expect((await request.get(`${E2E_API_URL}/api/projects/${id}`)).status()).toBe(404);
  } finally {
    if (id) await request.delete(`${E2E_API_URL}/api/projects/${id}`);
    await rm(root, { recursive: true, force: true });
  }
});

test("registration failure is recoverable and absent repository refresh is persisted honestly", async ({
  page,
  request,
}) => {
  const root = await mkdtemp(join(tmpdir(), "qelvra-project-error-"));
  const repo = await fixtureRepository(join(root, "repo"));
  let id = "";
  try {
    await page.goto("/projects");
    await page.getByLabel("Display name", { exact: true }).fill("Recovery project");
    await page.getByLabel("Absolute repository path").fill(join(root, "missing"));
    await page.getByRole("button", { name: "Register project", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("PROJECT_INVALID_PATH");
    await page.getByLabel("Absolute repository path").fill(repo);
    const admitted = page.waitForResponse(
      (r) => r.url().endsWith("/api/projects") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Register project", exact: true }).click();
    id = ProjectResponseSchema.parse(await (await admitted).json()).project.id;
    await rm(repo, { recursive: true, force: true });
    await page.getByRole("button", { name: "Refresh inspection" }).click();
    await expect(page.getByRole("alert")).toContainText("Inspection unavailable");
    await page.reload();
    await expect(page.getByRole("alert")).toContainText("PROJECT_INVALID_PATH");
  } finally {
    if (id) await request.delete(`${E2E_API_URL}/api/projects/${id}`);
    await rm(root, { recursive: true, force: true });
  }
});

test("loading, retry, unknown selection and disabled in-flight controls", async ({ page }) => {
  let release = () => {};
  let fail = true;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  await page.route("**/api/projects", async (route) => {
    await gate;
    if (fail)
      await route.fulfill({
        status: 503,
        json: { error: { code: "PROJECT_BUSY", message: "Storage unavailable" } },
      });
    else await route.fulfill({ json: { projects: [], limit: 100 } });
  });
  await page.goto("/projects");
  await expect(page.getByRole("main").getByRole("status")).toContainText("Loading projects");
  await expect(page.getByRole("button", { name: "Register project", exact: true })).toBeDisabled();
  release();
  await expect(page.getByRole("alert")).toContainText("Storage unavailable");
  fail = false;
  await page.getByRole("button", { name: "Reload list" }).click();
  await expect(
    page.getByText("No registered projects. Add an existing local repository above."),
  ).toBeVisible();
  await page.goto("/projects?project=project-unknown");
  await expect(page.getByRole("alert")).toContainText("no longer registered");
});
