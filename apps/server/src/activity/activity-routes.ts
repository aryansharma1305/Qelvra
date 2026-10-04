import { z } from "zod";
import { ActivityIdSchema, ActivityTypeSchema, AgentIdSchema, TaskIdSchema } from "@qelvra/shared";
import type { FastifyInstance } from "fastify";
import { AppError } from "../lib/errors.js";
import type { ActivityPublisher } from "./activity-publisher.js";
const Query = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: ActivityIdSchema.optional(),
  type: ActivityTypeSchema.optional(),
  agentId: AgentIdSchema.optional(),
  taskId: TaskIdSchema.optional(),
  entityType: z.enum(["agent", "task", "message", "router"]).optional(),
});
export function registerActivityRoutes(app: FastifyInstance, activity: ActivityPublisher) {
  app.get("/api/activity/summary", async () => {
    await activity.flush();
    const day = new Date().toISOString().slice(0, 10);
    const tasks = app.tasks.list();
    return {
      activeAgents: app.runtime.size,
      completedToday: tasks.filter(
        (task) => task.status === "completed" && task.updatedAt.startsWith(day),
      ).length,
      workingTasks: tasks.filter((task) => task.status === "working").length,
      recordedDeliveriesToday: activity.store.deliveredToday(day),
    };
  });
  app.get("/api/activity", async (request) => {
    const query = Query.safeParse(request.query);
    if (!query.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid activity query");
    await activity.flush();
    return { ...activity.store.listEvents(query.data), status: activity.status() };
  });
}
