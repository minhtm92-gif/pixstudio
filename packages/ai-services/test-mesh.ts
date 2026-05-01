/**
 * Provider mesh smoke test — register all + health check (no billable invocations).
 * Tests Kling + Veo 3 + DO Inference health endpoints.
 */

import { ProviderRegistry } from "./src/index.ts";

const registry = new ProviderRegistry({
  secrets: {
    BYTEPLUS_ACCESS_KEY: process.env.BYTEPLUS_ACCESS_KEY,
    BYTEPLUS_SECRET_KEY: process.env.BYTEPLUS_SECRET_KEY,
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    FAL_API_KEY: process.env.FAL_API_KEY,
    DO_INFERENCE_TOKEN: process.env.DO_INFERENCE_TOKEN,
  },
});

console.log("=== Registered providers ===");
const providers = registry.listAll();
for (const p of providers) {
  const priority = p.branding.isPriorityChannel ? " ⭐" : "";
  console.log(`  ${p.id.padEnd(22)} → ${p.capability.padEnd(22)} (${p.branding.vendor})${priority}`);
}
console.log(`\nTotal: ${providers.length} providers registered\n`);

console.log("=== Health check all providers ===");
for (const p of providers) {
  try {
    const h = await p.healthCheck();
    const icon = h.healthy ? "✓" : "✗";
    console.log(`  ${icon} ${p.id.padEnd(22)} ${h.latencyMs}ms${h.error ? ` (${h.error})` : ""}`);
  } catch (err) {
    console.log(`  ✗ ${p.id.padEnd(22)} threw: ${err instanceof Error ? err.message : err}`);
  }
}

console.log("\n=== Capability coverage ===");
const capabilities = [
  "llm.chat",
  "image.generate",
  "video.imageToVideo",
  "video.textToVideo",
  "tts.synthesize",
  "stt.transcribe",
] as const;
for (const cap of capabilities) {
  const list = registry.getByCapability(cap);
  console.log(`  ${cap.padEnd(22)}: ${list.map((p) => p.id).join(", ") || "(none)"}`);
}

console.log("\n✅ Provider mesh smoke test complete");
