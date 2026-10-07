import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { APIRequestContext } from "@playwright/test";
import { test, expect } from "./fixtures";
import { E2E_API_URL, E2E_DATA_DIR } from "./env";
async function agent(request: APIRequestContext, label = "Files") {
  const response = await request.post(`${E2E_API_URL}/api/agents`, {
    data: {
      name: `${label} ${randomBytes(3).toString("hex")}`,
      role: "Frontend",
      providerId: "fake",
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).agent as { id: string; name: string };
}
async function create(request: APIRequestContext, id: string, path: string, content = "") {
  const base = `${E2E_API_URL}/api/agents/${id}/files`;
  expect((await request.post(base + "/file", { data: { path } })).status()).toBe(201);
  const file = (await (await request.get(base + "/content", { params: { path } })).json()).file as {
    revision: string;
  };
  expect(
    (
      await request.put(base + "/content", { data: { path, content, revision: file.revision } })
    ).status(),
  ).toBe(200);
}
test("Files: folder → file → edit → save → refresh → rename → confirmed delete", async ({
  page,
  request,
}) => {
  const a = await agent(request);
  await page.goto(`/files?agent=${a.id}`);
  const directory = page.getByRole("region", { name: "Workspace directory" });
  await expect(directory).toContainText("This folder is empty");
  await page.getByRole("button", { name: "New Folder", exact: true }).click();
  await page
    .getByRole("form", { name: "New folder" })
    .getByLabel("Name", { exact: true })
    .fill("demo");
  await page
    .getByRole("form", { name: "New folder" })
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await page.getByRole("button", { name: "Open demo", exact: true }).click();
  await page.getByRole("button", { name: "New File", exact: true }).click();
  const form = page.getByRole("form", { name: "New file" });
  await form.getByLabel("Name", { exact: true }).fill("hello.txt");
  await form.getByRole("button", { name: "Create", exact: true }).click();
  const editor = page.getByLabel("File content");
  await expect(editor).toBeVisible();
  await editor.fill("HELLO_QELVRA");
  await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Unsaved changes", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.reload();
  await expect(editor).toHaveValue("HELLO_QELVRA");
  await page.getByRole("button", { name: "Rename hello.txt", exact: true }).click();
  const rename = page.getByRole("form", { name: "Rename entry" });
  await rename.getByLabel("New name").fill("hello-renamed.txt");
  await rename.getByRole("button", { name: "Rename", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open hello-renamed.txt", exact: true }),
  ).toBeVisible();
  await expect(editor).toHaveValue("HELLO_QELVRA");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Delete hello-renamed.txt", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open hello-renamed.txt", exact: true }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete hello-renamed.txt", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open hello-renamed.txt", exact: true }),
  ).toHaveCount(0);
  await expect(directory).toContainText("This folder is empty");
  await page.getByRole("button", { name: "workspace", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete demo", exact: true }).click();
  await expect(directory).toContainText("This folder is empty");
});
test("Files protects unsaved edits on file, agent and route changes; Save clears dirty state", async ({
  page,
  request,
}) => {
  const a = await agent(request),
    b = await agent(request, "Other Files");
  await create(request, a.id, "a.txt", "original");
  await create(request, a.id, "b.txt", "other");
  await page.goto(`/files?agent=${a.id}&file=a.txt`);
  const editor = page.getByLabel("File content");
  await expect(editor).toHaveValue("original");
  await editor.fill("unsaved");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Open b.txt", exact: true }).click();
  await expect(editor).toHaveValue("unsaved");
  await expect(page).toHaveURL(new RegExp("file=a.txt"));
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByLabel("Agent workspace").selectOption(b.id);
  await expect(editor).toHaveValue("unsaved");
  await expect(page.getByLabel("Agent workspace")).toHaveValue(a.id);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("link", { name: /Tasks/ }).click();
  await expect(editor).toHaveValue("unsaved");
  await expect(page).toHaveURL(/\/files\?/);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Open b.txt", exact: true }).click();
  await expect(editor).toHaveValue("other");
  await editor.fill("saved edit");
  await editor.press("Control+s");
  await expect(page.getByText("Unsaved changes", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(editor).toHaveValue("saved edit");
});
test.describe(() => {
  test.use({
    allowedConsoleErrors: [
      /Failed to load resource: the server responded with a status of (415|409)/,
    ],
  });
  test("Files handles binary/large files honestly and preserves conflicting edits", async ({
    page,
    request,
  }) => {
    const a = await agent(request);
    const root = join(E2E_DATA_DIR, "hive", "agents", a.id, "workspace");
    await writeFile(join(root, "binary.bin"), Buffer.from([0, 255, 0]));
    await writeFile(join(root, "large.txt"), Buffer.alloc(1024 * 1024 + 1, 97));
    await create(request, a.id, "edit.txt", "original");
    let largeContentRequests = 0;
    page.on("request", (req) => {
      if (req.url().includes("/content?") && req.url().includes("large.txt"))
        largeContentRequests++;
    });
    await page.goto(`/files?agent=${a.id}`);
    await page.getByRole("button", { name: "Open binary.bin", exact: true }).click();
    await expect(page.getByRole("region", { name: "File editor" })).toContainText(
      "Binary preview/editing is not supported yet",
    );
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
    await expect(page.getByLabel("File content")).toHaveCount(0);
    await page.getByRole("button", { name: "Open large.txt", exact: true }).click();
    await expect(page.getByRole("region", { name: "File editor" })).toContainText(
      "File is too large",
    );
    expect(largeContentRequests).toBe(0);
    await page.getByRole("button", { name: "Open edit.txt", exact: true }).click();
    const editor = page.getByLabel("File content");
    await expect(editor).toHaveValue("original");
    await editor.fill("my edits");
    const base = `${E2E_API_URL}/api/agents/${a.id}/files/content`;
    const current = (await (await request.get(base, { params: { path: "edit.txt" } })).json()).file;
    expect(
      (
        await request.put(base, {
          data: { path: "edit.txt", content: "agent changed disk", revision: current.revision },
        })
      ).status(),
    ).toBe(200);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "FILE_CHANGED_ON_DISK" })).toBeVisible();
    await expect(editor).toHaveValue("my edits");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Reload file" }).click();
    await expect(editor).toHaveValue("agent changed disk");
  });
});
test("Files displays an execution-generated file in the selected workspace", async ({
  page,
  request,
}) => {
  const a = await agent(request);
  const task = (
    await (
      await request.post(`${E2E_API_URL}/api/tasks`, {
        data: { title: "Files generated artifact", assignee: a.id },
      })
    ).json()
  ).task;
  expect(
    (await request.post(`${E2E_API_URL}/api/tasks/${task.id}/execute`, { data: {} })).status(),
  ).toBe(202);
  await expect
    .poll(
      async () =>
        (await (await request.get(`${E2E_API_URL}/api/tasks/${task.id}`)).json()).task.status,
      { timeout: 15000 },
    )
    .toBe("review");
  await page.goto(`/files?agent=${a.id}`);
  await page.getByRole("button", { name: "Open fixture.txt", exact: true }).click();
  await expect(page.getByLabel("File content")).toHaveValue("HELLO_QELVRA");
});
test("Files handles 500 entries, nested breadcrumbs and small screens without loading the entire tree", async ({
  page,
  request,
}) => {
  const a = await agent(request);
  const root = join(E2E_DATA_DIR, "hive", "agents", a.id, "workspace");
  await Promise.all(
    Array.from({ length: 500 }, (_, i) => writeFile(join(root, `file-${i}.txt`), "x")),
  );
  await page.goto(`/files?agent=${a.id}`);
  await expect(page.getByRole("region", { name: "Workspace directory" })).toContainText(
    "500 entries",
  );
  await expect(page.getByRole("button", { name: "Open file-499.txt", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open file-499.txt", exact: true }).click();
  await expect(page.getByLabel("File content")).toHaveValue("x");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test.describe(() => {
  test.use({ allowedConsoleErrors: [/Failed to load resource: net::ERR_FAILED/] });
  test("Files empty-agent and disconnected states offer honest recovery", async ({ page }) => {
    await page.route("**/api/agents", (route) => route.fulfill({ json: { agents: [] } }));
    await page.goto("/files");
    await expect(page.getByRole("heading", { name: "No agents yet" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create Agent", exact: true })).toBeVisible();
    await page.route("**/api/agents", (route) => route.abort());
    await page.reload();
    await expect(page.getByRole("button", { name: "Retry agents" })).toBeVisible();
  });
});
