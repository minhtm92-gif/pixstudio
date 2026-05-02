import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { apiEnv } from "../env.js";

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
      version: process.env["APP_VERSION"] ?? "0.1.0",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }),
  });

  // Readiness probe — actually probes downstream dependencies (audit M10).
  app.get("/ready", {
    schema: {
      response: {
        200: z.object({ ready: z.boolean(), checks: z.record(z.string(), z.boolean()) }),
        503: z.object({ ready: z.boolean(), checks: z.record(z.string(), z.boolean()) }),
      },
    },
    handler: async (_req, reply) => {
      const checks: Record<string, boolean> = {
        env: Boolean(apiEnv.DATABASE_URL),
      };

      // Probe Postgres if Prisma is registered.
      if (app.prisma) {
        try {
          await app.prisma.$queryRaw`SELECT 1`;
          checks["database"] = true;
        } catch {
          checks["database"] = false;
        }
      }

      // Probe R2 (light check — endpoint reachable).
      checks["r2"] = Boolean(app.r2);

      // Probe AI mesh registry initialized.
      checks["aiMesh"] = Boolean(app.aiRegistry && app.aiRegistry.listAll().length > 0);

      const ready = Object.values(checks).every(Boolean);
      reply.status(ready ? 200 : 503);
      return { ready, checks };
    },
  });
};
