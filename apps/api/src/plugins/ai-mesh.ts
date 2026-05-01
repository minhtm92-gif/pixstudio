/**
 * AI mesh Fastify plugin — bootstrap ProviderRegistry + CapabilityRouter from env secrets.
 * Per ADR-001 + ADR-002. Decorates Fastify instance with `aiRouter`.
 */

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { CapabilityRouter, ProviderRegistry } from "@pixstudio/ai-services";

declare module "fastify" {
  interface FastifyInstance {
    aiRouter: CapabilityRouter;
    aiRegistry: ProviderRegistry;
  }
}

const aiMeshImpl: FastifyPluginAsync = async (app: FastifyInstance) => {
  const registry = new ProviderRegistry({
    secrets: {
      BYTEPLUS_ACCESS_KEY: process.env.BYTEPLUS_ACCESS_KEY,
      BYTEPLUS_SECRET_KEY: process.env.BYTEPLUS_SECRET_KEY,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
      DO_INFERENCE_TOKEN: process.env.DO_INFERENCE_TOKEN,
      FAL_API_KEY: process.env.FAL_API_KEY,
      DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY,
    },
  });

  const router = new CapabilityRouter(registry);

  app.decorate("aiRegistry", registry);
  app.decorate("aiRouter", router);

  const providers = registry.listAll();
  app.log.info(
    `AI mesh ready: ${providers.length} providers (${providers.map((p) => p.id).join(", ")})`,
  );
};

export default fp(aiMeshImpl, { name: "ai-mesh" });
