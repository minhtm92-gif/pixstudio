import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    schema: {
      response: {
        200: z.object({
          status: z.literal("ok"),
          service: z.literal("pixstudio-api"),
          version: z.string(),
          uptime: z.number(),
          timestamp: z.string(),
        }),
      },
    },
    handler: async () => ({
      status: "ok" as const,
      service: "pixstudio-api" as const,
      version: process.env.APP_VERSION ?? "0.1.0",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }),
  });

  app.get("/ready", {
    schema: {
      response: {
        200: z.object({ ready: z.boolean(), checks: z.record(z.string(), z.boolean()) }),
        503: z.object({ ready: z.boolean(), checks: z.record(z.string(), z.boolean()) }),
      },
    },
    handler: async (_req, reply) => {
      const checks = {
        env: Boolean(process.env.DATABASE_URL),
      };
      const ready = Object.values(checks).every(Boolean);
      reply.status(ready ? 200 : 503);
      return { ready, checks };
    },
  });
};
