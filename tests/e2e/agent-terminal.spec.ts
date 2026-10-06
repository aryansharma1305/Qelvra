import type { APIRequestContext, Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { E2E_API_URL } from "./env";
import { expect, test } from "./fixtures";

// Agent terminals end to end: the agent owns its shell, the page only attaches to it.
// Tests share one server, so every agent has a unique name and is deleted afterwards
// (which also stops its shell).

const PANE = "#live-terminal-pane";
const created: string[] = [];

function unique(base: string): string {
  return `${base} ${randomBytes(3).toString("hex")}`;
}

function idFor(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function seed(request: APIRequestContext, name: string, start = true): Promise<string> {
  const res = await request.post(`${E2E_API_URL}/api/agents`, { data: { name, role: "E2E" } });
  expect(res.status()).toBe(201);
  const id = idFor(name);
  created.push(id);
  if (start)
    expect((await request.post(`${E2E_API_URL}/api/agents/${id}/start`)).status()).toBe(200);
  return id;
}

test.afterEach(async ({ page, request }) => {
  // Detach viewers before deleting their agents, so teardown cannot trigger a stale
  // terminal-exit refetch after the record has been removed.
  await page.goto("about:blank");
  for (const id of created.splice(0)) await request.delete(`${E2E_API_URL}/api/agents/${id}`);
});

/** Waits until the pane shows `agentId`'s attached shell; returns the shell's pid. */
async function attached(page: Page, agentId: string): Promise<number> {
  const pane = page.locator(`${PANE}[data-agent="${agentId}"][data-terminal-state="connected"]`);
  await expect(pane).toBeVisible({ timeout: 15_000 });
  await expect(pane.getByTestId("terminal-status")).toHaveText(/PTY \d+/);
  const status = await pane.getByTestId("terminal-status").textContent();
  const pid = Number(/PTY (\d+)/.exec(status ?? "")?.[1]);
  expect(pid).toBeGreaterThan(0);
  return pid;
}

function outputRow(page: Page, text: string) {
  return page
    .locator(`${PANE} .xterm-rows > div`)
    .filter({ hasText: new RegExp(`^\\s*${text}\\s*$`) });
}

async function run(page: Page, command: string): Promise<void> {
  await page.locator(`${PANE} .xterm`).click();
  await expect(page.locator(`${PANE} .xterm-helper-textarea`)).toBeFocused();
  // PTY attachment precedes shell startup. A blank command also requests a prompt
  // after reattachment, where previous output is deliberately unavailable.
  await page.keyboard.press("Enter");
  await expect(
    page
      .locator(`${PANE} .xterm-rows > div`)
      .filter({ hasText: /[%$#>]\s*$/ })
      .last(),
  ).toBeVisible({ timeout: 15_000 });
  await page.keyboard.type(command);
  await page.keyboard.press("Enter");
}

const tab = (page: Page, id: string) => page.locator(`[role="tab"][data-agent="${id}"]`);

test("fake agents round-trip browser terminal input through real mailboxes and router", async ({
  page,
  request,
}) => {
  const ids: string[] = [];
  for (const base of ["Fake Nova", "Fake Atlas"]) {
    const response = await request.post(`${E2E_API_URL}/api/agents`, {
      data: {
        name: unique(base),
        role: "Demo / Test",
        providerId: "fake",
        command: "/evil",
        args: ["/evil"],
        env: { QELVRA_AGENT_ID: "spoof" },
      },
    });
    expect(response.status()).toBe(201);
    const { agent } = (await response.json()) as { agent: { id: string; providerId: string } };
    expect(agent.providerId).toBe("fake");
    ids.push(agent.id);
    created.push(agent.id);
    expect((await request.post(`${E2E_API_URL}/api/agents/${agent.id}/start`)).status()).toBe(200);
  }
  const [nova, atlas] = ids;
  if (!nova || !atlas) throw new Error("Both fake agents must be created");
  await page.goto(`/terminal?agent=${nova}`);
  await attached(page, nova);
  await page.locator("#btn-single-view").click();
  await run(page, "PING");
  await expect(outputRow(page, "PONG").first()).toBeVisible();
  await run(page, `SEND ${atlas} HELLO_FROM_BROWSER`);
  await expect(page.locator(`${PANE} .xterm-rows`)).toContainText("MESSAGE_QUEUED");
  await tab(page, atlas).click();
  await attached(page, atlas);
  await run(page, "STATUS");
  await expect(outputRow(page, `READY ${atlas}`).first()).toBeVisible();
  await tab(page, nova).click();
  await attached(page, nova);
  // Request real inbox contents until the asynchronous round-trip is visible. No
  // server mailbox endpoint or direct filesystem write bypasses the terminal flow.
  await expect(async () => {
    await run(page, "CHECK_INBOX");
    await expect(page.locator(`${PANE} .xterm-rows`)).toContainText("ACK:HELLO_FROM_BROWSER", {
      timeout: 1000,
    });
  }).toPass({ timeout: 15000, intervals: [500, 1000] });
});

test("wizard-selected fake provider starts through the real registry and stops cleanly", async ({
  page,
  request,
}) => {
  const name = unique("Provider Fixture");
  const id = idFor(name);
  created.push(id);
  await page.goto("/agents/new");
  await page.locator("#input-agent-name").fill(name);
  await page.locator("#input-agent-role").fill("Provider test");
  await page.locator("#step-pill-2").click();
  await page.getByRole("radio", { name: /Fake agent/ }).click();
  await page.locator("#btn-create-agent").click();
  await expect(page).toHaveURL("/agents");
  const record = await (await request.get(`${E2E_API_URL}/api/agents/${id}`)).json();
  expect(record.agent.providerId).toBe("fake");
  await page.goto(`/agents/${id}`);
  await expect(page.getByTestId("agent-provider")).toContainText("Available");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByTestId("agent-status")).toHaveText("RUNNING");
  await page.getByRole("button", { name: /Open Terminal/ }).click();
  const pid = await attached(page, id);
  await page.locator("#btn-single-view").click();
  await run(page, "STATUS");
  await expect(outputRow(page, `READY ${id}`).first()).toBeVisible();
  await page.goto(`/agents/${id}`);
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.getByTestId("agent-status")).toHaveText("STOPPED");
  await expect.poll(() => isAlive(pid)).toBe(false);
});

test("create, start and open an agent's terminal from its profile", async ({ page }) => {
  const name = unique("Nova");
  const id = idFor(name);
  created.push(id);
  await page.goto("/agents/new");
  await page.locator("#input-agent-name").fill(name);
  await page.locator("#input-agent-role").fill("Frontend");
  await page.locator("#btn-create-agent").click();
  await expect(page).toHaveURL("/agents");

  await page.goto(`/agents/${id}`);
  await expect(page.getByTestId("agent-status")).toHaveText("STOPPED");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByTestId("agent-status")).toHaveText("RUNNING");
  await expect(page.getByRole("button", { name: "Stop", exact: true })).toBeVisible();

  await page.getByRole("button", { name: /Open Terminal/ }).click();
  await expect(page).toHaveURL(`/terminal?agent=${id}`);
  await attached(page, id);
  await expect(tab(page, id)).toHaveAttribute("aria-selected", "true");
  await run(page, "echo NOVA_E2E");
  await expect(outputRow(page, "NOVA_E2E").first()).toBeVisible();
});

test("two running agents keep their output apart", async ({ page, request }) => {
  const nova = await seed(request, unique("Nova"));
  const atlas = await seed(request, unique("Atlas"));
  const novaMarker = `NOVA_${randomBytes(3).toString("hex").toUpperCase()}`;
  const atlasMarker = `ATLAS_${randomBytes(3).toString("hex").toUpperCase()}`;

  await page.goto(`/terminal?agent=${nova}`);
  const novaPid = await attached(page, nova);
  await run(page, `echo ${novaMarker}`);
  await expect(outputRow(page, novaMarker).first()).toBeVisible();

  await tab(page, atlas).click();
  await expect(page).toHaveURL(`/terminal?agent=${atlas}`);
  const atlasPid = await attached(page, atlas);
  expect(atlasPid).not.toBe(novaPid);
  await run(page, `echo ${atlasMarker}`);
  await expect(outputRow(page, atlasMarker).first()).toBeVisible();
  await expect(outputRow(page, novaMarker)).toHaveCount(0);

  // Back to Nova: the same shell, and only Nova's output from here on.
  await tab(page, nova).click();
  expect(await attached(page, nova)).toBe(novaPid);
  await run(page, `echo ${novaMarker}_AGAIN`);
  await expect(outputRow(page, `${novaMarker}_AGAIN`).first()).toBeVisible();
  await expect(outputRow(page, atlasMarker)).toHaveCount(0);
});

test("leaving the terminal page keeps the agent running; returning reattaches", async ({
  page,
  request,
}) => {
  const id = await seed(request, unique("Echo"));
  await page.goto(`/terminal?agent=${id}`);
  const pid = await attached(page, id);

  await page.locator("aside nav").getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL("/");
  // Unlike the developer shell, the agent's shell must survive the page going away.
  await page.waitForTimeout(1_000);
  expect(isAlive(pid)).toBe(true);
  const res = await request.get(`${E2E_API_URL}/api/agents/${id}`);
  expect(((await res.json()) as { agent: { status: string } }).agent.status).toBe("running");

  await page.goto(`/terminal?agent=${id}`);
  expect(await attached(page, id)).toBe(pid);
  await run(page, "echo ECHO_BACK");
  await expect(outputRow(page, "ECHO_BACK").first()).toBeVisible();
});

test("a stopped agent shows Start instead of a terminal, until it runs again", async ({
  page,
  request,
}) => {
  const id = await seed(request, unique("Scout"));
  await page.goto(`/terminal?agent=${id}`);
  const pid = await attached(page, id);

  await page.locator(PANE).getByRole("button", { name: "Stop", exact: true }).click();
  await expect(tab(page, id).getByTestId("tab-status")).toHaveText("Stopped");
  await expect(page.locator(PANE).getByTestId("terminal-status")).toHaveText("STOPPED");
  await expect(page.locator(`${PANE} .xterm`)).toHaveCount(0);
  await expect.poll(() => isAlive(pid)).toBe(false);

  await page.goto(`/agents/${id}`);
  await expect(page.getByTestId("agent-status")).toHaveText("STOPPED");

  await page.goto(`/terminal?agent=${id}`);
  await page.locator(PANE).getByRole("button", { name: "Start Agent" }).click();
  const fresh = await attached(page, id);
  expect(fresh).not.toBe(pid);
  await run(page, "echo SCOUT_AGAIN");
  await expect(outputRow(page, "SCOUT_AGAIN").first()).toBeVisible();
});

test("clicking a stopped agent's tab does not start it", async ({ page, request }) => {
  const id = await seed(request, unique("Pixel"), false);
  await page.goto("/terminal");
  await tab(page, id).click();
  await expect(page.locator(PANE).getByRole("button", { name: "Start Agent" })).toBeVisible();
  await page.waitForTimeout(500);
  const res = await request.get(`${E2E_API_URL}/api/agents/${id}`);
  expect(((await res.json()) as { agent: { status: string } }).agent.status).toBe("stopped");
});

test("single view fills the pane area and restart receives a fresh shell", async ({
  page,
  request,
}) => {
  const id = await seed(request, unique("Nova"));
  await page.goto(`/terminal?agent=${id}`);
  const pid = await attached(page, id);
  await page.locator("#btn-single-view").click();
  await expect(page.locator("#dev-shell-pane")).toHaveCount(0);
  const pane = await page.locator(PANE).boundingBox();
  const container = await page.locator("#terminals-container").boundingBox();
  expect(pane?.width).toBe(container?.width);
  await run(page, "export QELVRA_RESTART_CHECK=old_shell");
  await page.locator(PANE).getByRole("button", { name: "Restart", exact: true }).click();
  await expect.poll(async () => attached(page, id)).not.toBe(pid);
  await expect.poll(() => isAlive(pid)).toBe(false);
  await run(page, 'echo "FRESH_${QELVRA_RESTART_CHECK:-shell}"');
  await expect(outputRow(page, "FRESH_shell").first()).toBeVisible();
});

test.describe("lifecycle request errors", () => {
  test.use({ allowedConsoleErrors: [/Failed to load resource:.*status of 500/] });
  test("lifecycle failures are visible in a running agent pane", async ({ page, request }) => {
    const id = await seed(request, unique("Atlas"));
    await page.goto(`/terminal?agent=${id}`);
    await attached(page, id);
    await page.route(`**/api/agents/${id}/stop`, (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "AGENT_STOP_FAILED", message: "Could not stop shell" },
        }),
      }),
    );
    await page.locator(PANE).getByRole("button", { name: "Stop", exact: true }).click();
    await expect(page.locator(PANE).getByRole("alert")).toContainText("Could not stop shell");
    await expect(page.locator(PANE)).toHaveAttribute("data-terminal-state", "connected");
  });
});

test("the agents directory shows real runtime status", async ({ page, request }) => {
  const id = await seed(request, unique("Atlas"));
  await page.goto("/agents");
  const card = page.locator(`.agent-card[data-agent="${id}"]`);
  await expect(card).toContainText("Running");
  await expect(card).toContainText("Shell running");
  await expect(card).not.toContainText("Working");

  await card.click();
  await page.locator("#agent-drawer").getByRole("button", { name: "Stop", exact: true }).click();
  await expect(card).toContainText("Stopped");
});

test("agent workspaces isolate files and preserve them through restart and metadata recreation", async ({
  page,
  request,
}) => {
  const nova = await seed(request, unique("Nova Workspace"));
  const atlas = await seed(request, unique("Atlas Workspace"));
  const file = `nova-${randomBytes(3).toString("hex")}.txt`;
  await page.goto(`/terminal?agent=${nova}`);
  const pid = await attached(page, nova);
  // Show a wide viewport so pwd is a complete output row rather than wrapped cells.
  await page.locator("#btn-single-view").click();
  await run(page, "pwd");
  await expect(
    page
      .locator(`${PANE} .xterm-rows > div`)
      .filter({ hasText: new RegExp(`/hive/agents/${nova}/workspace\\s*$`) })
      .first(),
  ).toBeVisible();
  await run(page, `touch ${file}; test -f ${file} && echo NOVA_FILE_CREATED`);
  await expect(outputRow(page, "NOVA_FILE_CREATED").first()).toBeVisible();
  await run(page, 'printf "workspace-e2e-memory" > ../memory.md; echo NOVA_MEMORY_SAVED');
  await expect(outputRow(page, "NOVA_MEMORY_SAVED").first()).toBeVisible();

  await tab(page, atlas).click();
  await attached(page, atlas);
  await run(page, "pwd");
  await expect(
    page
      .locator(`${PANE} .xterm-rows > div`)
      .filter({ hasText: new RegExp(`/hive/agents/${atlas}/workspace\\s*$`) })
      .first(),
  ).toBeVisible();
  await run(page, `test ! -e ${file} && echo ATLAS_FILE_ABSENT`);
  await expect(outputRow(page, "ATLAS_FILE_ABSENT").first()).toBeVisible();

  await tab(page, nova).click();
  await attached(page, nova);
  await page.locator(PANE).getByRole("button", { name: "Restart", exact: true }).click();
  await expect.poll(async () => attached(page, nova)).not.toBe(pid);
  await run(page, `test -f ${file} && echo NOVA_FILE_PERSISTED`);
  await expect(outputRow(page, "NOVA_FILE_PERSISTED").first()).toBeVisible();

  await page.goto("about:blank");
  expect((await request.delete(`${E2E_API_URL}/api/agents/${nova}`)).status()).toBe(204);
  expect(
    (
      await request.post(`${E2E_API_URL}/api/agents`, {
        data: { id: nova, name: "Recreated Nova", role: "E2E" },
      })
    ).status(),
  ).toBe(201);
  expect((await request.post(`${E2E_API_URL}/api/agents/${nova}/start`)).status()).toBe(200);
  await page.goto(`/terminal?agent=${nova}`);
  await attached(page, nova);
  await run(
    page,
    `test -f ${file} && test "$(cat ../memory.md)" = workspace-e2e-memory && echo NOVA_REATTACHED_DATA`,
  );
  await expect(outputRow(page, "NOVA_REATTACHED_DATA").first()).toBeVisible();
});
