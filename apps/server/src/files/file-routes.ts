import { z } from "zod";
import type { FastifyInstance } from "fastify";
import {
  AgentIdSchema,
  WorkspaceDirectoryPathSchema,
  WorkspacePathSchema,
  WorkspaceCreateRequestSchema,
  WorkspaceWriteRequestSchema,
  WorkspaceMoveRequestSchema,
  WorkspaceDeleteRequestSchema,
  WORKSPACE_TEXT_LIMIT,
} from "@qelvra/shared";
import { AppError } from "../lib/errors.js";
import type { WorkspaceFileService } from "./workspace-file-service.js";
const directoryQuery = z.strictObject({ path: WorkspaceDirectoryPathSchema.default("") });
const fileQuery = z.strictObject({ path: WorkspacePathSchema });
function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const input = schema.safeParse(raw);
  if (!input.success)
    throw new AppError(
      400,
      "FILE_INVALID_PATH",
      "Supply valid relative workspace paths and operation fields",
    );
  return input.data;
}
export function registerFileRoutes(app: FastifyInstance, files: WorkspaceFileService) {
  const id = (request: { params: unknown }) => {
    const params = z.strictObject({ id: AgentIdSchema }).safeParse(request.params);
    if (!params.success) throw new AppError(400, "AGENT_INVALID_ID", "Invalid agent id");
    return params.data.id;
  };
  const root = "/api/agents/:id/files";
  app.get(root, (request) => files.list(id(request), parse(directoryQuery, request.query).path));
  app.get(`${root}/entry`, async (request) => ({
    entry: await files.stat(id(request), parse(fileQuery, request.query).path),
  }));
  app.get(`${root}/content`, async (request) => ({
    file: await files.readText(id(request), parse(fileQuery, request.query).path),
  }));
  app.put(`${root}/content`, { bodyLimit: WORKSPACE_TEXT_LIMIT * 6 + 4096 }, async (request) => {
    const input = WorkspaceWriteRequestSchema.safeParse(request.body);
    if (
      !input.success &&
      input.error.issues.some((issue) => issue.path[0] === "content" && issue.code === "too_big")
    )
      throw new AppError(413, "FILE_TOO_LARGE", "Text exceeds the 1 MiB editor limit");
    return {
      file: await files.writeText(id(request), parse(WorkspaceWriteRequestSchema, request.body)),
    };
  });
  for (const directory of [false, true])
    app.post(`${root}/${directory ? "directory" : "file"}`, async (request, reply) => {
      const entry = await files.create(
        id(request),
        parse(WorkspaceCreateRequestSchema, request.body).path,
        directory,
      );
      reply.code(201);
      return { entry };
    });
  app.post(`${root}/move`, async (request) => {
    const input = parse(WorkspaceMoveRequestSchema, request.body);
    return { entry: await files.move(id(request), input.from, input.to) };
  });
  app.delete(root, async (request, reply) => {
    const input = parse(WorkspaceDeleteRequestSchema, request.body);
    await files.delete(id(request), input.path, input.recursive);
    return reply.code(204).send();
  });
}
