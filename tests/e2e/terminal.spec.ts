import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// The developer shell (the split view's second pane, owned by its connection): keyboard →
// xterm → WebSocket → gateway → PTY → shell → back to xterm. The test runs on the same
// machine as the server, so it checks the shell's process directly. Agent terminals are
// covered by agent-terminal.spec.ts.

const PANE = "#dev-shell-pane";

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function openTerminal(page: Page): Promise<number> {
  await page.goto("/terminal");
  await expect(page.locator(PANE)).toHaveAttribute("data-terminal-state", "connected", {
    timeout: 15_000,
  });
  const status = await page.locator(PANE).getByTestId("terminal-status").textContent();
  const pid = Number(/PTY (\d+)/.exec(status ?? "")?.[1]);
  expect(pid).toBeGreaterThan(0);
  return pid;
}

/** A terminal row that is exactly `text` — command output, not the echoed command line. */
function outputRow(page: Page, text: string) {
  return page
    .locator(`${PANE} .xterm-rows > div`)
    .filter({ hasText: new RegExp(`^\\s*${text}\\s*$`) });
}

async function run(page: Page, command: string): Promise<void> {
  await page.keyboard.type(command);
  await page.keyboard.press("Enter");
}

test("typing in the terminal runs commands in a real shell", async ({ page }) => {
  const pid = await openTerminal(page);
  await page.locator(`${PANE} .xterm`).click();

  await run(page, "echo QELVRA_E2E_TERMINAL");
  await expect(outputRow(page, "QELVRA_E2E_TERMINAL").first()).toBeVisible();
  expect(isAlive(pid)).toBe(true);
});

test("Ctrl+C interrupts the foreground command", async ({ page }) => {
  await openTerminal(page);
  await page.locator(`${PANE} .xterm`).click();
  await run(page, "sleep 600");
  await page.keyboard.press("Control+C");
  await run(page, "echo QELVRA_AFTER_INTERRUPT");
  await expect(outputRow(page, "QELVRA_AFTER_INTERRUPT").first()).toBeVisible();
});

test("leaving the page ends the shell; returning starts a fresh one", async ({ page }) => {
  const first = await openTerminal(page);

  await page.locator("aside nav").getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL("/");
  await expect.poll(() => isAlive(first), { timeout: 10_000 }).toBe(false);

  const second = await openTerminal(page);
  expect(second).not.toBe(first);
});

test("the terminal fits its pane and reports its size", async ({ page }) => {
  await openTerminal(page);
  const pane = page.locator(PANE);
  const box = await pane.boundingBox();
  expect(box?.height).toBe(460); // the design's pane height
  await expect(pane.getByTestId("live-terminal").locator(".xterm-screen")).toBeVisible();
  await expect(pane).toContainText(/\d+x\d+/);
});
