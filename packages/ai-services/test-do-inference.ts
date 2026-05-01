import { ProviderRegistry, CapabilityRouter } from "./src/index.ts";

const registry = new ProviderRegistry({
  secrets: {
    DO_INFERENCE_TOKEN: process.env.DO_INFERENCE_TOKEN,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY, // for fallback comparison
  },
});

const router = new CapabilityRouter(registry);
const ctx = {
  workspaceId: "ws-test",
  userId: "u-test",
  tier: "pro" as const,
  region: "vn-sg" as const,
  traceId: `test-${Date.now()}`,
};

console.log("=== Test llm.chat via router (priority channel ⭐ wins) ===");
const { decision, result } = await router.invoke<any, any>(
  "llm.chat",
  {
    prompt: "Trong 1 câu tiếng Việt, PixStudio là gì?",
    systemInstruction: "Bạn là CTO PixStudio.",
    temperature: 0.7,
    maxTokens: 100,
    model: "anthropic-claude-sonnet-4",
  },
  ctx,
);

console.log("Selected:", decision.selected.id);
console.log("Tried+failed:", decision.triedAndFailed);
console.log("Cost:", `$${result.costUsd.toFixed(8)}`);
console.log("Latency:", `${result.durationMs}ms`);
console.log("Usage:", result.output?.usage);
console.log("Text:", result.output?.text);
console.log("\n✅ DO Inference end-to-end OK");
