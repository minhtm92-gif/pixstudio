/**
 * ElevenLabs HTTP client — TTS synthesize + Scribe transcribe.
 * Per ADR-001 + D29 (TTS) + D30 (STT).
 */

import { BaseClient, HttpError } from "./_base.ts";

export interface ElevenLabsClientConfig {
  apiKey: string;
  /** Override base URL (testing). Default https://api.elevenlabs.io */
  baseUrl?: string;
}

export class ElevenLabsClient extends BaseClient {
  constructor(config: ElevenLabsClientConfig) {
    super({
      baseUrl: config.baseUrl ?? "https://api.elevenlabs.io",
      defaultHeaders: {
        "xi-api-key": config.apiKey,
        "Content-Type": "application/json",
      },
      timeout: 60000,
      maxRetries: 2,
    });
  }

  /** Health check — list user info (cheapest call) */
  async ping(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      await this.request("/v1/user", { method: "GET" });
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
   * TTS synthesize — POST /v1/text-to-speech/{voiceId}
   * Returns audio bytes (mp3/wav/etc per output_format).
   */
  async synthesize(input: {
    voiceId: string;
    text: string;
    modelId?: string;
    outputFormat?: "mp3_44100_128" | "mp3_44100_192" | "pcm_44100" | "ulaw_8000";
    voiceSettings?: {
      stability?: number;
      similarityBoost?: number;
      style?: number;
      useSpeakerBoost?: boolean;
    };
  }): Promise<{ audioBytes: ArrayBuffer; latencyMs: number }> {
    const start = Date.now();
    const url = `${this.baseUrl}/v1/text-to-speech/${encodeURIComponent(input.voiceId)}?output_format=${input.outputFormat ?? "mp3_44100_128"}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": this.defaultHeaders["xi-api-key"]!,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: input.text,
        model_id: input.modelId ?? "eleven_multilingual_v2",
        voice_settings: input.voiceSettings && {
          stability: input.voiceSettings.stability ?? 0.5,
          similarity_boost: input.voiceSettings.similarityBoost ?? 0.75,
          style: input.voiceSettings.style ?? 0,
          use_speaker_boost: input.voiceSettings.useSpeakerBoost ?? true,
        },
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new HttpError(resp.status, `ElevenLabs TTS ${resp.status}: ${body.slice(0, 200)}`);
    }

    const audioBytes = await resp.arrayBuffer();
    return { audioBytes, latencyMs: Date.now() - start };
  }

  /**
   * Scribe transcribe — POST /v1/speech-to-text
   * Multipart upload (audio file). Returns transcript with word-level timestamps + diarization.
   */
  async transcribe(input: {
    audioBlob: Blob;
    modelId?: "scribe_v1" | "scribe_v1_experimental";
    languageCode?: string; // ISO 639-1 (vi, en, etc.)
    diarize?: boolean;
    timestampsGranularity?: "none" | "word" | "character";
  }): Promise<{
    text: string;
    languageCode: string;
    words?: Array<{ text: string; start: number; end: number; speakerId?: string }>;
    latencyMs: number;
  }> {
    const start = Date.now();
    const form = new FormData();
    form.append("file", input.audioBlob, "audio.bin");
    form.append("model_id", input.modelId ?? "scribe_v1");
    if (input.languageCode) form.append("language_code", input.languageCode);
    if (input.diarize !== undefined) form.append("diarize", String(input.diarize));
    if (input.timestampsGranularity)
      form.append("timestamps_granularity", input.timestampsGranularity);

    const resp = await fetch(`${this.baseUrl}/v1/speech-to-text`, {
      method: "POST",
      headers: { "xi-api-key": this.defaultHeaders["xi-api-key"]! },
      body: form,
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new HttpError(resp.status, `ElevenLabs Scribe ${resp.status}: ${body.slice(0, 200)}`);
    }

    const data = (await resp.json()) as {
      text: string;
      language_code: string;
      words?: Array<{ text: string; start: number; end: number; speaker_id?: string }>;
    };

    return {
      text: data.text,
      languageCode: data.language_code,
      words: data.words?.map((w) => ({
        text: w.text,
        start: w.start,
        end: w.end,
        speakerId: w.speaker_id,
      })),
      latencyMs: Date.now() - start,
    };
  }
}
