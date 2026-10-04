import {
  ActivityStore,
  ActivityPublisher,
  registerActivityRoutes,
  registerActivityGateway,
} from "./activity/index.js";
import { recordRouterActivity, observeActivity } from "./activity/domain-events.js";
import { TaskRegistry, registerTaskRoutes } from "./tasks/index.js";
import { MessageRouter } from "./router/index.js";
import { MailboxManager } from "./mailbox/index.js";
import Fastify, { type FastifyInstance } from "fastify";
import type { ServerConfig } from "./config/env.js";
import { AgentWorkspaceManager } from "./workspaces/agent-workspace-manager.js";
import { join } from "node:path";
import { AgentRegistry, AgentRuntimeManager } from "./agents/index.js";
import { registerCors } from "./plugins/cors.js";
import { registerErrorHandling } from "./plugins/errors.js";
import { PtyManager } from "./pty/index.js";
import { registerAgentRoutes } from "./routes/agents.js";
import { registerHealthRoutes } from "./routes/health.js";
import { SERVER_VERSION } from "./version.js";
import { registerTerminalGateway } from "./websocket/terminal-gateway.js";

declare module "fastify" {
  interface FastifyInstance {
    /** Owns all PTY processes; terminated when the app closes. */
    pty: PtyManager;
    /** Known agents and their server-owned lifecycle state. */
    agents: AgentRegistry;
    /** Agents' live shells (one PTY per running agent). */
    runtime: AgentRuntimeManager;
    workspaces: AgentWorkspaceManager;
    mailbox: MailboxManager;
    router: MessageRouter;
    tasks: TaskRegistry;
    activity: ActivityPublisher;
  }
}

export interface CreateAppOptions {
  /** Defaults to a logger at config.logLevel; pass false in tests. */
  logger?: boolean;
  /** Inject a manager (tests) admitting temporary cwd roots; otherwise roots come from config. */
  ptyManager?: PtyManager;
  /** Inject a registry (tests); otherwise <dataDir>/agents.json is opened. */
  agentRegistry?: AgentRegistry;
}

/** Builds the Fastify app without listening, so it can be exercised with app.inject(). */
export async function createApp(
  config: ServerConfig,
  options: CreateAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger === false ? false : { level: config.logLevel },
  });

  const agentRegistry =
    options.agentRegistry ??
    (await AgentRegistry.open({
      file: join(config.dataDir, "agents.json"),
      logger: app.log.child({ component: "agents" }),
    }));
  app.decorate("agents", agentRegistry);
  const tasks = await TaskRegistry.open({
    file: join(config.dataDir, "tasks.json"),
    registry: agentRegistry,
    logger: app.log.child({ component: "tasks" }),
  });
  app.decorate("tasks", tasks);

  const workspaces = await AgentWorkspaceManager.open(
    config.dataDir,
    app.log.child({ component: "workspaces" }),
  );
  // Fail closed on migration errors; preserve metadata and never auto-start processes.
  for (const agent of agentRegistry.list()) {
    try {
      await workspaces.ensureWorkspace(agent);
    } catch (error) {
      app.log.error(
        { agentId: agent.id, err: error },
        "Agent workspace migration failed; refusing startup",
      );
      throw error;
    }
  }
  app.decorate("workspaces", workspaces);
  app.decorate("mailbox", new MailboxManager({ workspaces, registry: agentRegistry }));

  const activity = new ActivityPublisher(
    await ActivityStore.open(join(config.dataDir, "events.jsonl"), app.log),
    app.log,
  );
  app.decorate("activity", activity);
  const subscriptions = observeActivity(activity, agentRegistry, tasks);
  const router = new MessageRouter({
    onEvent: (event) => recordRouterActivity(activity, event),
    registry: agentRegistry,
    workspaces,
    mailbox: app.mailbox,
    logger: app.log.child({ component: "message-router" }),
    onFatal: () => {
      void app.close().catch(() => {
        app.log.error({ errorCode: "ROUTER_SHUTDOWN_FAILED" }, "Router shutdown failed");
      });
    },
  });
  app.decorate("router", router);
  app.addHook("onReady", () => router.start());

  const ptyManager =
    options.ptyManager ??
    new PtyManager({
      workspaceRoot: config.workspaceRoot,
      additionalWorkspaceRoots: [workspaces.agentsRoot],
      logger: app.log.child({ component: "pty" }),
    });
  app.decorate("pty", ptyManager);

  const runtime = new AgentRuntimeManager({
    registry: agentRegistry,
    workspaces,
    pty: ptyManager,
    allowFakeProvider: !config.isProduction,
    onRestart: (agent) => {
      void activity.publish({
        type: "agent.restarted",
        entity: { type: "agent", id: agent.id },
        metadata: { agentName: agent.name },
        actor: { type: "user" },
      });
    },
    deleteAgent: (id) => tasks.deleteAgent(id),
    logger: app.log.child({ component: "agent-runtime" }),
  });
  app.decorate("runtime", runtime);

  // Runs on app.close(): drain routing first, then agents, so
  // their stops are recorded as "stopped"; then every PTY left (scratch terminals, and
  // anything an agent stop could not finish) through the same process-tree cleanup.
  app.addHook("onClose", async () => {
    try {
      await router.stop();
    } finally {
      try {
        await runtime.stopAll();
      } finally {
        try {
          await ptyManager.terminateAll();
        } finally {
          for (const subscription of subscriptions) subscription.dispose();
          await activity.close();
        }
      }
    }
  });

  registerErrorHandling(app);
  await registerCors(app, config.webOrigins);
  registerHealthRoutes(app, SERVER_VERSION);
  registerAgentRoutes(app, agentRegistry, runtime);
  registerTaskRoutes(app, tasks);
  registerActivityRoutes(app, activity);
  await registerTerminalGateway(app, {
    pty: ptyManager,
    runtime,
    allowedOrigins: config.webOrigins,
  });

  registerActivityGateway(app, activity, config.webOrigins);
  return app;
}
