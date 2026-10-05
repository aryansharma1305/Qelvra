import { readFile } from "node:fs/promises";
import { z } from "zod";
import { ExecutionSchema, type Execution } from "@qelvra/shared";
import { writeFileAtomic } from "../lib/atomic-write.js";
import { ExecutionError } from "./execution-errors.js";

export const isActiveExecution = (e: Execution) =>
  ["queued", "starting", "running", "awaiting_result"].includes(e.status);
const schema = z.strictObject({ version: z.literal(1), executions: z.array(ExecutionSchema) });
export class ExecutionStore {
  private records = new Map<string, Execution>();
  private queue: Promise<unknown> = Promise.resolve();
  private constructor(private readonly file: string) {}
  static async open(file: string) {
    const store = new ExecutionStore(file);
    try {
      const data = schema.parse(JSON.parse(await readFile(file, "utf8")));
      for (const execution of data.executions) {
        if (store.records.has(execution.id)) throw new Error("Duplicate execution");
        store.records.set(execution.id, execution);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        throw new ExecutionError("EXECUTION_PERSISTENCE_FAILED");
    }
    return store;
  }
  list() {
    return [...this.records.values()].map((e) => structuredClone(e));
  }
  get(id: string) {
    const record = this.records.get(id);
    return record ? structuredClone(record) : undefined;
  }
  latest(taskId: string) {
    return (
      this.list()
        .filter((e) => e.taskId === taskId)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt) || b.id.localeCompare(a.id))[0] ??
      null
    );
  }
  save(record: Execution): Promise<Execution> {
    const operation = this.queue.then(async () => {
      const parsed = ExecutionSchema.parse(record);
      const next = new Map(this.records);
      next.set(parsed.id, parsed);
      try {
        await writeFileAtomic(
          this.file,
          `${JSON.stringify({ version: 1, executions: [...next.values()] }, null, 2)}\n`,
        );
      } catch {
        throw new ExecutionError("EXECUTION_PERSISTENCE_FAILED");
      }
      this.records = next;
      return structuredClone(parsed);
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }
}
