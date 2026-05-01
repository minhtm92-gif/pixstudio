/**
 * fal.ai HTTP client — Kling video gen + future fal models.
 * Per ADR-001 + D27. Async queue-based API: submit → poll request_id → fetch result.
 */

import { BaseClient, HttpError } from "./_base.ts";

export interface FalClientConfig {
  apiKey: string;
  baseUrl?: string;
}

export class FalClient extends BaseClient {
  private apiKey: string;

  constructor(config: FalClientConfig) {
    super({
      baseUrl: config.baseUrl ?? "https://queue.fal.run",
      defaultHeaders: {
        Authorization: `Key ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 60000,
      maxRetries: 2,
    });
    this.apiKey = config.apiKey;
  }

  /** Health check — list user info */
  async ping(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      // fal.ai doesn't have explicit health endpoint; use a known model status
      const resp = await fetch(`${this.baseUrl}/fal-ai/health`, {
        headers: { Authorization: `Key ${this.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      // 2xx OR 4xx (auth-related) = reachable; 5xx = down
      const healthy = resp.status < 500;
      return { healthy, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Submit Kling video gen job (text-to-video or image-to-video).
   * Returns request_id for status polling.
   */
  async submitKling(input: {
    /** "v1.5/standard" | "v1.5/pro" | "v2/master" */
    variant: "v1.5/standard" | "v1.5/pro" | "v2/master";
    /** "text-to-video" or "image-to-video" */
    mode: "text-to-video" | "image-to-video";
    prompt: string;
    /** For image-to-video */
    imageUrl?: string;
    duration?: 5 | 10;
    aspectRatio?: "16:9" | "9:16" | "1:1";
    cfgScale?: number; // 0-1, default 0.5
    negativePrompt?: string;
  }): Promise<{ requestId: string; statusUrl: string; latencyMs: number }> {
    const start = Date.now();
    const path = `/fal-ai/kling-video/${input.variant}/${input.mode}`;

    const body: Record<string, unknown> = {
      prompt: input.prompt,
      duration: input.duration ?? "5",
      aspect_ratio: input.aspectRatio ?? "16:9",
      cfg_scale: input.cfgScale ?? 0.5,
    };
    if (input.imageUrl) body.image_url = input.imageUrl;
    if (input.negativePrompt) body.negative_prompt = input.negativePrompt;

    const { data } = await this.request<{ request_id: string; status_url?: string }>(path, {
      method: "POST",
      body: JSON.stringify(body),
    });

    return {
      requestId: data.request_id,
      statusUrl: data.status_url ?? `${this.baseUrl}${path}/requests/${data.request_id}/status`,
      latencyMs: Date.now() - start,
    };
  }

  /** Poll Kling job status. */
  async pollKling(requestId: string, variant: string, mode: string): Promise<{
    status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
    output?: { videoUrl: string; durationSec: number };
    error?: string;
  }> {
    const path = `/fal-ai/kling-video/${variant}/${mode}/requests/${requestId}`;
    const { data } = await this.request<{
      status?: string;
      video?: { url: string };
      duration?: number;
      error?: string;
    }>(`${path}/status`, { method: "GET" });

    const statusUpper = (data.status ?? "IN_QUEUE").toUpperCase();
    if (statusUpper === "COMPLETED" && data.video) {
      // Need to fetch result
      const result = await this.request<{ video: { url: string }; duration?: number }>(path, {
        method: "GET",
      });
      return {
        status: "COMPLETED",
        output: {
          videoUrl: result.data.video.url,
          durationSec: result.data.duration ?? 5,
        },
      };
    }

    return {
      status: statusUpper as any,
      error: data.error,
    };
  }
}
