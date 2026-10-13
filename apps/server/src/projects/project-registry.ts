import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { RegisterProjectSchema, ProjectUnavailableCodeSchema, type Project } from "@qelvra/shared";
import { AppError } from "../lib/errors.js";
import { GitInspector } from "./git-inspector.js";
import { ProjectStore } from "./project-store.js";
export class ProjectRegistry {
  private queue: Promise<unknown> = Promise.resolve();
  private closing = false;
  private constructor(
    private readonly store: ProjectStore,
    private readonly inspector: GitInspector,
  ) {}
  static async open(dataDir: string) {
    return new ProjectRegistry(
      await ProjectStore.open(join(dataDir, "projects.json")),
      new GitInspector(dataDir),
    );
  }
  list() {
    return { projects: this.store.list(), limit: 100 as const };
  }
  get(id: string) {
    const project = this.store.list().find((p) => p.id === id);
    if (!project) throw new AppError(404, "PROJECT_NOT_FOUND", "Project is not registered");
    return { project };
  }
  private assertOpen() {
    if (this.closing) throw new AppError(503, "PROJECT_BUSY", "Project inspection is stopping");
  }
  private serial<T>(work: () => Promise<T>) {
    if (this.closing)
      return Promise.reject(new AppError(503, "PROJECT_BUSY", "Project inspection is stopping"));
    const next = this.queue.then(work, work);
    this.queue = next.catch(() => undefined);
    return next;
  }
  async register(raw: unknown) {
    this.assertOpen();
    const parsed = RegisterProjectSchema.safeParse(raw);
    if (!parsed.success)
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Supply a display name and absolute local repository path only",
      );
    // Do not queue Git jobs from arbitrarily many callers; inspection has one global slot.
    const result = await this.inspector.inspect(parsed.data.path);
    return this.serial(async () => {
      const projects = this.store.list();
      if (projects.some((p) => p.path === result.path))
        throw new AppError(409, "PROJECT_DUPLICATE", "This repository is already registered");
      if (projects.length >= 100)
        throw new AppError(
          409,
          "PROJECT_LIMIT",
          "Maximum 100 registered projects; unregister one first",
        );
      const now = new Date().toISOString();
      const project: Project = {
        ...parsed.data,
        ...result,
        id: "project-" + randomUUID(),
        createdAt: now,
        updatedAt: now,
        inspectedAt: now,
      };
      await this.store.save([...projects, project]);
      return { project };
    });
  }
  async refresh(id: string) {
    this.assertOpen();
    const original = this.get(id).project;
    let inspection: Project["inspection"];
    try {
      inspection = (await this.inspector.inspect(original.path, original.identity)).inspection;
    } catch (e) {
      const code = ProjectUnavailableCodeSchema.safeParse((e as { code?: unknown }).code);
      if (!code.success) throw e;
      inspection = { state: "unavailable", code: code.data };
    }
    return this.serial(async () => {
      const latest = this.get(id).project,
        now = new Date().toISOString();
      const project = { ...latest, inspection, inspectedAt: now, updatedAt: now };
      await this.store.save(this.store.list().map((p) => (p.id === id ? project : p)));
      return { project };
    });
  }
  unregister(id: string) {
    return this.serial(async () => {
      this.get(id);
      await this.store.save(this.store.list().filter((p) => p.id !== id));
    });
  }
  async close() {
    this.closing = true;
    await this.inspector.drain();
    await this.queue;
  }
}
