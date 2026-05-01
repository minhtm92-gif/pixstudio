/**
 * Gemini API HTTP client — Nano Banana image gen + Veo 3 video gen + 2.5 Pro multimodal.
 * Per ADR-001 + D27 locked AI mesh.
 */

import { BaseClient, HttpError } from "./_base.ts";

export interface GeminiClientConfig {
  apiKey: string;
  baseUrl?: string;
}

export class GeminiClient extends BaseClient {
  private apiKey: string;

  constructor(config: GeminiClientConfig) {
    super({
      baseUrl: config.baseUrl ?? "https://generativelanguage.googleapis.com",
      timeout: 60000,
      maxRetries: 2,
    });
    this.apiKey = config.apiKey;
  }

  /** Health check — list available models */
  async ping(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      await this.request(`/v1beta/models?key=${this.apiKey}`, { method: "GET" });
      return { healthy: true, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Generate image via Nano Banana (gemini-2.5-flash-image).
   * Returns inline base64 image data.
   */
  async generateImage(input: {
    prompt: string;
    /** Default `gemini-2.5-flash-image` (Nano Banana Standard); Pro uses `gemini-2.5-pro-image` */
    model?: string;
    /** Seed for reproducibility */
    seed?: number;
  }): Promise<{
    imageBase64: string;
    mimeType: string;
    latencyMs: number;
  }> {
    const start = Date.now();
    const model = input.model ?? "gemini-2.5-flash-image";
    const url = `${this.baseUrl}/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: input.prompt }] }],
        ...(input.seed !== undefined ? { generationConfig: { seed: input.seed } } : {}),
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new HttpError(resp.status, `Gemini ${resp.status}: ${body.slice(0, 300)}`);
    }

    const data = (await resp.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: { mimeType: string; data: string };
            text?: string;
          }>;
        };
      }>;
    };

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData);

    if (!imagePart?.inlineData) {
      const textPart = parts.find((p) => p.text);
      throw new Error(
        `Gemini image gen returned no image data. Text part: ${textPart?.text?.slice(0, 200) ?? "(none)"}`,
      );
    }

    return {
      imageBase64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType,
      latencyMs: Date.now() - start,
    };
  }

  /**
   * Chat completion via Gemini text models (2.5 Flash / 2.5 Pro).
   * Used for multimodal video understanding (Path B reverse engineer).
   */
  async chat(input: {
    prompt: string;
    model?: string;
    systemInstruction?: string;
    temperature?: number;
    maxOutputTokens?: number;
  }): Promise<{ text: string; latencyMs: number; usage?: { promptTokens: number; outputTokens: number } }> {
    const start = Date.now();
    const model = input.model ?? "gemini-2.5-flash";
    const url = `${this.baseUrl}/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    const body: Record<string, unknown> = {
      contents: [{ parts: [{ text: input.prompt }] }],
    };
    if (input.systemInstruction) {
      body.systemInstruction = { parts: [{ text: input.systemInstruction }] };
    }
    if (input.temperature !== undefined || input.maxOutputTokens !== undefined) {
      body.generationConfig = {
        ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
        ...(input.maxOutputTokens !== undefined ? { maxOutputTokens: input.maxOutputTokens } : {}),
      };
    }

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      throw new HttpError(resp.status, `Gemini chat ${resp.status}: ${errBody.slice(0, 300)}`);
    }

    const data = (await resp.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };

    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    return {
      text,
      latencyMs: Date.now() - start,
      usage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount ?? 0,
            outputTokens: data.usageMetadata.candidatesTokenCount ?? 0,
          }
        : undefined,
    };
  }
}
