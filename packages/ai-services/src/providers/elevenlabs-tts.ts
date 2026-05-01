/**
 * ElevenLabs TTS provider — tts.synthesize capability.
 * Per D29 + tier quotas: Standard 30min/mo · Pro 180min/mo · Max unlimited.
 * Cost: ~$0.30 per 1000 characters Creator tier ($22/mo cap 500K chars/mo).
 */

import { ElevenLabsClient } from "../clients/elevenlabs.ts";
import type { AIProvider, InvokeContext, InvokeResultBase } from "../types.ts";

interface ElevenLabsTTSInput {
  text: string;
  voiceId: string;
  /** Default eleven_multilingual_v2 (supports VN) */
  modelId?: string;
  outputFormat?: "mp3_44100_128" | "mp3_44100_192" | "pcm_44100";
  voiceSettings?: {
    stability?: number;
    similarityBoost?: number;
    style?: number;
    useSpeakerBoost?: boolean;
  };
}

interface ElevenLabsTTSOutput {
  audioBytes: ArrayBuffer;
  byteLength: number;
  durationEstimateMs: number;
  outputFormat: string;
}

export function createElevenLabsTTSProvider(opts: {
  apiKey: string;
}): AIProvider<ElevenLabsTTSInput, ElevenLabsTTSOutput> {
  const client = new ElevenLabsClient({ apiKey: opts.apiKey });

  return {
    id: "elevenlabs-tts",
    capability: "tts.synthesize",
    branding: {
      displayName: "ElevenLabs TTS",
      vendor: "ElevenLabs",
      vendorChannel: "elevenlabs",
      description:
        "Voice synthesis multilingual (VN+EN). Per D29 chốt 2026-05-01. Voice cloning Max tier (no watermark per D31).",
      seoSlug: "elevenlabs-tts",
    },
    availableInTiers: ["standard", "pro", "max"],
    quotas: {
      standard: { monthlyLimit: 30, unit: "minutes" },
      pro: { monthlyLimit: 180, unit: "minutes" },
      max: { monthlyLimit: -1, unit: "minutes", softCap: true },
    },
    cost: {
      pricePerUnit: 0.0003, // ~$0.30 per 1K chars Creator tier
      unit: "character",
    },

    async healthCheck() {
      return client.ping();
    },

    async validateInput(input) {
      if (!input.text || input.text.length === 0)
        return { valid: false, reason: "text required" };
      if (!input.voiceId) return { valid: false, reason: "voiceId required" };
      if (input.text.length > 5000)
        return { valid: false, reason: "text exceeds 5000 chars (single request limit)" };
      return { valid: true };
    },

    async invoke(
      input,
      _ctx: InvokeContext,
    ): Promise<InvokeResultBase & { output?: ElevenLabsTTSOutput }> {
      const result = await client.synthesize({
        voiceId: input.voiceId,
        text: input.text,
        modelId: input.modelId,
        outputFormat: input.outputFormat,
        voiceSettings: input.voiceSettings,
      });

      // Rough estimate: ~150 chars/sec speech rate
      const durationEstimateMs = Math.round((input.text.length / 150) * 1000);

      return {
        providerId: "elevenlabs-tts",
        costUsd: input.text.length * 0.0003,
        durationMs: result.latencyMs,
        mode: "sync",
        output: {
          audioBytes: result.audioBytes,
          byteLength: result.audioBytes.byteLength,
          durationEstimateMs,
          outputFormat: input.outputFormat ?? "mp3_44100_128",
        },
      };
    },
  };
}
