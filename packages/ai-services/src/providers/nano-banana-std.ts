/**
 * Nano Banana Standard image gen — Gemini 2.5 Flash Image.
 * Per ADR-001 + D27. Default image gen capability cho Standard tier.
 */

import { GeminiClient } from "../clients/gemini.ts";
import type { AIProvider, InvokeContext, InvokeResultBase } from "../types.ts";

interface NanoBananaInput {
  prompt: string;
  seed?: number;
}

interface NanoBananaOutput {
  imageBase64: string;
  mimeType: string;
  byteLength: number;
}

export function createNanoBananaStdProvider(opts: {
  apiKey: string;
}): AIProvider<NanoBananaInput, NanoBananaOutput> {
  const client = new GeminiClient({ apiKey: opts.apiKey });

  return {
    id: "nano-banana-std",
    capability: "image.generate",
    branding: {
      displayName: "Nano Banana Standard",
      vendor: "Google Gemini",
      vendorChannel: "gemini-api",
      description:
        "Gemini 2.5 Flash Image — fast image gen for Standard tier. Default cho Quick Create + Asset Studio.",
      seoSlug: "nano-banana-std",
    },
    availableInTiers: ["standard", "pro", "max"],
    quotas: {
      standard: { monthlyLimit: 200, unit: "images" },
      pro: { monthlyLimit: 1000, unit: "images" },
      max: { monthlyLimit: -1, unit: "images", softCap: true },
    },
    cost: {
      pricePerUnit: 0.039, // ~$0.039/image Gemini 2.5 Flash Image (rough est)
      unit: "image",
    },

    async healthCheck() {
      return client.ping();
    },

    async validateInput(input) {
      if (!input.prompt || input.prompt.trim().length === 0)
        return { valid: false, reason: "prompt required" };
      if (input.prompt.length > 4000)
        return { valid: false, reason: "prompt exceeds 4000 chars" };
      return { valid: true };
    },

    async invoke(
      input,
      _ctx: InvokeContext,
    ): Promise<InvokeResultBase & { output?: NanoBananaOutput }> {
      const result = await client.generateImage({
        prompt: input.prompt,
        model: "gemini-2.5-flash-image",
        seed: input.seed,
      });

      // Base64 → byte length estimate (3/4 ratio)
      const byteLength = Math.floor((result.imageBase64.length * 3) / 4);

      return {
        providerId: "nano-banana-std",
        costUsd: 0.039,
        durationMs: result.latencyMs,
        mode: "sync",
        output: {
          imageBase64: result.imageBase64,
          mimeType: result.mimeType,
          byteLength,
        },
      };
    },
  };
}
