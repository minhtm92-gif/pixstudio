/**
 * AI mesh REST endpoints — wire @pixstudio/ai-services router into Fastify.
 * Per ADR-001 plug-in interface. Per Sprint 1 Phase 0/1 wedge.
 *
 * Phase 0: stub-friendly endpoints. Sprint 1: add auth middleware + workspace
 * quota tracking + R2 upload integration.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

const TierSchema = z.enum(["standard", "pro", "max"]);
const RegionSchema = z.enum(["vn-sg", "eu", "us"]).default("vn-sg");

/** Build invoke context from request — Phase 0 stub uses query/body, Sprint 1 adds auth session */
function buildCtx(input: {
  workspaceId?: string;
  userId?: string;
  tier?: z.infer<typeof TierSchema>;
  region?: z.infer<typeof RegionSchema>;
  traceId?: string;
}) {
  return {
    workspaceId: input.workspaceId ?? "ws-anonymous",
    userId: input.userId ?? "u-anonymous",
    tier: input.tier ?? "pro",
    region: input.region ?? "vn-sg",
    traceId: input.traceId ?? `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

const BaseInvokeContext = z.object({
  workspaceId: z.string().optional(),
  userId: z.string().optional(),
  tier: TierSchema.optional(),
  region: RegionSchema.optional(),
  traceId: z.string().optional(),
});

export const aiRoutes: FastifyPluginAsyncZod = async (app) => {
  // === GET /api/ai/providers — list all registered providers ===
  app.get("/providers", {
    schema: {
      response: {
        200: z.object({
          providers: z.array(
            z.object({
              id: z.string(),
              capability: z.string(),
              vendor: z.string(),
              displayName: z.string(),
              isPriorityChannel: z.boolean().optional(),
              availableInTiers: z.array(TierSchema),
            }),
          ),
        }),
      },
    },
    handler: async () => {
      const providers = app.aiRegistry.listAll().map((p) => ({
        id: p.id,
        capability: p.capability,
        vendor: p.branding.vendor,
        displayName: p.branding.displayName,
        isPriorityChannel: p.branding.isPriorityChannel,
        availableInTiers: p.availableInTiers,
      }));
      return { providers };
    },
  });

  // === POST /api/ai/chat — llm.chat ===
  app.post("/chat", {
    schema: {
      body: BaseInvokeContext.extend({
        prompt: z.string().min(1),
        systemInstruction: z.string().optional(),
        model: z.string().optional(),
        temperature: z.number().min(0).max(2).optional(),
        maxTokens: z.number().int().positive().optional(),
      }),
      response: {
        200: z.object({
          providerId: z.string(),
          text: z.string(),
          costUsd: z.number(),
          durationMs: z.number(),
          usage: z
            .object({
              promptTokens: z.number(),
              outputTokens: z.number(),
              totalTokens: z.number().optional(),
            })
            .optional(),
        }),
      },
    },
    handler: async (req) => {
      const ctx = buildCtx(req.body);
      const { result } = await app.aiRouter.invoke<any, any>(
        "llm.chat",
        {
          prompt: req.body.prompt,
          systemInstruction: req.body.systemInstruction,
          model: req.body.model,
          temperature: req.body.temperature,
          maxTokens: req.body.maxTokens,
        },
        ctx,
      );
      return {
        providerId: result.providerId,
        text: result.output?.text ?? "",
        costUsd: result.costUsd,
        durationMs: result.durationMs,
        usage: result.output?.usage,
      };
    },
  });

  // === POST /api/ai/image — image.generate ===
  app.post("/image", {
    schema: {
      body: BaseInvokeContext.extend({
        prompt: z.string().min(1),
        seed: z.number().int().optional(),
      }),
      response: {
        200: z.object({
          providerId: z.string(),
          imageBase64: z.string(),
          mimeType: z.string(),
          byteLength: z.number(),
          costUsd: z.number(),
          durationMs: z.number(),
        }),
      },
    },
    handler: async (req) => {
      const ctx = buildCtx(req.body);
      const { result } = await app.aiRouter.invoke<any, any>(
        "image.generate",
        { prompt: req.body.prompt, seed: req.body.seed },
        ctx,
      );
      return {
        providerId: result.providerId,
        imageBase64: result.output?.imageBase64 ?? "",
        mimeType: result.output?.mimeType ?? "image/png",
        byteLength: result.output?.byteLength ?? 0,
        costUsd: result.costUsd,
        durationMs: result.durationMs,
      };
    },
  });

  // === POST /api/ai/tts — tts.synthesize (returns audio bytes) ===
  app.post("/tts", {
    schema: {
      body: BaseInvokeContext.extend({
        text: z.string().min(1).max(5000),
        voiceId: z.string(),
        modelId: z.string().optional(),
        outputFormat: z.enum(["mp3_44100_128", "mp3_44100_192", "pcm_44100"]).optional(),
      }),
    },
    handler: async (req, reply) => {
      const ctx = buildCtx(req.body);
      const { result } = await app.aiRouter.invoke<any, any>(
        "tts.synthesize",
        {
          text: req.body.text,
          voiceId: req.body.voiceId,
          modelId: req.body.modelId,
          outputFormat: req.body.outputFormat,
        },
        ctx,
      );
      reply
        .header("Content-Type", "audio/mpeg")
        .header("X-PXS-Provider", result.providerId)
        .header("X-PXS-Cost-Usd", String(result.costUsd))
        .header("X-PXS-Duration-Ms", String(result.durationMs));
      return Buffer.from(result.output?.audioBytes as ArrayBuffer);
    },
  });

  // === POST /api/ai/video/i2v — video.imageToVideo (async) ===
  app.post("/video/i2v", {
    schema: {
      body: BaseInvokeContext.extend({
        prompt: z.string().min(1),
        imageUrl: z.string().url().optional(),
        durationSec: z.number().int().min(3).max(10).optional(),
        aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:3", "3:4"]).optional(),
      }),
      response: {
        200: z.object({
          providerId: z.string(),
          jobId: z.string().optional(),
          mode: z.enum(["sync", "async"]),
          costUsd: z.number(),
          durationMs: z.number(),
          output: z.unknown().optional(),
        }),
      },
    },
    handler: async (req) => {
      const ctx = buildCtx(req.body);
      const { result } = await app.aiRouter.invoke<any, any>(
        "video.imageToVideo",
        req.body,
        ctx,
      );
      return {
        providerId: result.providerId,
        jobId: result.jobId,
        mode: result.mode,
        costUsd: result.costUsd,
        durationMs: result.durationMs,
        output: result.output,
      };
    },
  });

  // === POST /api/ai/video/poll — Poll Seedance/Kling task status (S18) ===
  // Body: { taskId, provider: "seedance-2-0" | "kling-3-0" }
  // Returns: { status, videoUrl?, durationSec?, error? }
  app.post("/video/poll", {
    schema: {
      body: z.object({
        taskId: z.string(),
        provider: z.enum(["seedance-2-0", "kling-3-0"]).default("seedance-2-0"),
      }),
    },
    handler: async (req, reply) => {
      // For Seedance: directly use ByteplusClient.pollSeedance via env keys.
      // Kling: use FalClient.pollKling (not exposed yet — Phase 3).
      if (req.body.provider !== "seedance-2-0") {
        reply.code(501);
        return { error: "Only Seedance polling supported in S18" };
      }
      const accessKey = process.env["BYTEPLUS_ACCESS_KEY"];
      const secretKey = process.env["BYTEPLUS_SECRET_KEY"];
      if (!accessKey || !secretKey) {
        reply.code(503);
        return { error: "BYTEPLUS_ACCESS_KEY / BYTEPLUS_SECRET_KEY not configured" };
      }
      const { ByteplusClient } = await import("@pixstudio/ai-services");
      const client = new ByteplusClient({ accessKey, secretKey });
      try {
        const result = await client.pollSeedance(req.body.taskId);
        return result;
      } catch (err) {
        req.log.error({ err: err instanceof Error ? err.message : String(err) }, "Seedance poll failed");
        reply.code(502);
        return { error: err instanceof Error ? err.message : "Poll failed" };
      }
    },
  });

  // === POST /api/ai/video/t2v — video.textToVideo (async) ===
  app.post("/video/t2v", {
    schema: {
      body: BaseInvokeContext.extend({
        prompt: z.string().min(1),
        durationSec: z.union([z.literal(5), z.literal(8)]).optional(),
        aspectRatio: z.enum(["16:9", "9:16"]).optional(),
        negativePrompt: z.string().optional(),
      }),
    },
    handler: async (req) => {
      const ctx = buildCtx(req.body);
      const { result } = await app.aiRouter.invoke<any, any>(
        "video.textToVideo",
        req.body,
        ctx,
      );
      return {
        providerId: result.providerId,
        jobId: result.jobId,
        mode: result.mode,
        costUsd: result.costUsd,
        durationMs: result.durationMs,
        output: result.output,
      };
    },
  });
};
