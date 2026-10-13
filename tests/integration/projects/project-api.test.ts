import { mkdtemp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { ProjectResponseSchema, ProjectListSchema } from "@qelvra/shared";
import { createApp } from "../../../apps/server/src/app";
import { loadConfig } from "../../../apps/server/src/config/env";
import { ProviderRegistry } from "../../../apps/server/src/providers/provider-registry";
import { fixtureRepository, repositorySnapshot } from "../../fixtures/git-repository";
let root: string, repo: string, app: FastifyInstance;
const config = () =>
  loadConfig({
    DATA_DIR: join(root, "data"),
    WORKSPACE_ROOT: join(root, "scratch"),
    NODE_ENV: "test",
    WEB_ORIGIN: "http://127.0.0.1:5174",
  });
const options = () => ({
  logger: false,
  providerRegistry: new ProviderRegistry({ allowFake: true, env: { PATH: "", SHELL: "/bin/sh" } }),
});
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "qelvra-project-api-"));
  repo = await fixtureRepository(join(root, "repo"));
  await mkdir(join(root, "scratch"));
  app = await createApp(config(), options());
  await app.ready();
});
afterEach(async () => {
  await app.close();
  await rm(root, { recursive: true, force: true });
});
const register = () =>
  app.inject({ method: "POST", url: "/api/projects", payload: { name: "Project", path: repo } });
it("registers, lists, gets, refreshes and unregisters persistent real snapshots without repository mutations", async () => {
  const before = await repositorySnapshot(repo);
  const response = await register();
  expect(response.statusCode).toBe(201);
  expect(response.headers["cache-control"]).toBe("no-store");
  const { project } = ProjectResponseSchema.parse(response.json());
  expect(ProjectListSchema.parse((await app.inject("/api/projects")).json()).projects).toEqual([
    project,
  ]);
  expect(
    ProjectResponseSchema.parse((await app.inject(`/api/projects/${project.id}`)).json()).project,
  ).toEqual(project);
  expect(
    (await app.inject({ method: "POST", url: `/api/projects/${project.id}/refresh` })).statusCode,
  ).toBe(200);
  await app.close();
  app = await createApp(config(), options());
  await app.ready();
  expect((await app.inject(`/api/projects/${project.id}`)).statusCode).toBe(200);
  expect(
    (await app.inject({ method: "DELETE", url: `/api/projects/${project.id}` })).statusCode,
  ).toBe(204);
  expect((await app.inject(`/api/projects/${project.id}`)).statusCode).toBe(404);
  expect(await repositorySnapshot(repo)).toEqual(before);
});
it("leaves existing agent workspace, task, memory, automation and activity state unchanged", async () => {
  const agent = await app.runtime.create({
    name: "Kite disposable",
    role: "Engineer",
    providerId: "fake",
  });
  await app.tasks.create({ title: "PRIVATE_PROMPT", assignee: agent.id });
  await writeFile(join(root, "data/hive/agents", agent.id, "memory.md"), "PRIVATE_MEMORY");
  await app.activity.flush();
  const before = await repositorySnapshot(join(root, "data"));
  const response = await register();
  expect(response.statusCode).toBe(201);
  const text = response.body + (await app.inject("/api/projects")).body;
  expect(text).not.toMatch(/PRIVATE_PROMPT|PRIVATE_MEMORY|README\.md|stdout|stderr|remote|config/);
  await app.activity.flush();
  const after = await repositorySnapshot(join(root, "data"));
  for (const [file, value] of Object.entries(before)) expect(after[file]).toBe(value);
  expect((await app.tasks.list()).length).toBe(1);
});
it("validates bodies, queries, IDs and rejects arbitrary commands", async () => {
  for (const payload of [
    { name: "App", path: "relative" },
    { name: "App", path: "https://example.invalid" },
    { name: "App", path: repo, args: ["status"] },
    { name: "", path: repo },
    { name: "App", path: repo, env: {} },
    [],
    null,
  ]) {
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/projects",
          headers: { "content-type": "application/json" },
          payload: JSON.stringify(payload),
        })
      ).statusCode,
    ).toBe(400);
  }
  expect((await app.inject("/api/projects?path=PRIVATE_PATH")).statusCode).toBe(400);
  expect((await app.inject("/api/projects/../../private")).statusCode).toBe(404);
  expect((await app.inject("/api/projects/not-an-id")).statusCode).toBe(400);
  const { project } = ProjectResponseSchema.parse((await register()).json());
  for (const payload of [{ args: ["fetch"] }, { force: true }, { path: repo }])
    expect(
      (await app.inject({ method: "POST", url: `/api/projects/${project.id}/refresh`, payload }))
        .statusCode,
    ).toBe(400);
  expect(
    (await app.inject({ method: "POST", url: `/api/projects/${project.id}/refresh?force=true` }))
      .statusCode,
  ).toBe(400);
  expect(
    (
      await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}`,
        payload: { path: repo },
      })
    ).statusCode,
  ).toBe(404);
});
it("contains path/config errors and applies origin/Host controls", async () => {
  for (const headers of [
    { origin: "https://evil.invalid" },
    { "sec-fetch-site": "cross-site" },
    { host: "evil.invalid" },
  ])
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/projects",
          payload: { name: "App", path: repo },
          headers,
        })
      ).statusCode,
    ).toBe(403);
  await writeFile(join(repo, ".git/config"), "[include]\npath = /PRIVATE_SECRET_PATH\n");
  const response = await register();
  expect(response.statusCode).toBe(422);
  expect(response.body).not.toContain("PRIVATE_SECRET_PATH");
  expect(response.body).not.toContain(repo);
});
it("fails closed on second DATA_DIR owner and preserves corrupted project storage", async () => {
  await expect(createApp(config(), options())).rejects.toThrow();
  await app.close();
  await writeFile(join(root, "data/projects.json"), "CORRUPT_PRIVATE");
  await expect(createApp(config(), options())).rejects.toThrow();
  expect(await readFile(join(root, "data/projects.json"), "utf8")).toBe("CORRUPT_PRIVATE");
});
