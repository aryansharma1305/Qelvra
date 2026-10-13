import { z } from "zod";
export const PROJECT_LIMIT = 100;
export const PROJECT_BRANCH_LIMIT = 200;
export const ProjectIdSchema = z
  .string()
  .regex(/^project-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
export const ProjectNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine((v) => !Array.from(v).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127));
export const ProjectPathSchema = z
  .string()
  .min(1)
  .max(4096)
  .refine(
    (v) =>
      !Array.from(v).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) &&
      v.startsWith("/") &&
      !v.startsWith("//") &&
      !v.includes("://"),
  );
export const RegisterProjectSchema = z.strictObject({
  name: ProjectNameSchema,
  path: ProjectPathSchema,
});
export const ProjectUnavailableCodeSchema = z.enum([
  "PROJECT_INVALID_PATH",
  "PROJECT_UNSUPPORTED",
  "PROJECT_CHANGED",
  "PROJECT_GIT_UNAVAILABLE",
  "PROJECT_INSPECTION_FAILED",
  "PROJECT_INSPECTION_LIMIT",
]);
export const ProjectInspectionSchema = z.discriminatedUnion("state", [
  z.strictObject({
    state: z.literal("available"),
    head: z.strictObject({
      kind: z.enum(["branch", "detached", "unborn"]),
      branch: z.string().max(1024).nullable(),
      commit: z
        .string()
        .regex(/^[0-9a-f]{40}$/)
        .nullable(),
    }),
    staged: z.number().int().nonnegative(),
    unstaged: z.number().int().nonnegative(),
    branches: z.array(z.string().max(1024)).max(PROJECT_BRANCH_LIMIT),
    branchesTruncated: z.boolean(),
    untrackedExcluded: z.literal(true),
    submodulesExcluded: z.literal(true),
  }),
  z.strictObject({ state: z.literal("unavailable"), code: ProjectUnavailableCodeSchema }),
]);
export const ProjectIdentitySchema = z.strictObject({
  rootDevice: z.string().regex(/^\d+$/),
  rootInode: z.string().regex(/^\d+$/),
  gitDevice: z.string().regex(/^\d+$/),
  gitInode: z.string().regex(/^\d+$/),
});
export const ProjectSchema = RegisterProjectSchema.extend({
  id: ProjectIdSchema,
  identity: ProjectIdentitySchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  inspectedAt: z.iso.datetime(),
  inspection: ProjectInspectionSchema,
});
export const ProjectListSchema = z.strictObject({
  projects: z.array(ProjectSchema).max(PROJECT_LIMIT),
  limit: z.literal(100),
});
export const ProjectResponseSchema = z.strictObject({ project: ProjectSchema });
export type Project = z.infer<typeof ProjectSchema>;
export type ProjectInspection = z.infer<typeof ProjectInspectionSchema>;
export type ProjectIdentity = z.infer<typeof ProjectIdentitySchema>;
export type ProjectUnavailableCode = z.infer<typeof ProjectUnavailableCodeSchema>;

export type RegisterProject = z.infer<typeof RegisterProjectSchema>;
