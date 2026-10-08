import { randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { APIRequestContext } from "@playwright/test";
import { test, expect } from "./fixtures";
import { E2E_API_URL, E2E_WEB_URL, E2E_DATA_DIR } from "./env";
import { AGENT_MEMORY_LIMIT } from "@qelvra/shared";
async function agent(request: APIRequestContext, label = "Memory", api = E2E_API_URL) {
  const response = await request.post(api + "/api/agents", {
    data: {
      name: label + " " + randomBytes(3).toString("hex"),
      role: "Engineer",
      providerId: "fake",
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).agent as { id: string; name: string };
}
const memoryUrl = (id: string) => E2E_API_URL + "/api/agents/" + id + "/memory";
test("Memory saves real Markdown notes and Activity shows only metadata", async ({
  page,
  request,
}) => {
  const a = await agent(request),
    b = await agent(request, "Other Memory");
  await page.goto("/memory?agent=" + a.id);
  const editor = page.getByLabel("Agent memory content");
  await expect(editor).toHaveValue("# Agent Memory\n\nNo persistent notes yet.\n");
  await editor.fill("# Agent Memory\nPrefers concise API responses.");
  await page.keyboard.press("Control+s");
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  await page.getByLabel("Agent memory", { exact: true }).selectOption(b.id);
  await expect(editor).not.toHaveValue(/Prefers concise/);
  await page.getByLabel("Agent memory", { exact: true }).selectOption(a.id);
  await expect(editor).toHaveValue("# Agent Memory\nPrefers concise API responses.");
  await page.goto("/activity");
  await expect(page.getByText("Agent memory saved", { exact: true }).first()).toBeVisible();
  await expect(page.locator("main")).not.toContainText("Prefers concise API responses.");
  const activity = await (
    await request.get(E2E_API_URL + "/api/activity?type=memory.updated")
  ).json();
  expect(JSON.stringify(activity)).not.toContain("Prefers concise API responses.");
});
test("Memory protects unsaved notes on agent switch, route change and reload", async ({
  page,
  request,
}) => {
  const a = await agent(request),
    b = await agent(request);
  await page.goto("/memory?agent=" + a.id);
  const editor = page.getByLabel("Agent memory content");
  await expect(editor).toBeVisible();
  await editor.fill("UNSAVED_PRIVATE");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByLabel("Agent memory", { exact: true }).selectOption(b.id);
  await expect(editor).toHaveValue("UNSAVED_PRIVATE");
  await expect(page).toHaveURL(new RegExp(a.id));
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.locator("aside nav").getByRole("link", { name: /Tasks/ }).click();
  await expect(editor).toHaveValue("UNSAVED_PRIVATE");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Reload memory", exact: true }).click();
  await expect(editor).toHaveValue("UNSAVED_PRIVATE");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Agent memory", { exact: true }).selectOption(b.id);
  await expect(editor).toHaveValue("# Agent Memory\n\nNo persistent notes yet.\n");
});
test.describe(() => {
  test.use({
    allowedConsoleErrors: [/Failed to load resource: the server responded with a status of 409/],
  });
  test("Memory conflict keeps user edits and requires explicit reload", async ({
    page,
    request,
  }) => {
    const a = await agent(request);
    await page.goto("/memory?agent=" + a.id);
    const editor = page.getByLabel("Agent memory content");
    await expect(editor).toBeVisible();
    await editor.fill("LOCAL_UNSAVED");
    const initial = (await (await request.get(memoryUrl(a.id))).json()).memory;
    expect(
      (
        await request.put(memoryUrl(a.id), {
          data: { content: "EXTERNAL_SAVED", expectedRevision: initial.revision },
        })
      ).status(),
    ).toBe(200);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("MEMORY_CHANGED_ON_DISK");
    await expect(editor).toHaveValue("LOCAL_UNSAVED");
    expect((await (await request.get(memoryUrl(a.id))).json()).memory.content).toBe(
      "EXTERNAL_SAVED",
    );
    await page.getByRole("button", { name: "Keep editing" }).click();
    await expect(editor).toHaveValue("LOCAL_UNSAVED");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Reload memory", exact: true }).click();
    await expect(editor).toHaveValue("EXTERNAL_SAVED");
  });
});
test.describe(() => {
  test.use({
    allowedConsoleErrors: [
      /Failed to load resource: the server responded with a status of (413|415)/,
    ],
  });
  test("Memory initializes legacy notes and handles corrupt or oversized memory honestly", async ({
    page,
    request,
  }) => {
    const a = await agent(request);
    const path = join(E2E_DATA_DIR, "hive/agents", a.id, "memory.md");
    await unlink(path);
    await page.goto("/memory?agent=" + a.id);
    await expect(page.getByLabel("Agent memory content")).toContainText("No persistent notes yet.");
    await writeFile(path, Buffer.from([0xff]));
    await page.getByRole("button", { name: "Reload memory", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("MEMORY_INVALID_UTF8");
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
    await writeFile(path, "x".repeat(AGENT_MEMORY_LIMIT + 1));
    await page.getByRole("button", { name: "Reload memory", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("MEMORY_TOO_LARGE");
    await expect(page.getByLabel("Agent memory content")).toHaveCount(0);
  });
});
test.describe(() => {
  test.use({
    allowedConsoleErrors: [/Failed to load resource: the server responded with a status of 503/],
  });
  test("Memory renders empty-agent and API failure recovery states", async ({ page, request }) => {
    await page.route("**/api/agents", (route) => route.fulfill({ json: { agents: [] } }));
    await page.goto("/memory");
    await expect(page.getByRole("heading", { name: "No agents yet" })).toBeVisible();
    await page.unroute("**/api/agents");
    await page.route("**/api/agents", (route) =>
      route.fulfill({
        status: 503,
        json: { error: { code: "INTERNAL_ERROR", message: "Fixture API unavailable" } },
      }),
    );
    await page.reload();
    await expect(page.getByRole("alert")).toContainText("Fixture API unavailable");
    await page.unroute("**/api/agents");
    const a = await agent(request);
    await page.getByRole("button", { name: "Retry agents" }).click();
    await page.getByLabel("Agent memory", { exact: true }).selectOption(a.id);
    await expect(page.getByLabel("Agent memory content")).toBeVisible();
  });
});
test("Memory survives a real backend process restart", async ({ page, request }) => {
  const data = await mkdtemp(join(tmpdir(), "qelvra-memory-browser-restart-"));
  const api = "http://127.0.0.1:3096";
  let child: ChildProcess | undefined;
  const start = async () => {
    child = spawn(
      process.execPath,
      ["--import", "tsx", resolve("tests/fixtures/execution-server.ts")],
      {
        env: {
          ...process.env,
          NODE_ENV: "test",
          DATA_DIR: data,
          WORKSPACE_ROOT: data,
          PORT: "3096",
          WEB_ORIGIN: E2E_WEB_URL,
          LOG_LEVEL: "silent",
        },
        stdio: "ignore",
      },
    );
    await expect
      .poll(
        async () => {
          try {
            return (await request.get(api + "/api/health")).ok();
          } catch {
            return false;
          }
        },
        { timeout: 10000 },
      )
      .toBe(true);
  };
  const stop = async () => {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const current = child;
    const exited = new Promise<void>((done) => current.once("exit", () => done()));
    current.kill("SIGINT");
    const timer = setTimeout(() => current.kill("SIGKILL"), 5000);
    try {
      await exited;
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    await start();
    const a = await agent(request, "Restart Memory", api);
    await page.route("**/api/agents", async (route) =>
      route.fulfill({ response: await request.get(api + "/api/agents") }),
    );
    await page.route("**/api/agents/*/memory", async (route) => {
      const response = await request.fetch(api + new URL(route.request().url()).pathname, {
        method: route.request().method(),
        ...(route.request().postData()
          ? { data: route.request().postData(), headers: { "content-type": "application/json" } }
          : {}),
      });
      await route.fulfill({ response });
    });
    await page.goto("/memory?agent=" + a.id);
    const editor = page.getByLabel("Agent memory content");
    await expect(editor).toBeVisible();
    await editor.fill("Prefers concise API responses.");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
    await stop();
    await start();
    await page.reload();
    await expect(editor).toHaveValue("Prefers concise API responses.");
  } finally {
    await page.goto("about:blank");
    await stop();
    await rm(data, { recursive: true, force: true });
  }
});
