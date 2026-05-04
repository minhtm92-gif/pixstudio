/**
 * DigitalOcean Inference Engine LLM provider.
 * Per ADR-002: primary LLM channel — Anthropic + OpenAI + DO-hosted (Llama, Qwen, DeepSeek)
 * unified API. OpenAI-compatible chat completions endpoint.
 *
 * Auth: model access key (DO_INFERENCE_TOKEN) — per-model key from DO Agent Platform.
 */

import { BaseClient } from "../clients/_base.ts";
import type { AIProvider, InvokeContext, InvokeResultBase } from "../types.ts";

interface DoInferenceInput {
  prompt: string;
  systemInstruction?: string;
  /** OpenAI-compatible model identifier (Anthropic: "anthropic/claude-sonnet-4", OpenAI: "openai/gpt-5", DO: "llama-3.3-70b-instruct", etc.) */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Stream response (Phase 2+) */
  stream?: boolean;
  /** OpenAI-compatible response_format. "json_object" forces JSON output (Anthropic + OpenAI models). */
  responseFormat?: "text" | "json_object";
}

interface DoInferenceOutput {
  text: string;
  model: string;
  usage?: { promptTokens: number; outputTokens: number; totalTokens: number };
  finishReason?: string;
}

export function createDoInferenceProvider(opts: {
  modelAccessKey: string;
  /** Default `https://inference.do-ai.run` */
  baseUrl?: string;
  defaultModel?: string;
}): AIProvider<DoInferenceInput, DoInferenceOutput> {
  const client = new BaseClient({
    baseUrl: opts.baseUrl ?? "https://inference.do-ai.run",
    defaultHeaders: {
      Authorization: `Bearer ${opts.modelAccessKey}`,
      "Content-Type": "application/json",
    },
    timeout: 60000,
    maxRetries: 2,
  });

  const defaultModel = opts.defaultModel ?? "anthropic-claude-sonnet-4";

  return {
    id: "do-inference",
    capability: "llm.chat",
    branding: {
      displayName: "DigitalOcean Inference Engine",
      vendor: "DigitalOcean",
      vendorChannel: "do-inference-engine",
      description:
        "Unified LLM API — Anthropic Claude + OpenAI GPT + DO-hosted Llama/Qwen/DeepSeek. Per ADR-002 primary channel.",
      seoSlug: "do-inference",
      isPriorityChannel: true,
    },
    availableInTiers: ["standard", "pro", "max"],
    quotas: {
      standard: { monthlyLimit: 1000, unit: "requests" },
      pro: { monthlyLimit: 10000, unit: "requests" },
      max: { monthlyLimit: -1, unit: "requests", softCap: true },
    },
    cost: {
      // Anthropic Claude Sonnet 4: ~$3/1M input + $15/1M output via DO
      pricePerUnit: 0.000003,
      unit: "input_token",
    },

    async healthCheck() {
      const start = Date.now();
      try {
        await client.request("/v1/models", { method: "GET" });
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
      return { valid: true };
    },

    async invoke(
      input,
      _ctx: InvokeContext,
    ): Promise<InvokeResultBase & { output?: DoInferenceOutput }> {
      const messages: Array<{ role: string; content: string }> = [];
      if (input.systemInstruction) {
        messages.push({ role: "system", content: input.systemInstruction });
      }
      messages.push({ role: "user", content: input.prompt });

      const model = input.model ?? defaultModel;

      const { data, latencyMs } = await client.request<{
        id: string;
        object: string;
        choices?: Array<{
          message?: { content?: string; role?: string };
          finish_reason?: string;
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      }>("/v1/chat/completions", {
        method: "POST",
        body: JSON.stringify({
          model,
          messages,
          temperature: input.temperature ?? 0.7,
          max_tokens: input.maxTokens ?? 1000,
          stream: false,
          ...(input.responseFormat === "json_object"
            ? { response_format: { type: "json_object" } }
            : {}),
        }),
      });

      const text = data.choices?.[0]?.message?.content ?? "";
      const inputTokens = data.usage?.prompt_tokens ?? 0;
      const outputTokens = data.usage?.completion_tokens ?? 0;
      // Rough cost: Anthropic Sonnet 4 $3/1M input + $15/1M output
      const costUsd = (inputTokens * 3) / 1_000_000 + (outputTokens * 15) / 1_000_000;

      // Deep logging when content is empty — helps diagnose finish_reason
      // (length / content_filter / etc.) and shape of the choices array.
      if (!text || text.length === 0) {
        // eslint-disable-next-line no-console
        console.warn(
          "[do-inference] Empty response — model=%s choices=%s finish=%s usage=%o",
          model,
          data.choices?.length ?? 0,
          data.choices?.[0]?.finish_reason ?? "none",
          data.usage,
        );
      }

      return {
        providerId: "do-inference",
        costUsd,
        durationMs: latencyMs,
        mode: "sync",
        output: {
          text,
          model,
          usage: data.usage
            ? {
                promptTokens: inputTokens,
                outputTokens,
                totalTokens: data.usage.total_tokens ?? inputTokens + outputTokens,
              }
            : undefined,
          finishReason: data.choices?.[0]?.finish_reason,
        },
      };
    },
  };
}
