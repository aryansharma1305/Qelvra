import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ActivityStore, ActivityPublisher } from "../../apps/server/src/activity";
import { AgentRegistry } from "../../apps/server/src/agents/agent-registry";
import { AnalyticsService } from "../../apps/server/src/analytics";
import { analyticsHistory } from "./analytics-history";
/** Real retained-history service for controlled browser dates/health; no production test API. */
export async function analyticsFixture(corrupt = false) {
  const dir = await mkdtemp(join(tmpdir(), "qelvra-analytics-fixture-"));
  const registry = await AgentRegistry.open({
    file: join(dir, "agents.json"),
    clock: () => new Date("2026-10-05T00:00:00.000Z"),
  });
  for (const name of ["Nova", "Atlas"])
    await registry.create({ name, role: "Engineer", providerId: "fake" });
  await writeFile(
    join(dir, "events.jsonl"),
    analyticsHistory()
      .map((event) => JSON.stringify(event))
      .join("\n") +
      "\n" +
      (corrupt ? "PRIVATE_CORRUPTION\n" : ""),
  );
  const publisher = new ActivityPublisher(await ActivityStore.open(join(dir, "events.jsonl")));
  const service = new AnalyticsService(
    publisher,
    registry,
    () => new Date("2026-10-05T12:00:00.000Z"),
  );
  return {
    service,
    registry,
    dir,
    async close() {
      await publisher.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
}
