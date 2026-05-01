/**
 * Seedance 2.0 provider (Byteplus đối tác chiến lược ⭐).
 * Capability: video.imageToVideo (primary), video.textToVideo (default).
 * Per ADR-001 §3 + D27 locked AI mesh.
 */

import { BaseClient } from "../clients/_base.ts";
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
}

export function createSeedance20Provider(opts: {
  accessKey: string;
  secretKey: string;
}): AIProvider<SeedanceI2VInput, SeedanceI2VOutput> {
  const client = new BaseClient({
    baseUrl: "https://open.byteplusapi.com",
    timeout: 60000,
    maxRetries: 2,
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
      const start = Date.now();
      try {
        await client.request("/api/v1/contents/generations/health", { method: "GET" });
        return { healthy: true, latencyMs: Date.now() - start };
      } catch (err) {
        return {
          healthy: false,
          latencyMs: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },

    async validateInput(input) {
      if (!input.imageUrl) return { valid: false, reason: "imageUrl required" };
      if (![3, 5, 8].includes(input.durationSec))
        return { valid: false, reason: "durationSec must be 3, 5, or 8" };
      return { valid: true };
    },

    async invoke(input, ctx): Promise<InvokeResultBase & { output?: SeedanceI2VOutput }> {
      const start = Date.now();

      // TODO Sprint 1+: implement actual Byteplus signed request (HMAC-SHA256 v4 signature)
      // Phase 0 stub returns mock URL for plug-in interface validation
      const stub: SeedanceI2VOutput = {
        videoUrl: `https://stub.pxs.local/seedance/${ctx.traceId}.mp4`,
        thumbnailUrl: `https://stub.pxs.local/seedance/${ctx.traceId}-thumb.jpg`,
        durationSec: input.durationSec,
        fileSizeBytes: input.durationSec * 8_000_000, // ~8 MB/s rough
      };

      return {
        providerId: "seedance-2-0",
        costUsd: input.durationSec * 0.08,
        durationMs: Date.now() - start,
        mode: "async",
        jobId: ctx.traceId,
        output: stub,
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
