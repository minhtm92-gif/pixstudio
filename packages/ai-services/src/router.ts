/**
 * Capability-based router — picks provider per (capability, tier) with fallback chain.
 * Per ADR-001 §2.2 + D27 priority channel rule (Byteplus đối tác chiến lược ⭐ wins ties).
 */

import type { AICapability, AIProvider, InvokeContext, RouterDecision, Tier } from "./types.ts";
import type { ProviderRegistry } from "./registry.ts";

export class CapabilityRouter {
  constructor(private registry: ProviderRegistry) {}

  /**
   * Pick best provider for (capability, tier) considering:
   *  1. Tier eligibility (provider must include tier in availableInTiers)
   *  2. Priority channel preference (isPriorityChannel = true wins ties)
   *  3. Health check (skip unhealthy providers, fallback next)
   *
   * Returns RouterDecision with selected + triedAndFailed log.
   */
  async resolve<TInput = unknown>(
    capability: AICapability,
    tier: Tier,
    _ctx?: InvokeContext,
  ): Promise<RouterDecision<TInput>> {
    const candidates = this.registry
      .getByCapability(capability)
      .filter((p) => p.availableInTiers.includes(tier));

    if (candidates.length === 0) {
      throw new Error(
        `No provider for capability=${capability} at tier=${tier}. Check registry + ADR-001 mesh.`,
      );
    }

    // Sort: priority channel first, then by id (deterministic)
    candidates.sort((a, b) => {
      const ap = a.branding.isPriorityChannel ? 1 : 0;
      const bp = b.branding.isPriorityChannel ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return a.id.localeCompare(b.id);
    });

    const triedAndFailed: Array<{ providerId: string; reason: string }> = [];

    for (const provider of candidates) {
      try {
        const health = await provider.healthCheck();
        if (!health.healthy) {
          triedAndFailed.push({
            providerId: provider.id,
            reason: `health check failed: ${health.error ?? "unknown"} (${health.latencyMs}ms)`,
          });
          continue;
        }
        return { capability, tier, selected: provider as AIProvider<TInput>, triedAndFailed };
      } catch (err) {
        triedAndFailed.push({
          providerId: provider.id,
          reason: `health check threw: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    throw new Error(
      `All providers unhealthy for capability=${capability} tier=${tier}. Tried: ${triedAndFailed
        .map((t) => t.providerId)
        .join(", ")}`,
    );
  }

  /** Resolve + invoke in one call. */
  async invoke<TInput = unknown, TOutput = unknown>(
    capability: AICapability,
    input: TInput,
    ctx: InvokeContext,
  ): Promise<{
    decision: RouterDecision<TInput>;
    result: Awaited<ReturnType<AIProvider<TInput, TOutput>["invoke"]>>;
  }> {
    const decision = await this.resolve<TInput>(capability, ctx.tier);
    const provider = decision.selected as AIProvider<TInput, TOutput>;

    if (provider.validateInput) {
      const v = await provider.validateInput(input);
      if (!v.valid) throw new Error(`Invalid input for ${provider.id}: ${v.reason}`);
    }

    const result = await provider.invoke(input, ctx);
    return { decision, result };
  }
}
