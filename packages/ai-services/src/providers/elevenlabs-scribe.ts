/**
 * ElevenLabs Scribe STT provider — stt.transcribe capability.
 * Per D30: primary STT cho VN+EN; Deepgram fallback gate VN WER >15% test trước Phase 2.
 */

import { ElevenLabsClient } from "../clients/elevenlabs.ts";
import type { AIProvider, InvokeContext, InvokeResultBase } from "../types.ts";

interface ScribeInput {
  audioBlob: Blob;
  /** ISO 639-1 language code (vi, en, ...). Auto-detect if omitted */
  languageCode?: string;
  diarize?: boolean;
  timestampsGranularity?: "none" | "word" | "character";
}

interface ScribeOutput {
  text: string;
  languageCode: string;
  words?: Array<{ text: string; start: number; end: number; speakerId?: string }>;
}

export function createElevenLabsScribeProvider(opts: {
  apiKey: string;
}): AIProvider<ScribeInput, ScribeOutput> {
  const client = new ElevenLabsClient({ apiKey: opts.apiKey });

  return {
    id: "elevenlabs-scribe",
    capability: "stt.transcribe",
    branding: {
      displayName: "ElevenLabs Scribe",
      vendor: "ElevenLabs",
      vendorChannel: "elevenlabs",
      description:
        "Speech-to-text với word-level timestamps + diarization. Per D30 — primary STT cho VN+EN.",
      seoSlug: "elevenlabs-scribe",
    },
    availableInTiers: ["standard", "pro", "max"],
    quotas: {
      standard: { monthlyLimit: 60, unit: "minutes" },
      pro: { monthlyLimit: 600, unit: "minutes" },
      max: { monthlyLimit: -1, unit: "minutes", softCap: true },
    },
    cost: {
      pricePerUnit: 0.4, // ~$0.40/hr ElevenLabs Scribe
      unit: "minute",
    },

    async healthCheck() {
      return client.ping();
    },

    async validateInput(input) {
      if (!input.audioBlob || input.audioBlob.size === 0)
        return { valid: false, reason: "audioBlob required" };
      if (input.audioBlob.size > 1024 * 1024 * 500)
        return { valid: false, reason: "audioBlob exceeds 500MB" };
      return { valid: true };
    },

    async invoke(
      input,
      _ctx: InvokeContext,
    ): Promise<InvokeResultBase & { output?: ScribeOutput }> {
      const result = await client.transcribe({
        audioBlob: input.audioBlob,
        languageCode: input.languageCode,
        diarize: input.diarize,
        timestampsGranularity: input.timestampsGranularity,
        modelId: "scribe_v1",
      });

      // Estimate duration from audio file size: ~16kHz mono PCM ~= 32KB/sec
      const estimatedMinutes = input.audioBlob.size / (32 * 1024 * 60);
      const costUsd = estimatedMinutes * (0.4 / 60);

      return {
        providerId: "elevenlabs-scribe",
        costUsd,
        durationMs: result.latencyMs,
        mode: "sync",
        output: {
          text: result.text,
          languageCode: result.languageCode,
          words: result.words,
        },
      };
    },
  };
}
