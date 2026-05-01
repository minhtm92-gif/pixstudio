/**
 * Provider registry — central map of all locked AI providers per ADR-001 + D27.
 * Add provider: import + register in this file. ADR + anh Minh approval required.
 */

import type { AICapability, AIProvider } from "./types.ts";
import { createSeedance20Provider } from "./providers/seedance-2-0.ts";
import { createElevenLabsTTSProvider } from "./providers/elevenlabs-tts.ts";
import { createElevenLabsScribeProvider } from "./providers/elevenlabs-scribe.ts";
import { createNanoBananaStdProvider } from "./providers/nano-banana-std.ts";
import { createGeminiLLMProvider } from "./providers/gemini-llm.ts";
import { createVeo3Provider } from "./providers/veo-3.ts";
import { createKling30Provider } from "./providers/kling-3-0.ts";
import { createDoInferenceProvider } from "./providers/do-inference.ts";

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
    /** Fallback to inference token (some DO accounts use single key) */
    DO_INFERENCE_BASE_URL?: string;
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

    // === Voice (ElevenLabs — D29 + D30) ===
    if (config.secrets.ELEVENLABS_API_KEY) {
      this.register(
        createElevenLabsTTSProvider({ apiKey: config.secrets.ELEVENLABS_API_KEY }),
      );
      this.register(
        createElevenLabsScribeProvider({ apiKey: config.secrets.ELEVENLABS_API_KEY }),
      );
    }

    // === Gemini API (image gen + LLM secondary + Veo 3 video premium) ===
    if (config.secrets.GEMINI_API_KEY) {
      this.register(createNanoBananaStdProvider({ apiKey: config.secrets.GEMINI_API_KEY }));
      this.register(createGeminiLLMProvider({ apiKey: config.secrets.GEMINI_API_KEY }));
      this.register(createVeo3Provider({ apiKey: config.secrets.GEMINI_API_KEY }));
      // TODO Sprint 2: createNanoBananaProProvider (gemini-2.5-pro-image)
    }

    // === LLM primary via DO Inference Engine (per ADR-002) ===
    if (config.secrets.DO_INFERENCE_TOKEN) {
      this.register(
        createDoInferenceProvider({ modelAccessKey: config.secrets.DO_INFERENCE_TOKEN }),
      );
    }

    // === Video transition (Kling 3.0 via fal.ai) ===
    if (config.secrets.FAL_API_KEY) {
      this.register(createKling30Provider({ apiKey: config.secrets.FAL_API_KEY }));
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
