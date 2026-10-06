import { readFile } from "node:fs/promises";
import { z } from "zod";
import { OrchestrationSchema, type Orchestration } from "@qelvra/shared";
import { writeFileAtomic } from "../lib/atomic-write.js";
import { OrchestrationError } from "./orchestration-errors.js";
export const OrchestrationStoreFileSchema = z.strictObject({
  version: z.literal(1),
  orchestrations: z.array(OrchestrationSchema),
});
export class OrchestrationStore {
  private records = new Map<string, Orchestration>();
  private queue: Promise<unknown> = Promise.resolve();
  private constructor(private readonly file: string) {}
  static async open(file: string) {
    const store = new OrchestrationStore(file);
    try {
      const parsed = OrchestrationStoreFileSchema.parse(JSON.parse(await readFile(file, "utf8")));
      const taskIds = new Set<string>();
      for (const record of parsed.orchestrations) {
        if (store.records.has(record.id)) throw new Error("Duplicate goal");
        for (const id of [...record.taskIds, ...record.controlTaskIds]) {
          if (taskIds.has(id)) throw new Error("Duplicate owned task");
          taskIds.add(id);
        }
        store.records.set(record.id, record);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        throw new OrchestrationError("ORCHESTRATION_PERSISTENCE_FAILED");
    }
    return store;
  }
  list() {
    return [...this.records.values()].map((r) => structuredClone(r));
  }
  get(id: string) {
    const record = this.records.get(id);
    return record ? structuredClone(record) : undefined;
  }
  save(record: Orchestration) {
    const result = this.queue.then(async () => {
      const parsed = OrchestrationSchema.parse(record),
        next = new Map(this.records);
      next.set(parsed.id, parsed);
      try {
        await writeFileAtomic(
          this.file,
          `${JSON.stringify({ version: 1, orchestrations: [...next.values()] }, null, 2)}\n`,
        );
      } catch {
        throw new OrchestrationError("ORCHESTRATION_PERSISTENCE_FAILED");
      }
      this.records = next;
      return structuredClone(parsed);
    });
    this.queue = result.catch(() => undefined);
    return result;
  }
}
