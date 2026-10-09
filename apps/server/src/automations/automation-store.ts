import { open } from "node:fs/promises";
import { constants } from "node:fs";
import { z } from "zod";
import {
  AUTOMATION_LIMITS,
  AutomationSchema,
  AutomationRunSchema,
  type Automation,
  type AutomationRun,
} from "@qelvra/shared";
import { writeFileAtomic } from "../lib/atomic-write.js";
import { AppError } from "../lib/errors.js";
export const AutomationStoreSchema = z
  .strictObject({
    version: z.literal(1),
    automations: z.array(AutomationSchema).max(100),
    runs: z.array(AutomationRunSchema).max(500),
  })
  .superRefine((value, ctx) => {
    if (
      value.runs.some(
        (r) =>
          (r.status === "skipped") !== (r.taskId === null) ||
          ["reserved", "running"].includes(r.status) !== (r.finishedAt === null) ||
          (r.trigger === "manual") !== (r.requestedRevision !== null) ||
          (r.trigger === "scheduled") !== (r.scheduledAt !== null) ||
          r.ordinal > (value.automations.find((a) => a.id === r.automationId)?.runCount ?? 0),
      )
    )
      ctx.addIssue({ code: "custom", message: "Invalid run reservation" });
    if (
      value.automations.some(
        (a) =>
          a.nextRunAt !== null &&
          (a.schedule.kind === "once"
            ? Date.parse(a.nextRunAt) !== Date.parse(a.schedule.at)
            : Date.parse(a.nextRunAt) < Date.parse(a.schedule.startsAt) ||
              (Date.parse(a.nextRunAt) - Date.parse(a.schedule.startsAt)) %
                (a.schedule.everyMinutes * 60000) !==
                0),
      )
    )
      ctx.addIssue({ code: "custom", message: "Next due does not match cadence" });
    if (
      new Set(value.runs.map((r) => `${r.automationId}:${r.ordinal}`)).size !== value.runs.length ||
      new Set(
        value.runs
          .filter((r) => r.trigger === "manual")
          .map((r) => `${r.automationId}:${r.requestedRevision}`),
      ).size !== value.runs.filter((r) => r.trigger === "manual").length
    )
      ctx.addIssue({ code: "custom", message: "Duplicate run admission" });
    const taskIds = value.runs.flatMap((r) => (r.taskId ? [r.taskId] : []));
    if (
      new Set(value.automations.map((a) => a.id)).size !== value.automations.length ||
      new Set(value.runs.map((r) => r.id)).size !== value.runs.length ||
      new Set(taskIds).size !== taskIds.length
    )
      ctx.addIssue({ code: "custom", message: "Duplicate automation identity" });
    if (value.runs.some((r) => !value.automations.some((a) => a.id === r.automationId)))
      ctx.addIssue({ code: "custom", message: "Orphan automation run" });
    if (
      value.automations.some(
        (a) => a.enabled !== (a.nextRunAt !== null) || (a.needsAttention && a.enabled),
      )
    )
      ctx.addIssue({ code: "custom", message: "Invalid scheduling state" });
    if (value.runs.filter((r) => ["reserved", "running"].includes(r.status)).length > 1)
      ctx.addIssue({ code: "custom", message: "Scheduler concurrency exceeded" });
  });
export class AutomationStore {
  private data: z.infer<typeof AutomationStoreSchema> = { version: 1, automations: [], runs: [] };
  private constructor(
    private readonly file: string,
    private readonly persist = writeFileAtomic,
  ) {}
  static async open(file: string, persist = writeFileAtomic) {
    const store = new AutomationStore(file, persist);
    try {
      const handle = await open(
        file,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      try {
        const info = await handle.stat();
        if (!info.isFile() || info.nlink !== 1 || info.size > 32 * 1024 * 1024)
          throw new Error("Invalid snapshot");
        store.data = AutomationStoreSchema.parse(JSON.parse(await handle.readFile("utf8")));
      } finally {
        await handle.close();
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        throw new AppError(
          500,
          "AUTOMATION_PERSISTENCE_FAILED",
          "Automation storage needs repair; existing data was preserved",
        );
    }
    return store;
  }
  snapshot() {
    return structuredClone(this.data);
  }
  async save(automations: Automation[], runs: AutomationRun[]) {
    // Preserve each automation's latest run and every active reservation when trimming.
    const ordered = [...runs].sort(
      (a, b) =>
        b.startedAt.localeCompare(a.startedAt) || b.ordinal - a.ordinal || b.id.localeCompare(a.id),
    );
    const keep = new Set<string>();
    const latest = new Map<string, AutomationRun>();
    for (const run of ordered) {
      const previous = latest.get(run.automationId);
      if (!previous || run.ordinal > previous.ordinal) latest.set(run.automationId, run);
      if (["reserved", "running"].includes(run.status)) keep.add(run.id);
    }
    for (const run of latest.values()) keep.add(run.id);
    for (const run of ordered) {
      if (keep.size >= AUTOMATION_LIMITS.runs) break;
      keep.add(run.id);
    }
    const next = AutomationStoreSchema.parse({
      version: 1,
      automations,
      runs: ordered.filter((r) => keep.has(r.id)),
    });
    try {
      await this.persist(this.file, JSON.stringify(next, null, 2) + "\n");
    } catch {
      throw new AppError(
        500,
        "AUTOMATION_PERSISTENCE_FAILED",
        "Could not save automations; no new work was dispatched",
      );
    }
    this.data = next;
  }
}
