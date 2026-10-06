import { expect, type Page } from "@playwright/test";
// Each selector is an independent Stitch surface. These are measured BEFORE content
// normalization, then checked again on the live page. None is masked as a panel.
export const TERMINAL_GEOMETRY = [
  ["header", "header"],
  ["main > div > div", ".terminal-workspace"],
  ["main > div > div > :nth-child(1)", ".terminal-workspace > :nth-child(1)"],
  ["main > div > div > :nth-child(2)", "[role=tablist]"],
  ["main > div > div > :nth-child(3)", ".terminal-task-strip"],
  ["main > div > div > :nth-child(4)", ".terminal-workspace > :nth-child(4)"],
  ["#terminals-container", "#terminals-container"],
  ["#terminals-container > :first-child", "#terminals-container > :first-child"],
  ["#nova-terminal-body >> xpath=..", "#live-terminal-pane"],
  ["#nova-terminal-body >> xpath=../*[1]", "#live-terminal-pane > :first-child"],
  ["#nova-terminal-body", "#nova-terminal-body"],
  ["#scout-split-pane", "#dev-shell-pane"],
  ["#scout-split-pane > :first-child", "#dev-shell-pane > :first-child"],
  ["#terminals-container > :nth-child(2)", "#terminals-container > :nth-child(2)"],
  ["#terminals-container >> xpath=../*[2]", "#terminals-container >> xpath=../*[2]"],
] as const;
interface Geometry {
  x: number;
  y: number;
  width: number;
  height: number;
  padding: string;
  gap: string;
  columns: string;
}
export interface TerminalReference {
  geometry: Geometry[];
  summaries: string[];
  active: string;
  task: string;
  timer: string;
  engine: string;
  context: string;
  contextWidth: string;
}
async function geometry(page: Page, selector: string): Promise<Geometry> {
  const locator = page.locator(selector);
  await expect(locator).toHaveCount(1);
  return locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      padding: style.padding,
      gap: style.gap,
      columns: style.gridTemplateColumns,
    };
  });
}
export async function readTerminalReference(page: Page): Promise<TerminalReference> {
  const measured = [];
  for (const [selector] of TERMINAL_GEOMETRY) measured.push(await geometry(page, selector));
  const content = await page.evaluate(() => {
    function required<T>(value: T | null | undefined): T {
      if (value == null) throw new Error("Missing terminal reference element/data");
      return value;
    }
    const root = required(document.querySelector("main > div > div"));
    const tabs = required(root.children[1]);
    const strip = required(root.children[2]);
    const telemetry = required(strip.children[1]);
    return {
      summaries: [...tabs.children]
        .slice(0, 5)
        .map((tab) => required(required(tab.children[1]).children[1]).innerHTML),
      active: required(
        required(
          required(required(required(root.children[0]).children[0]).children[1]).lastElementChild,
        ).textContent,
      ).trim(),
      task: required(required(required(strip.children[0]).children[1]).textContent).trim(),
      timer: required(required(document.querySelector("#elapsed-counter")).textContent).trim(),
      engine: required(
        required(required(telemetry.children[2]).lastElementChild).textContent,
      ).trim(),
      context: required(
        required(required(telemetry.children[4]).lastElementChild).textContent,
      ).trim(),
      contextWidth: (
        required(required(telemetry.children[4]).children[1]).firstElementChild as HTMLElement
      ).style.width,
    };
  });
  return { geometry: measured, ...content };
}
export async function checkTerminalGeometry(
  page: Page,
  reference: TerminalReference,
): Promise<void> {
  for (const [index, [, selector]] of TERMINAL_GEOMETRY.entries()) {
    const actual = await geometry(page, selector);
    const expected = reference.geometry[index];
    if (!expected) throw new Error("Missing terminal geometry");
    for (const key of ["x", "y", "width", "height"] as const)
      expect(
        Math.abs(actual[key] - expected[key]),
        `${selector} ${key} (app ${actual[key]}, design ${expected[key]})`,
      ).toBeLessThanOrEqual(0.5);
    // Container/pane padding and grid gaps remain independent design assertions.
    expect(actual.padding, `${selector} padding`).toBe(expected.padding);
    if (selector.includes("terminals-container")) {
      expect(actual.gap, `${selector} gap`).toBe(expected.gap);
      expect(actual.columns, `${selector} columns`).toBe(expected.columns);
    }
  }
}
/** Only runtime/assignment content is replaced. Never copy a panel, tab, header,
 * class list, or stylesheet from the reference into the app. */
export async function normalizeTerminal(page: Page, reference: TerminalReference, source: boolean) {
  await page.evaluate(
    ({ reference, source }) => {
      function required<T>(value: T | null | undefined): T {
        if (value == null) throw new Error("Missing terminal reference element/data");
        return value;
      }
      const root = required(document.querySelector("main > div > div"));
      const strip = required(root.children[2]);
      // "Task in Flight" was fictional assignment state, not a fixed control label.
      required(required(required(strip.children[0]).children[0]).lastElementChild).textContent =
        "Task";
      if (!source) {
        const tabs = document.querySelectorAll("[data-terminal-summary]");
        if (tabs.length !== reference.summaries.length)
          throw new Error("Unexpected terminal tab count");
        // Summary descendants are CPU/PID/activity strings and state indicators only.
        tabs.forEach((summary, index) => {
          summary.innerHTML = required(reference.summaries[index]);
        });
        required(
          required(required(required(root.children[0]).children[0]).children[1]).lastElementChild,
        ).textContent = reference.active;
        required(required(strip.children[0]).children[1]).textContent = reference.task;
        const timer = required(document.querySelector("#elapsed-counter"));
        const normalizeTimer = () => {
          if (timer.textContent !== reference.timer) timer.textContent = reference.timer;
        };
        normalizeTimer();
        // React's update clock keeps running; keep only its rendered text deterministic.
        new MutationObserver(normalizeTimer).observe(timer, {
          childList: true,
          characterData: true,
          subtree: true,
        });
        const telemetry = required(strip.children[1]);
        required(required(telemetry.children[2]).lastElementChild).textContent = reference.engine;
        const context = required(telemetry.children[4]);
        required(context.lastElementChild).textContent = reference.context;
        // Usage text tint and fill percentage are runtime values; tracks/fonts stay intact.
        (context.lastElementChild as HTMLElement).style.color = "#4cd7f6";
        (required(context.children[1]).firstElementChild as HTMLElement).style.width =
          reference.contextWidth;
      }
      const agentPane = source
        ? required(required(document.querySelector("#nova-terminal-body")).parentElement)
        : required(document.querySelector("#live-terminal-pane"));
      const devPane = required(
        document.querySelector(source ? "#scout-split-pane" : "#dev-shell-pane"),
      );
      for (const [pane, developer] of [
        [agentPane, false],
        [devPane, true],
      ] as const) {
        const header = pane.children[0] as HTMLElement;
        if (source) {
          // Short neutral metadata must not collapse the reference's measured title bar.
          header.style.height = `${header.getBoundingClientRect().height}px`;
          header.style.flexShrink = "0";
        }
        const label = required(required(header.children[0]).children[1]);
        required(label.children[0]).textContent = developer ? "shell" : "agent";
        required(label.children[2]).textContent = "workspace";
        const meta = required(header.children[1]);
        if (developer) {
          // Session badge contents only; its padding/background/radius remain compared.
          required(meta.children[0]).textContent = "PTY";
        } else {
          const status = meta.children[0] as HTMLElement;
          const dot = status.children[0] as HTMLElement;
          status.replaceChildren(dot, document.createTextNode("PTY"));
          status.style.color = "#958ea0";
          dot.style.backgroundColor = "#958ea0";
          if (meta.children.length === 1) meta.append(document.createElement("span"));
          required(meta.children[1]).textContent = "80x24";
        }
      }
      if (source) {
        for (const pane of [agentPane, devPane]) {
          const body = pane.children[1] as HTMLElement;
          // Demo log length varies. Reserve its declared cap, then clear only demo
          // output so scrolled log fragments cannot paint into the unmasked padding.
          const height = getComputedStyle(body).maxHeight;
          if (height !== "410px") throw new Error(`Unexpected reference viewport: ${height}`);
          body.style.height = height;
          body.replaceChildren();
        }
        (devPane.children[1] as HTMLElement).dataset.terminalViewport = "developer";
      }
    },
    { reference, source },
  );
}
