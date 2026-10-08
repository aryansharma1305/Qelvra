import { z } from "zod";
export const WORKSPACE_TEXT_LIMIT = 1024 * 1024;
export const WORKSPACE_ENTRY_LIMIT = 2000;
export function isWorkspacePath(path: string, root = false): boolean {
  if (path === "") return root;
  return (
    path.length <= 1024 &&
    !/^[a-z]:/i.test(path) &&
    !path.includes("\\") &&
    !Array.from(path).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) &&
    !/%(?:2e|2f|5c|00|25)/i.test(path) &&
    path
      .split("/")
      .every(
        (part) =>
          part !== "" && part !== "." && part !== ".." && !part.startsWith(".qelvra-files-tmp-"),
      )
  );
}
export const WorkspacePathSchema = z
  .string()
  .refine(
    (p) => isWorkspacePath(p),
    "Use a relative workspace path without dot segments or encoded separators",
  );
export const WorkspaceDirectoryPathSchema = z
  .string()
  .refine((p) => isWorkspacePath(p, true), "Invalid workspace directory path");
export const WorkspaceEntrySchema = z.strictObject({
  name: z.string(),
  path: WorkspaceDirectoryPathSchema,
  type: z.enum(["file", "directory", "unsupported"]),
  size: z.number().int().nonnegative(),
  modifiedAt: z.iso.datetime(),
});
export const WorkspaceListingSchema = z.strictObject({
  path: WorkspaceDirectoryPathSchema,
  parentPath: WorkspaceDirectoryPathSchema.nullable(),
  entries: z.array(WorkspaceEntrySchema).max(WORKSPACE_ENTRY_LIMIT),
  hiddenEntries: z.number().int().nonnegative(),
});
export const WorkspaceFileSchema = z.strictObject({
  path: WorkspacePathSchema,
  size: z.number().int().max(WORKSPACE_TEXT_LIMIT).nonnegative(),
  modifiedAt: z.iso.datetime(),
  content: z.string(),
  encoding: z.literal("utf-8"),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
});
export const WorkspaceFileResponseSchema = z.strictObject({ file: WorkspaceFileSchema });
export const WorkspaceEntryResponseSchema = z.strictObject({ entry: WorkspaceEntrySchema });
export const WorkspaceCreateRequestSchema = z.strictObject({ path: WorkspacePathSchema });
export const WorkspaceWriteRequestSchema = z.strictObject({
  path: WorkspacePathSchema,
  content: z.string().max(WORKSPACE_TEXT_LIMIT),
  revision: WorkspaceFileSchema.shape.revision,
});
export const WorkspaceMoveRequestSchema = z.strictObject({
  from: WorkspacePathSchema,
  to: WorkspacePathSchema,
});
export const WorkspaceDeleteRequestSchema = z.strictObject({
  path: WorkspacePathSchema,
  recursive: z.boolean().default(false),
});
export type WorkspaceEntry = z.infer<typeof WorkspaceEntrySchema>;
export type WorkspaceListing = z.infer<typeof WorkspaceListingSchema>;
export type WorkspaceFile = z.infer<typeof WorkspaceFileSchema>;
export type WorkspaceWriteRequest = z.infer<typeof WorkspaceWriteRequestSchema>;
