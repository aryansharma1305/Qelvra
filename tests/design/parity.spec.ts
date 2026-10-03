import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { seedTasks, readTaskReference, checkTaskParity, type TaskReference } from "./task-parity";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { E2E_API_URL } from "../e2e/env";
import { AgentListResponseSchema } from "@qelvra/shared";
import {
  checkTerminalGeometry,
  normalizeTerminal,
  readTerminalReference,
  type TerminalReference,
} from "./terminal-parity";

/**
 * Renders each approved Stitch screen (design/stitch) and its React route in the same
 * browser and compares them pixel by pixel. Mission Control checks its incumbent
 * frames and live data contract; see task-parity.ts for the intentionally removed
 * unsupported fields. The sidebar column is excluded on app screens
 * because the app intentionally uses one canonical sidebar (see ADR 0002).
 */

const DESIGN_DIR = path.resolve(import.meta.dirname, "../../design/stitch");
const SIDEBAR_WIDTH = 224;
const HEADER_HEIGHT = 48;
// Sub-pixel antialiasing differs slightly where React splits text into several nodes
// (observed: at most ~160 pixels per screen). A single recoloured line is ~800+.
const MAX_MISMATCHED_PIXELS = 300;

interface LiveRegion {
  /** Playwright selector for the element in the app (every match is masked). */
  app: string;
  /** The matching element in the design. */
  design: string;
  /** Use the design element's parent (the design nests its mock body inside the pane). */
  designParent?: boolean;
  /**
   * "box": position and size must match the design exactly (a live pane replacing a mock).
   * "anchor": only the top-left corner must match (live text whose width varies).
   * "anchor-end": only the top-right corner must match (right-aligned live text).
   */
  check: "box" | "anchor" | "anchor-end";
  /** Keep viewport padding/chrome visible; only the terminal's inner content is masked. */
  inset?: number;
}

interface LiveRoute {
  /** Regions showing live data: checked as above, then masked in both screenshots. */
  regions: readonly LiveRegion[];
  /**
   * Content from this element down is live and its height depends on the data (e.g. one
   * card per registered agent), so only the page above it is compared. Its top edge (and
   * left edge and width) must still match the design.
   */
  cutoff?: { app: string; design: string };
}

/** Text in the header that reflects live state on every app screen. */
const HEADER_AGENT_COUNT: LiveRegion = {
  app: "header >> text=/Agents? Active$/",
  design: "header >> text=/Agents Active$/",
  check: "anchor",
};

/**
 * Screens whose regions show live data instead of the design's mock values. The /agents
 * routes render agents registered by the DESIGN_AGENTS fixture below.
 */
const LIVE_ROUTES: Partial<Record<string, LiveRoute>> = {
  "/terminal": {
    regions: [
      {
        app: "#nova-terminal-body",
        design: "#nova-terminal-body",
        check: "box",
        inset: 14,
      },
      {
        app: "#dev-shell-body",
        design: "[data-terminal-viewport=developer]",
        check: "box",
        inset: 14,
      },
    ],
  },
  "/agents": {
    regions: [
      { app: "h1 + div", design: "h1 + div", check: "anchor" }, // "6 Operatives • …"
      {
        app: ".filter-tab > span:last-child",
        design: ".filter-tab > span:last-child",
        check: "anchor",
      },
      { app: "#agent-search-input", design: "#agent-search-input", check: "box" }, // placeholder
    ],
    cutoff: { app: "#agents-grid", design: "#agents-grid" },
  },
  "/agents/nova": {
    regions: [
      { app: "text=/^Nova \\(nova\\)$/", design: "text=Nova (OP-01)", check: "anchor" },
      {
        app: "text=RUNTIME: >> xpath=..",
        design: "text=RUNTIME: >> xpath=..",
        check: "anchor-end",
      },
    ],
    // The profile card and the panels below show runtime data that does not exist yet
    // (provider, uptime, mission, stdout, telemetry); the app shows honest placeholders.
    cutoff: {
      app: "div:has(+ div.grid.lg\\:grid-cols-12)",
      design: "div:has(+ div.grid.lg\\:grid-cols-12)",
    },
  },
};

/**
 * Copy changed on purpose since the design was approved. Applied to the design before
 * comparing, so everything else on the screen is still checked.
 */
const DESIGN_COPY_EDITS: Partial<Record<string, readonly [string, string][]>> = {
  // Creating registers a stopped agent; nothing is brought online until agent processes exist.
  agent_hive_create_agent_wizard: [["Bring Agent Online", "Create Agent"]],
};

const SCREENS: readonly { screen: string; route: string; shell: "app" | "onboarding" }[] = [
  { screen: "agent_hive_home_command_center", route: "/", shell: "app" },
  { screen: "agent_hive_swarm_command_center", route: "/swarm", shell: "app" },
  { screen: "agent_hive_ai_team_directory", route: "/agents", shell: "app" },
  { screen: "agent_hive_nova_profile", route: "/agents/nova", shell: "app" },
  { screen: "agent_hive_create_agent_wizard", route: "/agents/new?step=3", shell: "app" },
  { screen: "agent_hive_mission_control", route: "/tasks", shell: "app" },
  { screen: "agent_hive_multi_agent_terminal_workspace", route: "/terminal", shell: "app" },
  { screen: "agent_hive_agent_network", route: "/network", shell: "app" },
  { screen: "agent_hive_ai_studio", route: "/studio", shell: "app" },
  { screen: "agent_hive_onboarding_build_your_ai_team", route: "/onboarding", shell: "onboarding" },
  {
    screen: "agent_hive_onboarding_choose_your_goal",
    route: "/onboarding/goal",
    shell: "onboarding",
  },
  {
    screen: "agent_hive_onboarding_choose_your_first_team",
    route: "/onboarding/team",
    shell: "onboarding",
  },
  {
    screen: "agent_hive_onboarding_choose_ai_engines",
    route: "/onboarding/engines",
    shell: "onboarding",
  },
  {
    screen: "agent_hive_onboarding_workspace_ready",
    route: "/onboarding/ready",
    shell: "onboarding",
  },
];

/**
 * Fixture: the terminal reference's agents, registered through the real API (not by
 * faking frontend state) so /agents and /agents/nova render the same cards and profile
 * frame as the approved screens. Their runtime values are live data and are masked below.
 */
const DESIGN_AGENTS = [
  { id: "nova", name: "Nova", role: "Frontend" },
  { id: "scout", name: "Scout", role: "QA / E2E" },
  { id: "michael", name: "Michael", role: "Orchestrator" },
  { id: "atlas", name: "Atlas", role: "Backend" },
  { id: "pixel", name: "Pixel", role: "Design System" },
] as const;

let selectedTask = "";

test.beforeAll(async ({ request }) => {
  for (const agent of DESIGN_AGENTS) {
    const res = await request.post(`${E2E_API_URL}/api/agents`, { data: agent });
    // Another worker may have registered it first.
    expect([201, 409]).toContain(res.status());
  }
  // Registry.list() guarantees createdAt/id ordering; sequential creation uses its
  // monotonic timestamps. Check the contract instead of assuming insertion order.
  const agents = AgentListResponseSchema.parse(
    await (await request.get(`${E2E_API_URL}/api/agents`)).json(),
  ).agents;
  expect(agents.map(({ id, name, role }) => ({ id, name, role }))).toEqual(DESIGN_AGENTS);
  selectedTask = await seedTasks(request);
});

const FREEZE_MOTION =
  "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";

/** The design's markup state: keep the Tailwind CDN, drop Stitch's demo scripts. */
function staticDesignFile(screen: string, outDir: string): string {
  let html = fs.readFileSync(path.join(DESIGN_DIR, screen, "code.html"), "utf8");
  html = html.replace(/<script(?![^>]*tailwind)[^>]*>[\s\S]*?<\/script>/g, (tag) =>
    tag.includes("tailwind.config") ? tag : "",
  );
  // Same font fix as apps/web/index.html: the export's onboarding font URL drops JetBrains Mono.
  html = html.replace(
    "family=Geist:wght@100..900&family=JetBrains+Mono:wght@100..900",
    "family=Geist:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600",
  );
  // User-approved product rename; compare the same Qelvra copy without altering exports.
  html = html.replaceAll("Agent Hive", "Qelvra");
  for (const [from, to] of DESIGN_COPY_EDITS[screen] ?? []) html = html.replaceAll(from, to);
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${screen}.html`);
  fs.writeFileSync(file, html);
  return `file://${file}`;
}

async function capture(page: Page, url: string, prepare?: () => Promise<void>): Promise<PNG> {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: FREEZE_MOTION });
  await page.evaluate(async () => {
    await document.fonts.ready;
    // CSS can't pause SMIL <animate> elements (used in the AI Studio scene).
    for (const svg of document.querySelectorAll("svg")) {
      svg.pauseAnimations();
      svg.setCurrentTime(0);
    }
  });
  await page.waitForTimeout(500);
  await prepare?.();
  return PNG.sync.read(await page.screenshot({ fullPage: true }));
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function boxesOf(page: Page, selector: string, parent = false): Promise<Box[]> {
  const locator = parent ? page.locator(selector).locator("xpath=..") : page.locator(selector);
  const boxes: Box[] = [];
  for (const element of await locator.all()) {
    const box = await element.boundingBox();
    if (box) boxes.push(box); // Screenshots are taken scrolled to the top.
  }
  if (boxes.length === 0) throw new Error(`no element for ${selector}`);
  return boxes;
}

function expectSameAt(actual: Box, expected: Box, keys: readonly (keyof Box)[], label: string) {
  for (const key of keys) {
    expect(Math.abs(actual[key] - expected[key]), `${label} ${key}`).toBeLessThanOrEqual(0.5);
  }
}

function mask(png: PNG, box: Box): void {
  const x0 = Math.floor(box.x);
  const y0 = Math.floor(box.y);
  const x1 = Math.min(png.width, Math.ceil(box.x + box.width));
  const y1 = Math.min(png.height, Math.ceil(box.y + box.height));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * png.width + x) * 4;
      png.data[i] = png.data[i + 1] = png.data[i + 2] = 0;
      png.data[i + 3] = 255;
    }
  }
}

function crop(png: PNG, x: number, y: number, width: number, height: number): PNG {
  const out = new PNG({ width, height });
  PNG.bitblt(png, out, x, y, width, height, 0, 0);
  return out;
}

// Desktop-first: verify the common desktop widths.
for (const width of [1280, 1440, 1920]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    for (const { screen, route, shell } of SCREENS) {
      test(`${width}px ${route} matches ${screen}`, async ({ page }, testInfo) => {
        const live = LIVE_ROUTES[route];
        const regions = shell === "app" ? [HEADER_AGENT_COUNT, ...(live?.regions ?? [])] : [];
        let terminalReference: TerminalReference | undefined;
        let taskReference: TaskReference | undefined;

        let design = await capture(
          page,
          staticDesignFile(screen, testInfo.outputDir),
          route === "/terminal"
            ? async () => {
                terminalReference = await readTerminalReference(page);
                await normalizeTerminal(page, terminalReference, true);
              }
            : route === "/tasks"
              ? async () => {
                  taskReference = await readTaskReference(page);
                }
              : undefined,
        );
        const designBoxes = [];
        for (const region of regions) {
          designBoxes.push(await boxesOf(page, region.design, region.designParent));
        }
        const designCutoff = live?.cutoff
          ? (await boxesOf(page, live.cutoff.design))[0]
          : undefined;

        let app = await capture(
          page,
          route === "/tasks" ? `/tasks?task=${selectedTask}` : route,
          terminalReference
            ? async () => {
                if (!terminalReference) throw new Error("Missing terminal reference");
                await expect(page.locator("[role=tab]")).toHaveCount(DESIGN_AGENTS.length);
                await expect(page.locator("#dev-shell-pane")).toHaveAttribute(
                  "data-terminal-state",
                  "connected",
                );
                await checkTerminalGeometry(page, terminalReference);
                await normalizeTerminal(page, terminalReference, false);
                await checkTerminalGeometry(page, terminalReference);
              }
            : route === "/tasks"
              ? async () => {
                  if (!taskReference) throw new Error("Missing task reference");
                  await checkTaskParity(page, taskReference, selectedTask);
                }
              : undefined,
        );
        for (const [index, region] of regions.entries()) {
          const appBoxes = await boxesOf(page, region.app);
          const expected = designBoxes[index] ?? [];
          expect(appBoxes.length, `${region.app} count`).toBe(expected.length);
          for (const [n, appBox] of appBoxes.entries()) {
            const designBox = expected[n] as Box;
            if (region.check === "anchor-end") {
              const end = (box: Box) => ({ ...box, x: box.x + box.width });
              expectSameAt(end(appBox), end(designBox), ["x", "y"], region.app);
            } else {
              const keys =
                region.check === "box"
                  ? (["x", "y", "width", "height"] as const)
                  : (["x", "y"] as const);
              expectSameAt(appBox, designBox, keys, region.app);
            }
            for (const box of [appBox, designBox]) {
              const inset = region.inset ?? 0;
              const content = {
                x: box.x + inset,
                y: box.y + inset,
                width: box.width - inset * 2,
                height: box.height - inset * 2,
              };
              mask(design, content);
              mask(app, content);
            }
          }
        }

        if (live?.cutoff && designCutoff) {
          const appCutoff = (await boxesOf(page, live.cutoff.app))[0] as Box;
          expectSameAt(appCutoff, designCutoff, ["x", "y", "width"], "live content");
          const height = Math.floor(designCutoff.y);
          design = crop(design, 0, 0, design.width, height);
          app = crop(app, 0, 0, app.width, height);
        }

        if (route === "/tasks") {
          // Content is checked against the original frame contract above. Preserve full
          // screenshots for inspection; the shared header still gets its pixel check.
          fs.writeFileSync(testInfo.outputPath("tasks-reference.png"), PNG.sync.write(design));
          fs.writeFileSync(testInfo.outputPath("tasks-app.png"), PNG.sync.write(app));
          design = crop(design, 0, 0, design.width, HEADER_HEIGHT);
          app = crop(app, 0, 0, app.width, HEADER_HEIGHT);
        }
        if (app.height !== design.height) {
          for (const [name, png] of [
            ["design", design],
            ["app", app],
          ] as const) {
            const file = testInfo.outputPath(`page-${name}.png`);
            fs.writeFileSync(file, PNG.sync.write(png));
            await testInfo.attach(`page-${name}.png`, { path: file, contentType: "image/png" });
          }
        }
        expect(app.height, "page height").toBe(design.height);
        if (route === "/terminal") {
          // Persist the compared surfaces even on success for one manual inspection.
          fs.writeFileSync(testInfo.outputPath("terminal-reference.png"), PNG.sync.write(design));
          fs.writeFileSync(testInfo.outputPath("terminal-app.png"), PNG.sync.write(app));
        }
        const x = shell === "app" ? SIDEBAR_WIDTH : 0;
        const compared =
          shell === "app"
            ? [
                { name: "header", x: 0, y: 0, w: design.width, h: HEADER_HEIGHT },
                {
                  name: "content",
                  x,
                  y: HEADER_HEIGHT,
                  w: design.width - x,
                  h: design.height - HEADER_HEIGHT,
                },
              ]
            : [{ name: "page", x: 0, y: 0, w: design.width, h: design.height }];

        for (const region of compared.filter((region) => region.h > 0)) {
          const expected = crop(design, region.x, region.y, region.w, region.h);
          const actual = crop(app, region.x, region.y, region.w, region.h);
          const diff = new PNG({ width: region.w, height: region.h });
          const mismatched = pixelmatch(expected.data, actual.data, diff.data, region.w, region.h, {
            threshold: 0.1,
          });
          if (mismatched > MAX_MISMATCHED_PIXELS) {
            await testInfo.attach(`${region.name}-design.png`, {
              body: PNG.sync.write(expected),
              contentType: "image/png",
            });
            await testInfo.attach(`${region.name}-app.png`, {
              body: PNG.sync.write(actual),
              contentType: "image/png",
            });
            await testInfo.attach(`${region.name}-diff.png`, {
              body: PNG.sync.write(diff),
              contentType: "image/png",
            });
          }
          expect(mismatched, `${region.name}: mismatched pixels`).toBeLessThanOrEqual(
            MAX_MISMATCHED_PIXELS,
          );
        }
      });
    }
  });
}
