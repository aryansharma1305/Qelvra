import { expect, type Page, type APIRequestContext } from "@playwright/test";
import { TaskResponseSchema, type TaskStatus } from "@qelvra/shared";
import { E2E_API_URL } from "../e2e/env";

/** Live fixtures only, registered through the real API; never seeded in production. */
const FIXTURES: readonly [TaskStatus, string, string | null][] = [
  ["inbox", "Refactor xterm.js WebSocket relay throttling", null],
  ["inbox", "Add robust fallback for local Whisper audio ingestion", null],
  ["inbox", "Research MCP resource subscription streaming limits", null],
  ["assigned", "Postgres vector index partitioning (IVFFlat vs HNSW)", "michael"],
  ["assigned", "Generate OpenAPI 3.1 Swagger docs for Swarm RPC", "nova"],
  ["working", "Implement Login API & WebAuthn Session Bridge", "atlas"],
  ["working", "Optimize WebGL desk instance rendering pipeline", "nova"],
  ["working", "Build Figma component library for terminal controls", "pixel"],
  ["review", "Multi-tenant isolated SQLite worker pool sync", "scout"],
  ["review", "Audit Dockerfile multi-stage alpine base layers", "nova"],
  ["completed", "Set up Redis Cluster Sentinel failover topology", "atlas"],
  ["completed", "Telemetry Prometheus exporter endpoint scrape hook", "michael"],
  ["completed", "Sync Figma design token CSS mapping variables", "pixel"],
  ["completed", "Auth0 schema migration & claim standardizer", "atlas"],
];
export async function seedTasks(request: APIRequestContext) {
  const existing = (await (await request.get(`${E2E_API_URL}/api/tasks`)).json()) as {
    tasks: { id: string; title: string }[];
  };
  let selected = "";
  for (const [status, title, assignee] of FIXTURES) {
    const found = existing.tasks.find((task) => task.title === title);
    if (found) {
      if (title.startsWith("Implement Login")) selected = found.id;
      continue;
    }
    const response = await request.post(`${E2E_API_URL}/api/tasks`, {
      data: { title, description: "Task description from the persistent registry.", assignee },
    });
    expect(response.status()).toBe(201);
    const { task } = TaskResponseSchema.parse(await response.json());
    const actions =
      status === "completed"
        ? ["start", "review", "complete"]
        : status === "review"
          ? ["start", "review"]
          : status === "working"
            ? ["start"]
            : [];
    for (const action of actions)
      expect((await request.post(`${E2E_API_URL}/api/tasks/${task.id}/${action}`)).status()).toBe(
        200,
      );
    if (title.startsWith("Implement Login")) selected = task.id;
  }
  return selected;
}
const STYLE_KEYS = [
  "backgroundColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "borderRadius",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "gap",
] as const;
interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
  styles: Record<string, string>;
}
interface Reference {
  header: Frame;
  heading: Frame;
  metrics: Frame[];
  board: Frame;
  columns: Frame[];
  columnHeaders: Frame[];
  cards: Frame[];
  inspector: Frame;
  titleStyle: Record<string, string>;
}
async function frames(page: Page, selector: string): Promise<Frame[]> {
  return page.locator(selector).evaluateAll(
    (elements, keys) =>
      elements.map((element) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          x,
          y,
          width,
          height,
          styles: Object.fromEntries(
            keys.map((key) => [key, style[key as keyof CSSStyleDeclaration] as string]),
          ),
        };
      }),
    [...STYLE_KEYS],
  );
}
export async function readTaskReference(page: Page): Promise<Reference> {
  const header = "main > div > div:first-child";
  return {
    header: (await frames(page, header))[0] as Frame,
    heading: (await frames(page, "main h1"))[0] as Frame,
    metrics: await frames(page, `${header} > div:last-child > div`),
    board: (await frames(page, "#kanban-canvas"))[0] as Frame,
    columns: await frames(page, "#kanban-canvas > div > div"),
    columnHeaders: await frames(page, "#kanban-canvas > div > div > div:first-child"),
    cards: await frames(page, "#kanban-canvas > div > div > div:last-child > div:first-child"),
    inspector: (await frames(page, "#inspector-drawer"))[0] as Frame,
    titleStyle: await page
      .locator("#kanban-canvas h4")
      .first()
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          fontFamily: s.fontFamily,
          fontSize: s.fontSize,
          lineHeight: s.lineHeight,
          color: s.color,
        };
      }),
  };
}
const same = (
  actual: Frame,
  expected: Frame,
  keys: readonly ("x" | "y" | "width" | "height")[],
  label: string,
) => {
  for (const key of keys)
    expect(Math.abs(actual[key] - expected[key]), `${label} ${key}`).toBeLessThanOrEqual(0.5);
  expect(actual.styles, `${label} chrome`).toEqual(expected.styles);
};
/**
 * The original task pixels contain unsupported priority/progress/telemetry. Do not
 * normalize these into fake production values or mask the entire board. Compare the
 * incumbent frames, layout and palette directly, and assert the real data separately.
 * All other routes retain their full pixel comparisons and the global 300px tolerance.
 */
export async function checkTaskParity(page: Page, ref: Reference, selected: string) {
  await expect(page.locator(".task-card")).toHaveCount(14);
  await expect(page.locator("#inspector-drawer")).toHaveAttribute("data-task", selected);
  const header = "main > div > div:first-child";
  same((await frames(page, header))[0] as Frame, ref.header, ["x", "y", "width"], "mission header");
  same((await frames(page, "main h1"))[0] as Frame, ref.heading, ["x"], "heading");
  const metrics = await frames(page, `${header} > div:last-child > div`);
  expect(metrics).toHaveLength(ref.metrics.length);
  metrics.forEach((frame, i) =>
    same(frame, ref.metrics[i] as Frame, ["x", "width"], `metric ${i}`),
  );
  same((await frames(page, "#kanban-canvas"))[0] as Frame, ref.board, ["x", "width"], "board");
  // Live count/copy length can wrap differently from Sprint/Epoch/velocity labels.
  // Preserve the vertical rhythm relative to the header rather than pinning those labels.
  const liveHeader = (await frames(page, header))[0] as Frame;
  const board = (await frames(page, "#kanban-canvas"))[0] as Frame;
  expect(board.y).toBe(liveHeader.y + liveHeader.height);
  const columns = await frames(page, "[data-task-column]");
  expect(columns).toHaveLength(5);
  const headers = await frames(page, "[data-task-column] > div:first-child");
  const cards = await frames(page, "[data-task-column] > div:last-child > .task-card:first-child");
  columns.forEach((column, i) => {
    expect(column.y).toBe(board.y + 24);
    expect(headers[i]?.y).toBe(column.y + 1);
    expect(cards[i]?.y).toBe((headers[i] as Frame).y + (headers[i] as Frame).height + 12);
    same(column, ref.columns[i] as Frame, ["x", "width"], `column ${i}`);
    same(
      headers[i] as Frame,
      ref.columnHeaders[i] as Frame,
      ["x", "width", "height"],
      `column header ${i}`,
    );
    // Inner content/height changes with the stored description and honest state.
    same(cards[i] as Frame, ref.cards[i] as Frame, ["x", "width"], `card ${i}`);
  });
  same(
    (await frames(page, "#inspector-drawer"))[0] as Frame,
    ref.inspector,
    ["x", "width"],
    "inspector",
  );
  const font = await page
    .locator("#kanban-canvas h4")
    .first()
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        fontFamily: s.fontFamily,
        fontSize: s.fontSize,
        lineHeight: s.lineHeight,
        color: s.color,
      };
    });
  expect(font).toEqual(ref.titleStyle);
  for (const [status, title] of FIXTURES)
    await expect(
      page
        .locator(`[data-task-column="${status}"]`)
        .getByRole("button", { name: `Inspect ${title}`, exact: true }),
    ).toHaveCount(1);
  await expect(page.locator("main")).not.toContainText(
    /High Priority|Spinning Env|72%|18m 45s|Avg Velocity|4 \/ 5 Complete/,
  );
  await expect(page.locator("main")).toContainText("4 / 14 Completed");
}
export type TaskReference = Reference;
