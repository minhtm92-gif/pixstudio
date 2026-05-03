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
import { adminKpiRoutes } from "./routes/admin-kpi.js";
import { adminGpuRoutes } from "./routes/admin-gpu.js";
import { musicRoutes } from "./routes/music.js";
import { bugReportsRoutes, adminBugReportsRoutes } from "./routes/bug-reports.js";
import { assetsRoutes } from "./routes/assets.js";
import { aiRoutes } from "./routes/ai.js";
import { quickCreateRoutes } from "./routes/quick-create.js";
import { quickCreateHandoffRoutes } from "./routes/quick-create-handoff.js";
import { pathBRoutes } from "./routes/path-b.js";
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

// CORS allowlist: env CORS_ORIGINS (comma-separated) OR built-in production
// + dev defaults. Production URLs hardcoded as fallback so missing Doppler
// env doesn't silently block studio.pixelxlab.com origin.
const DEFAULT_CORS_ORIGINS = [
  "https://studio.pixelxlab.com",
  "https://pixstudio.vercel.app", // Vercel preview deployments
  "http://localhost:3000",
  "http://localhost:3001",
];
const corsAllowlist = apiEnv.CORS_ORIGINS
  ? [...new Set([...apiEnv.CORS_ORIGINS.split(",").map((s) => s.trim()), ...DEFAULT_CORS_ORIGINS])]
  : DEFAULT_CORS_ORIGINS;

await app.register(cors, {
  origin: (origin, cb) => {
    // No origin (same-origin / curl / mobile app) — allow.
    if (!origin) return cb(null, true);
    if (corsAllowlist.includes(origin)) return cb(null, true);
    // Vercel preview deployments: pixstudio-git-<branch>-<hash>.vercel.app
    if (/^https:\/\/pixstudio[a-z0-9-]*\.vercel\.app$/.test(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`), false);
  },
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
await app.register(adminKpiRoutes, { prefix: "/api/admin" });
await app.register(adminGpuRoutes, { prefix: "/api/admin" });
await app.register(musicRoutes, { prefix: "/api/music" });
await app.register(bugReportsRoutes, { prefix: "/api/bug-reports" });
await app.register(adminBugReportsRoutes, { prefix: "/api/admin" });
await app.register(assetsRoutes, { prefix: "/api/assets" });
await app.register(aiRoutes, { prefix: "/api/ai" });
await app.register(quickCreateRoutes, { prefix: "/api/quick-create" });
await app.register(quickCreateHandoffRoutes, { prefix: "/api/quick-create" });
await app.register(pathBRoutes, { prefix: "/api/path-b" });
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
