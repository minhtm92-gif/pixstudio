/**
 * @pixstudio/ai-services — Plug-in AI Provider Interface
 * Per ADR-001 (AI Provider Plug-in Interface) + ADR-002 (DO Inference Engine adoption).
 * Locked vendor mesh — không tự ý thêm vendor without ADR + anh Minh approve.
 */

export type AICapability =
  | "llm.chat"
  | "llm.stream"
  | "image.generate"
  | "image.edit"
  | "image.bgRemove"
  | "video.imageToVideo"
  | "video.textToVideo"
  | "video.extend"
  | "video.upscale"
  | "video.sceneDetect"
  | "video.multimodal"
  | "tts.synthesize"
  | "stt.transcribe"
  | "audio.separate"
  | "audio.fingerprint"
  | "character.generate"
  | "character.cloneRealHuman";

export type Tier = "standard" | "pro" | "max";

export type VendorChannel =
  | "do-inference-engine"
  | "byteplus"
  | "gemini-api"
  | "fal-ai"
  | "elevenlabs"
  | "deepgram"
  | "self-host"
  | "external";

export interface QuotaRule {
  /** Monthly limit; -1 = unlimited (Max tier fair-use); 0 = not allowed at this tier */
  monthlyLimit: number;
  /** Unit semantic — "videos" | "minutes" | "tokens" | "images" | "characters" */
  unit: string;
  /** If true, count exceeded → soft block (warn but proceed); if false → hard block */
  softCap?: boolean;
}

export interface QuotaConfig {
  standard?: QuotaRule;
  pro?: QuotaRule;
  max?: QuotaRule;
}

export interface CostModel {
  /** USD per unit (request, second, character, etc.) */
  pricePerUnit: number;
  unit: "request" | "input_token" | "output_token" | "second" | "minute" | "character" | "image";
  /** Optional minimum charge per call (e.g. 5-min minimum on GPU) */
  minimumCharge?: number;
}

export interface ProviderBranding {
  displayName: string;
  vendor: string;
  vendorChannel: VendorChannel;
  /** Byteplus đối tác chiến lược ⭐ — prefer this provider when capability available */
  isPriorityChannel?: boolean;
  logoUrl?: string;
  description: string;
  /** SEO landing page slug (per D3 + InVideo pattern) — `studio.pixelxlab.com/ai/{slug}` */
  seoSlug?: string;
}

export interface InvokeContext {
  workspaceId: string;
  userId: string;
  tier: Tier;
  /** Workspace region for R2 routing */
  region: "vn-sg" | "eu" | "us";
  /** Session correlation id (for tracing) */
  traceId: string;
}

export interface InvokeResultBase {
  providerId: string;
  costUsd: number;
  durationMs: number;
  /** Sync = result available; Async = job queued, webhook will deliver */
  mode: "sync" | "async";
  /** For async: job id to poll/correlate webhook */
  jobId?: string;
}

export interface AIProvider<TInput = unknown, TOutput = unknown> {
  // === Identity ===
  id: string;
  capability: AICapability;
  branding: ProviderBranding;

  // === Tier + quota gating ===
  availableInTiers: Tier[];
  quotas: QuotaConfig;
  cost: CostModel;

  // === Health ===
  /** Check vendor health quickly (≤3s) — used by router fallback decision */
  healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }>;

  // === Invoke ===
  invoke(input: TInput, ctx: InvokeContext): Promise<InvokeResultBase & { output?: TOutput }>;

  // === Webhook (for async vendors: Kling, Veo, Seedance, etc.) ===
  /** Parse + verify webhook payload from this vendor; return job result or null if not for us */
  parseWebhook?(req: { headers: Record<string, string>; body: unknown }): Promise<{
    jobId: string;
    output: TOutput;
    costUsd?: number;
  } | null>;

  // === Optional: input transform/validate ===
  validateInput?(input: TInput): Promise<{ valid: boolean; reason?: string }>;
}

export interface RouterDecision<TInput = unknown> {
  capability: AICapability;
  tier: Tier;
  /** Selected provider (after fallback chain resolution) */
  selected: AIProvider<TInput>;
  /** Fallback providers tried before `selected` (for observability) */
  triedAndFailed: Array<{ providerId: string; reason: string }>;
}
