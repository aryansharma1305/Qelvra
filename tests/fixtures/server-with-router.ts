import { createApp } from "../../apps/server/src/app";
import { loadConfig } from "../../apps/server/src/config/env";
import { installShutdownHandlers } from "../../apps/server/src/server";

const dataDir = process.env.QELVRA_ROUTER_TEST_DATA;
if (!dataDir) throw new Error("Disposable DATA_DIR required");
const app = await createApp(
  { ...loadConfig({ DATA_DIR: dataDir, WORKSPACE_ROOT: dataDir, LOG_LEVEL: "silent" }), port: 0 },
  { logger: false },
);
for (const id of ["nova", "atlas"])
  await app.runtime.create({ id, name: id, role: "Signal fixture" });
const stop = app.router.stop.bind(app.router);
app.router.stop = async () => {
  await stop();
  process.stdout.write(
    `${JSON.stringify({ routerStopped: !app.router.isRunning(), inFlight: app.router.status().inFlight })}\n`,
  );
};
const deliver = app.mailbox.deliverInboxMessage.bind(app.mailbox);
app.mailbox.deliverInboxMessage = async (...args) => {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return deliver(...args);
};
installShutdownHandlers(app);
await app.listen({ host: "127.0.0.1", port: 0 });
const messages = await Promise.all(
  Array.from({ length: 10 }, (_, i) =>
    app.mailbox.writeOutboxMessage("nova", { to: "atlas", type: "message", body: `signal ${i}` }),
  ),
);
process.stdout.write(
  `${JSON.stringify({ ready: true, ids: messages.map((message) => message.id) })}\n`,
);
