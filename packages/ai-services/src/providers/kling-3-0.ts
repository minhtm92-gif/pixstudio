/**
 * Kling 3.0 video gen provider via fal.ai.
 * Per ADR-001 + D27: transition vendor (creator opt-in only ~10min/mo cap).
 * Used cho video.imageToVideo (Pro tier transition role).
 */

import { FalClient } from "../clients/fal.ts";
import type { AIProvider, InvokeContext, InvokeResultBase } from "../types.ts";

interface KlingI2VInput {
  prompt: string;
  imageUrl?: string;
  /** "v1.5/standard" (default) | "v1.5/pro" | "v2/master" */
  variant?: "v1.5/standard" | "v1.5/pro" | "v2/master";
  duration?: 5 | 10;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  cfgScale?: number;
  negativePrompt?: string;
}

interface KlingI2VOutput {
  requestId: string;
  statusUrl: string;
  /** Mode async — actual video URL delivered via webhook hoặc poll */
  mode: "async";
}

export function createKling30Provider(opts: {
  apiKey: string;
}): AIProvider<KlingI2VInput, KlingI2VOutput> {
  const client = new FalClient({ apiKey: opts.apiKey });

  return {
    id: "kling-3-0",
    capability: "video.imageToVideo",
    branding: {
      displayName: "Kling 3.0 (transition)",
      vendor: "fal.ai",
      vendorChannel: "fal-ai",
      description:
        "Kling video gen — transition vendor opt-in cap ~10min/mo Pro tier (per D27). Default I2V = Seedance 2.0.",
      seoSlug: "kling-3-0",
    },
    availableInTiers: ["pro", "max"],
    quotas: {
      pro: { monthlyLimit: 10, unit: "minutes" }, // transition opt-in cap per D27
      max: { monthlyLimit: 30, unit: "minutes" },
    },
    cost: {
      pricePerUnit: 0.35, // ~$0.35/sec Kling 1.5 standard
      unit: "second",
    },

    async healthCheck() {
      return client.ping();
    },

    async validateInput(input) {
      if (!input.prompt || input.prompt.trim().length === 0)
        return { valid: false, reason: "prompt required" };
      if (input.duration !== undefined && ![5, 10].includes(input.duration))
        return { valid: false, reason: "duration must be 5 or 10" };
      return { valid: true };
    },

    async invoke(
      input,
      ctx: InvokeContext,
    ): Promise<InvokeResultBase & { output?: KlingI2VOutput }> {
      const submitResult = await client.submitKling({
        variant: input.variant ?? "v1.5/standard",
        mode: input.imageUrl ? "image-to-video" : "text-to-video",
        prompt: input.prompt,
        imageUrl: input.imageUrl,
        duration: input.duration,
        aspectRatio: input.aspectRatio,
        cfgScale: input.cfgScale,
        negativePrompt: input.negativePrompt,
      });

      const durationSec = input.duration ?? 5;

      return {
        providerId: "kling-3-0",
        costUsd: durationSec * 0.35,
        durationMs: submitResult.latencyMs,
        mode: "async",
        jobId: submitResult.requestId,
        output: {
          requestId: submitResult.requestId,
          statusUrl: submitResult.statusUrl,
          mode: "async",
        },
      };
    },
  };
}
