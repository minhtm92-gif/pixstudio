import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { apiEnv } from "./env.js";
import { healthRoutes } from "./routes/health.js";
import { projectsRoutes } from "./routes/projects.js";
import { workspacesRoutes } from "./routes/workspaces.js";
import { brandKitRoutes } from "./routes/brand-kit.js";
import { onboardingRoutes } from "./routes/onboarding.js";
import { adminStockRoutes } from "./routes/admin-stock.js";
import { assetsRoutes } from "./routes/assets.js";
import { aiRoutes } from "./routes/ai.js";
import { quickCreateRoutes } from "./routes/quick-create.js";
import { voicesRoutes } from "./routes/voices.js";
import aiMeshPlugin from "./plugins/ai-mesh.js";
import prismaPlugin from "./plugins/prisma.js";
import r2Plugin from "./plugins/r2.js";
import authPlugin from "./plugins/auth.js";
import requireAuthPlugin from "./plugins/require-auth.js";
import queuePlugin from "./plugins/queue.js";

const app = Fastify({
  genReqId: () => crypto.randomUUID(),
  logger: {
    level: apiEnv.LOG_LEVEL,
    transport: apiEnv.NODE_ENV === "production" ? undefined : { target: "pino-pretty" },
  },
}).withTypeProvider<ZodTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

await app.register(cors, {
  origin: apiEnv.CORS_ORIGINS?.split(",") ?? ["http://localhost:3000"],
  credentials: true,
  maxAge: 86400, // 24h preflight cache (audit H5)
});

await app.register(helmet, {
  contentSecurityPolicy: false,
});

await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
});

// WebSocket support — required by Quick Create build event stream (audit H7)
await app.register(websocket);

await app.register(prismaPlugin);
await app.register(authPlugin);
await app.register(requireAuthPlugin);
await app.register(r2Plugin);
await app.register(aiMeshPlugin);
await app.register(queuePlugin);
await app.register(healthRoutes, { prefix: "/health" });
await app.register(projectsRoutes, { prefix: "/api/projects" });
await app.register(workspacesRoutes, { prefix: "/api/workspaces" });
await app.register(brandKitRoutes, { prefix: "/api/workspaces" });
await app.register(onboardingRoutes, { prefix: "/api/onboarding" });
await app.register(adminStockRoutes, { prefix: "/api/admin" });
await app.register(assetsRoutes, { prefix: "/api/assets" });
await app.register(aiRoutes, { prefix: "/api/ai" });
await app.register(quickCreateRoutes, { prefix: "/api/quick-create" });
await app.register(voicesRoutes, { prefix: "/api/voices" });

const PORT = apiEnv.PORT;
const HOST = apiEnv.HOST;

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`PixStudio API listening on http://${HOST}:${PORT}`);
  // Start BullMQ worker (in-process Sprint 2.5; dedicate worker process Sprint 4+)
  if (typeof app.startQuickCreateBuildWorker === "function") {
    app.startQuickCreateBuildWorker();
    app.log.info("BullMQ worker started: quick-create-build");
  }
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
