import type { APIRequestContext, Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { E2E_API_URL } from "./env";
import { expect, test } from "./fixtures";

// The Agents pages against the real server. Tests run in parallel against one registry,
// so every test uses its own uniquely named agents and only asserts on those.

function unique(base: string): string {
  return `${base} ${randomBytes(3).toString("hex")}`;
}

function idFor(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/** Seeds through the REST API (not by touching frontend state). */
async function seed(request: APIRequestContext, name: string, role = "Test Agent") {
  const res = await request.post(`${E2E_API_URL}/api/agents`, { data: { name, role } });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { agent: { id: string } }).agent;
}

/** The browser logs every non-2xx fetch; these tests trigger specific ones on purpose. */
const expectHttpError = (status: number) => [
  new RegExp(`Failed to load resource: the server responded with a status of ${status}`),
];

const card = (page: Page, id: string) => page.locator(`.agent-card[data-agent="${id}"]`);

test("creating an agent in the wizard adds it to the directory and its profile", async ({
  page,
}) => {
  const name = unique("Nova");
  await page.goto("/agents");
  await page.getByRole("button", { name: /Create Agent/ }).click();
  await expect(page).toHaveURL("/agents/new");

  await page.locator("#input-agent-name").fill(name);
  await page.locator("#input-agent-role").fill("Frontend Engineer");
  await page.locator("#btn-create-agent").click();

  await expect(page).toHaveURL("/agents");
  const created = card(page, idFor(name));
  await expect(created).toBeVisible();
  await expect(created).toContainText(name);
  await expect(created).toContainText("Frontend Engineer");
  await expect(created).toContainText("Stopped");

  await created.locator(".btn-inspect").click();
  await expect(page).toHaveURL(`/agents/${idFor(name)}`);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByTestId("agent-status")).toHaveText("STOPPED");
  await expect(page.getByText("Frontend Engineer").first()).toBeVisible();
  await expect(page.getByText(idFor(name)).first()).toBeVisible();
});

test.describe(() => {
  test.use({ allowedConsoleErrors: expectHttpError(409) });

  test("the wizard reports a duplicate name without leaving the page", async ({
    page,
    request,
  }) => {
    const name = unique("Dup");
    await seed(request, name);
    await page.goto("/agents/new");
    await page.locator("#input-agent-name").fill(name);
    await page.locator("#input-agent-role").fill("Second");
    await page.locator("#btn-create-agent").click();
    await expect(page.getByRole("alert")).toContainText("already exists");
    await expect(page).toHaveURL(/\/agents\/new/);
  });
});

test("the wizard validates name and role before sending", async ({ page }) => {
  await page.goto("/agents/new");
  await page.locator("#input-agent-name").fill("");
  await page.locator("#btn-create-agent").click();
  await expect(page.getByRole("alert")).toContainText("Name is required");
  await expect(page.locator("#step-panel-1")).toBeVisible();
});

test("deleting an agent from the drawer removes its card", async ({ page, request }) => {
  const atlas = await seed(request, unique("Atlas"));
  await page.goto("/agents");
  await card(page, atlas.id).click();
  await expect(page.locator("#agent-drawer")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("#drawer-name")).toContainText("Atlas");

  await page.getByRole("button", { name: "Delete agent" }).click();
  await page
    .getByRole("group", { name: /Confirm deleting/ })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(card(page, atlas.id)).toHaveCount(0);
  // The drawer closes (and unmounts, since its agent no longer exists).
  await expect(page.locator('#agent-drawer[aria-hidden="false"]')).toHaveCount(0);

  await page.reload();
  await expect(page.locator("#agents-grid")).toBeVisible();
  await expect(card(page, atlas.id)).toHaveCount(0);
});

test("deleting from the profile returns to the directory", async ({ page, request }) => {
  const scout = await seed(request, unique("Scout"));
  await page.goto(`/agents/${scout.id}`);
  await page.getByRole("button", { name: "Delete agent" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveURL(`/agents/${scout.id}`);

  await page.getByRole("button", { name: "Delete agent" }).click();
  await page
    .getByRole("group", { name: /Confirm deleting/ })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page).toHaveURL("/agents");
  await expect(card(page, scout.id)).toHaveCount(0);
});

test.describe(() => {
  test.use({ allowedConsoleErrors: expectHttpError(404) });

  test("unknown and invalid agent routes show not found", async ({ page }) => {
    await page.goto("/agents/does-not-exist");
    await expect(page.getByRole("heading", { name: "Agent not found" })).toBeVisible();
    await page.getByRole("link", { name: "Back to agents" }).click();
    await expect(page).toHaveURL("/agents");

    await page.goto("/agents/..%2Fetc");
    await expect(page.getByRole("heading", { name: "Agent not found" })).toBeVisible();
  });
});

test("search and status tabs filter real agents", async ({ page, request }) => {
  const echo = await seed(request, unique("Echo"));
  await page.goto("/agents");
  await page.getByPlaceholder(/Search agents/).fill(echo.id);
  await expect(page.locator(".agent-card")).toHaveCount(1);
  await expect(card(page, echo.id)).toBeVisible();

  await page.locator('.filter-tab[data-status="working"]').click();
  await expect(page.locator(".agent-card")).toHaveCount(0);
  await expect(page.getByText("No agents match the current filters.")).toBeVisible();
  await page.locator('.filter-tab[data-status="offline"]').click();
  await expect(card(page, echo.id)).toBeVisible();
});

test("capability tags are disabled until agents have capabilities", async ({ page }) => {
  await page.goto("/agents");
  await expect(page.getByRole("button", { name: "Testing", exact: true })).toBeDisabled();
});

test("drawer opens from a card and closes with Esc, the close button or the backdrop", async ({
  page,
  request,
}) => {
  const pixel = await seed(request, unique("Pixel"));
  const drawer = page.locator("#agent-drawer");
  await page.goto("/agents");

  await card(page, pixel.id).click();
  await expect(drawer).toHaveAttribute("aria-hidden", "false");
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveAttribute("aria-hidden", "true");

  await card(page, pixel.id).click();
  await page.locator("#close-drawer").click();
  await expect(drawer).toHaveAttribute("aria-hidden", "true");

  await card(page, pixel.id).click();
  await page.locator("#drawer-backdrop").click({ position: { x: 20, y: 200 } });
  await expect(drawer).toHaveAttribute("aria-hidden", "true");
});

test("⌘/Ctrl+F focuses search and C opens the wizard (but not while typing)", async ({ page }) => {
  await page.goto("/agents");
  await expect(page.locator("#agents-grid")).toBeVisible();
  await page.keyboard.press("ControlOrMeta+f");
  await expect(page.getByPlaceholder(/Search agents/)).toBeFocused();
  await page.keyboard.type("c");
  await expect(page).toHaveURL("/agents");

  await page.locator("body").click({ position: { x: 5, y: 300 } });
  await page.keyboard.press("c");
  await expect(page).toHaveURL("/agents/new");
});

test("sidebar shows the real number of agents", async ({ page, request }) => {
  await page.goto("/agents");
  const link = page
    .locator("aside nav")
    .getByRole("link", { name: /Agents/ })
    .first();
  await expect(link).toHaveText(/Agents\d+$/); // count loaded
  const before = Number((await link.textContent())?.match(/(\d+)$/)?.[1]);
  await seed(request, unique("Counted"));
  await page.getByRole("button", { name: /Re-index/ }).click();
  await expect(link).toHaveText(new RegExp(`Agents${before + 1}$`));
});
