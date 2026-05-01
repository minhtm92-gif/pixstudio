import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { healthRoutes } from "./routes/health.js";
import { projectsRoutes } from "./routes/projects.js";
import { workspacesRoutes } from "./routes/workspaces.js";
import { assetsRoutes } from "./routes/assets.js";
import { aiRoutes } from "./routes/ai.js";
import aiMeshPlugin from "./plugins/ai-mesh.js";
import prismaPlugin from "./plugins/prisma.js";
import r2Plugin from "./plugins/r2.js";
import authPlugin from "./plugins/auth.js";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
    transport: process.env.NODE_ENV === "production" ? undefined : { target: "pino-pretty" },
  },
}).withTypeProvider<ZodTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

await app.register(cors, {
  origin: process.env.CORS_ORIGINS?.split(",") ?? ["http://localhost:3000"],
  credentials: true,
});

await app.register(helmet, {
  contentSecurityPolicy: false,
});

await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
});

await app.register(prismaPlugin);
await app.register(authPlugin);
await app.register(r2Plugin);
await app.register(aiMeshPlugin);
await app.register(healthRoutes, { prefix: "/health" });
await app.register(projectsRoutes, { prefix: "/api/projects" });
await app.register(workspacesRoutes, { prefix: "/api/workspaces" });
await app.register(assetsRoutes, { prefix: "/api/assets" });
await app.register(aiRoutes, { prefix: "/api/ai" });

const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`PixStudio API listening on http://${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
