/**
 * Gemini LLM provider — llm.chat capability.
 * Used cho script gen + brainstorm + multimodal video understanding (Path B).
 * Per ADR-001 + D27. Note: ADR-002 prefers DO Inference Engine for production LLM,
 * Gemini direct = secondary fallback (per D40) + multimodal-only use cases.
 */

import { GeminiClient } from "../clients/gemini.ts";
import type { AIProvider, InvokeContext, InvokeResultBase } from "../types.ts";

interface GeminiLLMInput {
  prompt: string;
  systemInstruction?: string;
  /** "gemini-2.5-flash" (default) | "gemini-2.5-pro" (multimodal video understanding) */
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

interface GeminiLLMOutput {
  text: string;
  usage?: { promptTokens: number; outputTokens: number };
}

export function createGeminiLLMProvider(opts: {
  apiKey: string;
}): AIProvider<GeminiLLMInput, GeminiLLMOutput> {
  const client = new GeminiClient({ apiKey: opts.apiKey });

  return {
    id: "gemini-llm",
    capability: "llm.chat",
    branding: {
      displayName: "Gemini 2.5 Flash/Pro",
      vendor: "Google Gemini",
      vendorChannel: "gemini-api",
      description:
        "Gemini chat completion (Flash + Pro). Pro variant cho Path B multimodal video understanding.",
      seoSlug: "gemini-llm",
    },
    availableInTiers: ["standard", "pro", "max"],
    quotas: {
      standard: { monthlyLimit: 100, unit: "requests" },
      pro: { monthlyLimit: 1000, unit: "requests" },
      max: { monthlyLimit: -1, unit: "requests", softCap: true },
    },
    cost: {
      pricePerUnit: 0.00000015, // Gemini 2.5 Flash input ~$0.15/1M tokens
      unit: "input_token",
    },

    async healthCheck() {
      return client.ping();
    },

    async validateInput(input) {
      if (!input.prompt || input.prompt.trim().length === 0)
        return { valid: false, reason: "prompt required" };
      return { valid: true };
    },

    async invoke(
      input,
      _ctx: InvokeContext,
    ): Promise<InvokeResultBase & { output?: GeminiLLMOutput }> {
      const result = await client.chat({
        prompt: input.prompt,
        systemInstruction: input.systemInstruction,
        model: input.model,
        temperature: input.temperature,
        maxOutputTokens: input.maxOutputTokens,
      });

      const inputTokens = result.usage?.promptTokens ?? 0;
      const outputTokens = result.usage?.outputTokens ?? 0;
      // Rough cost: input $0.15/1M + output $0.60/1M (Gemini 2.5 Flash)
      const costUsd = (inputTokens * 0.15) / 1_000_000 + (outputTokens * 0.6) / 1_000_000;

      return {
        providerId: "gemini-llm",
        costUsd,
        durationMs: result.latencyMs,
        mode: "sync",
        output: {
          text: result.text,
          usage: result.usage,
        },
      };
    },
  };
}
