/**
 * Seedance 2.0 provider (Byteplus đối tác chiến lược ⭐).
 * Capability: video.imageToVideo (primary), video.textToVideo (default).
 * Per ADR-001 §3 + D27 locked AI mesh.
 */

import { ByteplusClient } from "../clients/byteplus.ts";
import type { AIProvider, InvokeContext, InvokeResultBase } from "../types.ts";

interface SeedanceI2VInput {
  imageUrl: string;
  prompt?: string;
  durationSec: 3 | 5 | 8;
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  /** Optional reference style image */
  styleRefUrl?: string;
}

interface SeedanceI2VOutput {
  videoUrl: string;
  thumbnailUrl: string;
  durationSec: number;
  fileSizeBytes: number;
  taskId?: string;
}

export function createSeedance20Provider(opts: {
  accessKey: string;
  secretKey: string;
}): AIProvider<SeedanceI2VInput, SeedanceI2VOutput> {
  const client = new ByteplusClient({
    accessKey: opts.accessKey,
    secretKey: opts.secretKey,
  });

  return {
    id: "seedance-2-0",
    capability: "video.imageToVideo",
    branding: {
      displayName: "Seedance 2.0",
      vendor: "Byteplus",
      vendorChannel: "byteplus",
      isPriorityChannel: true,
      description: "PXL đối tác chiến lược ⭐. Image-to-video + text-to-video, quality match Veo at fraction cost.",
      seoSlug: "seedance-2-0",
    },
    availableInTiers: ["pro", "max"],
    quotas: {
      pro: { monthlyLimit: 30, unit: "minutes" },
      max: { monthlyLimit: 120, unit: "minutes", softCap: true },
    },
    cost: {
      pricePerUnit: 0.08,
      unit: "second",
    },

    async healthCheck() {
      // Byteplus has no public health endpoint — assume healthy when client constructed.
      return { healthy: true, latencyMs: 0 };
    },

    async validateInput(input) {
      if (!input.imageUrl) return { valid: false, reason: "imageUrl required" };
      if (![3, 5, 8].includes(input.durationSec))
        return { valid: false, reason: "durationSec must be 3, 5, or 8" };
      return { valid: true };
    },

    async invoke(input, ctx): Promise<InvokeResultBase & { output?: SeedanceI2VOutput }> {
      const start = Date.now();

      // S18: real Byteplus HMAC v4 signed submit. Returns task_id immediately.
      // Caller (route handler / build pipeline) polls via parseWebhook OR the
      // dedicated POST /api/ai/video/i2v/poll endpoint.
      const submitted = await client.submitSeedance({
        mode: "i2v",
        prompt: input.prompt ?? "Cinematic, smooth motion, professional grade",
        imageUrl: input.imageUrl,
        durationSec: input.durationSec as 3 | 5 | 8,
        aspectRatio: input.aspectRatio,
      });

      return {
        providerId: "seedance-2-0",
        costUsd: input.durationSec * 0.08,
        durationMs: Date.now() - start,
        mode: "async",
        jobId: submitted.taskId,
        output: {
          videoUrl: "",
          thumbnailUrl: "",
          durationSec: input.durationSec,
          fileSizeBytes: 0,
          taskId: submitted.taskId,
        },
      };
    },

    async parseWebhook(req) {
      // TODO: verify Byteplus webhook signature header X-Byteplus-Signature
      const body = req.body as { jobId?: string; videoUrl?: string; thumbnailUrl?: string; durationSec?: number };
      if (!body.jobId || !body.videoUrl) return null;
      return {
        jobId: body.jobId,
        output: {
          videoUrl: body.videoUrl,
          thumbnailUrl: body.thumbnailUrl ?? "",
          durationSec: body.durationSec ?? 5,
          fileSizeBytes: 0,
        },
        costUsd: (body.durationSec ?? 5) * 0.08,
      };
    },
  };
}
