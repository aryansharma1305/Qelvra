import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { z } from "zod";
import { ProjectSchema, PROJECT_LIMIT, type Project } from "@qelvra/shared";
import { writeFileAtomic } from "../lib/atomic-write.js";
import { AppError } from "../lib/errors.js";
export const ProjectStoreSchema = z
  .strictObject({ version: z.literal(1), projects: z.array(ProjectSchema).max(PROJECT_LIMIT) })
  .superRefine((v, ctx) => {
    for (const field of ["id", "path"] as const)
      if (new Set(v.projects.map((p) => p[field])).size !== v.projects.length)
        ctx.addIssue({ code: "custom", message: "Duplicate project identity" });
  });
export class ProjectStore {
  private projects: Project[] = [];
  private constructor(
    private readonly file: string,
    private readonly persist = writeFileAtomic,
  ) {}
  static async open(file: string, persist = writeFileAtomic) {
    const store = new ProjectStore(file, persist);
    try {
      const h = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      try {
        const s = await h.stat();
        if (!s.isFile() || s.nlink !== 1 || s.size > 2 * 1024 * 1024)
          throw new Error("Invalid projects snapshot");
        store.projects = ProjectStoreSchema.parse(JSON.parse(await h.readFile("utf8"))).projects;
      } finally {
        await h.close();
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT")
        throw new AppError(
          500,
          "PROJECT_PERSISTENCE_FAILED",
          "Project storage needs repair; existing data was preserved",
        );
    }
    return store;
  }
  list() {
    return structuredClone(this.projects);
  }
  async save(projects: Project[]) {
    const data = ProjectStoreSchema.parse({ version: 1, projects });
    try {
      const text = JSON.stringify(data, null, 2) + "\n";
      if (Buffer.byteLength(text) > 2 * 1024 * 1024)
        throw new Error("Project storage limit exceeded");
      await this.persist(this.file, text);
    } catch {
      throw new AppError(
        500,
        "PROJECT_PERSISTENCE_FAILED",
        "Could not save project metadata; repositories were not modified",
      );
    }
    this.projects = data.projects;
  }
}
