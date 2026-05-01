/**
 * Veo 3 text-to-video provider via Gemini API direct.
 * Per ADR-001 + D27: premium T2V Max tier.
 * Veo 3 = async (long-running operation), poll until complete.
 */

import { BaseClient } from "../clients/_base.ts";
import type { AIProvider, InvokeContext, InvokeResultBase } from "../types.ts";

interface Veo3Input {
  prompt: string;
  /** Default `veo-3.0-fast-generate-001`; alt `veo-3.0-generate-preview` (higher quality) */
  model?: string;
  durationSec?: 5 | 8;
  aspectRatio?: "16:9" | "9:16";
  /** Optional reference image for image-to-video mode */
  imageUrl?: string;
  /** Optional negative prompt */
  negativePrompt?: string;
}

interface Veo3Output {
  /** Long-running operation ID — poll via /v1beta/{name} */
  operationName: string;
  mode: "async";
}

export function createVeo3Provider(opts: {
  apiKey: string;
}): AIProvider<Veo3Input, Veo3Output> {
  const client = new BaseClient({
    baseUrl: "https://generativelanguage.googleapis.com",
    timeout: 60000,
    maxRetries: 2,
  });

  return {
    id: "veo-3",
    capability: "video.textToVideo",
    branding: {
      displayName: "Veo 3 (Premium)",
      vendor: "Google Gemini",
      vendorChannel: "gemini-api",
      description:
        "Veo 3 best-in-class text-to-video — Max tier only (per D27). Async operation, poll for completion.",
      seoSlug: "veo-3",
    },
    availableInTiers: ["max"],
    quotas: {
      max: { monthlyLimit: 30, unit: "minutes" },
    },
    cost: {
      pricePerUnit: 0.5, // ~$0.50/sec Veo 3 (premium tier)
      unit: "second",
    },

    async healthCheck() {
      const start = Date.now();
      try {
        await client.request(`/v1beta/models?key=${opts.apiKey}`, { method: "GET" });
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
      if (!input.prompt || input.prompt.trim().length === 0)
        return { valid: false, reason: "prompt required" };
      if (input.durationSec !== undefined && ![5, 8].includes(input.durationSec))
        return { valid: false, reason: "durationSec must be 5 or 8" };
      return { valid: true };
    },

    async invoke(
      input,
      _ctx: InvokeContext,
    ): Promise<InvokeResultBase & { output?: Veo3Output }> {
      const start = Date.now();
      const model = input.model ?? "veo-3.0-fast-generate-001";

      const body: Record<string, unknown> = {
        instances: [{ prompt: input.prompt }],
        parameters: {
          aspectRatio: input.aspectRatio ?? "16:9",
          durationSeconds: input.durationSec ?? 5,
          ...(input.negativePrompt ? { negativePrompt: input.negativePrompt } : {}),
        },
      };

      if (input.imageUrl) {
        (body.instances as any[])[0].image = { gcsUri: input.imageUrl };
      }

      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning?key=${opts.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!resp.ok) {
        const errBody = await resp.text();
        throw new Error(`Veo 3 ${resp.status}: ${errBody.slice(0, 300)}`);
      }

      const data = (await resp.json()) as { name?: string };
      const operationName = data.name ?? "unknown";
      const durationSec = input.durationSec ?? 5;

      return {
        providerId: "veo-3",
        costUsd: durationSec * 0.5,
        durationMs: Date.now() - start,
        mode: "async",
        jobId: operationName,
        output: {
          operationName,
          mode: "async",
        },
      };
    },
  };
}
