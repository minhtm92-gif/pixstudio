/**
 * Provider registry — central map of all locked AI providers per ADR-001 + D27.
 * Add provider: import + register in this file. ADR + anh Minh approval required.
 */

import type { AICapability, AIProvider } from "./types.ts";
import { createSeedance20Provider } from "./providers/seedance-2-0.ts";
import { createElevenLabsTTSProvider } from "./providers/elevenlabs-tts.ts";

export interface RegistryConfig {
  /** Doppler-injected secrets at boot */
  secrets: {
    BYTEPLUS_ACCESS_KEY?: string;
    BYTEPLUS_SECRET_KEY?: string;
    GEMINI_API_KEY?: string;
    ELEVENLABS_API_KEY?: string;
    DO_INFERENCE_TOKEN?: string;
    FAL_API_KEY?: string;
    DEEPGRAM_API_KEY?: string;
  };
}

export class ProviderRegistry {
  private byId = new Map<string, AIProvider>();
  private byCapability = new Map<AICapability, AIProvider[]>();

  constructor(config: RegistryConfig) {
    this.registerAllProviders(config);
  }

  private registerAllProviders(config: RegistryConfig): void {
    // === Video gen primary ===
    if (config.secrets.BYTEPLUS_ACCESS_KEY && config.secrets.BYTEPLUS_SECRET_KEY) {
      this.register(
        createSeedance20Provider({
          accessKey: config.secrets.BYTEPLUS_ACCESS_KEY,
          secretKey: config.secrets.BYTEPLUS_SECRET_KEY,
        }),
      );
      // TODO Sprint 2+: register Seedream (image gen alt) — same Byteplus channel
    }

    // === LLM via DO Inference Engine (Anthropic + OpenAI + fal models unified) ===
    // TODO Sprint 1: register createDoInferenceProvider({ token: config.secrets.DO_INFERENCE_TOKEN })

    // === Video gen premium ===
    // TODO Sprint 2: register createVeo3Provider({ apiKey: config.secrets.GEMINI_API_KEY })

    // === Video transition ===
    // TODO Sprint 2: register createKling30Provider({ apiKey: config.secrets.FAL_API_KEY })

    // === Image gen ===
    // TODO Sprint 2: register createNanoBananaStdProvider({ apiKey: config.secrets.GEMINI_API_KEY })
    // TODO Sprint 2: register createNanoBananaProProvider({ apiKey: config.secrets.GEMINI_API_KEY })

    // === Voice (ElevenLabs — D29) ===
    if (config.secrets.ELEVENLABS_API_KEY) {
      this.register(
        createElevenLabsTTSProvider({ apiKey: config.secrets.ELEVENLABS_API_KEY }),
      );
      // TODO Sprint 1: register createElevenLabsScribeProvider (stt.transcribe — D30)
    }

    // === Self-host GPU pipelines (Demucs / SAM 2 / Real-ESRGAN / ComfyUI / Whisper) ===
    // TODO Phase 2+: register createDemucsProvider, createSAM2Provider, etc.
  }

  register(provider: AIProvider): void {
    if (this.byId.has(provider.id)) {
      throw new Error(`Provider ${provider.id} already registered`);
    }
    this.byId.set(provider.id, provider);
    const list = this.byCapability.get(provider.capability) ?? [];
    list.push(provider);
    this.byCapability.set(provider.capability, list);
  }

  getById(id: string): AIProvider | undefined {
    return this.byId.get(id);
  }

  getByCapability(capability: AICapability): AIProvider[] {
    return this.byCapability.get(capability) ?? [];
  }

  listAll(): AIProvider[] {
    return [...this.byId.values()];
  }
}
