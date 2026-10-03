// Child-process fixture: runs the real server startup + shutdown handlers with two PTY
// sessions (one busy), prints their pids as JSON, then waits for a signal from the test.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../../apps/server/src/config/env";
import { installShutdownHandlers, startServer } from "../../apps/server/src/server";

const sleepSeconds = process.env.QELVRA_TEST_SLEEP ?? "600";
const dataDir = mkdtempSync(join(tmpdir(), "qelvra-fixture-data-"));
const config = { ...loadConfig({ LOG_LEVEL: "silent", DATA_DIR: dataDir }), port: 0 };
const app = await startServer(config);
process.once("exit", () => {
  rmSync(dataDir, { recursive: true, force: true });
});
installShutdownHandlers(app);

const sessions = ["one", "two"].map((id) => app.pty.createSession({ id }));
app.pty.write("two", `sleep ${sleepSeconds}\r`);
process.stdout.write(`${JSON.stringify({ pids: sessions.map((s) => s.pid) })}\n`);
