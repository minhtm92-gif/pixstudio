/**
 * End-to-end test cho all real providers (TTS + image gen + chat).
 * Usage: env-set ELEVENLABS_API_KEY + GEMINI_API_KEY then run.
 */

import { ProviderRegistry, CapabilityRouter } from "./src/index.ts";

const registry = new ProviderRegistry({
  secrets: {
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    BYTEPLUS_ACCESS_KEY: process.env.BYTEPLUS_ACCESS_KEY,
    BYTEPLUS_SECRET_KEY: process.env.BYTEPLUS_SECRET_KEY,
  },
});

console.log("=== Registered providers ===");
for (const p of registry.listAll()) {
  console.log(`  ${p.id} → ${p.capability} (${p.branding.vendor})`);
}

const router = new CapabilityRouter(registry);
const ctx = {
  workspaceId: "ws-test",
  userId: "u-test",
  tier: "pro" as const,
  region: "vn-sg" as const,
  traceId: `test-${Date.now()}`,
};

// === Test 1: Image gen via Nano Banana ===
console.log("\n=== Test 1: image.generate (Nano Banana Std) ===");
try {
  const { decision, result } = await router.invoke<any, any>(
    "image.generate",
    { prompt: "A minimalist 3-square logo with blue gradient (navy to sky), tech aesthetic" },
    ctx,
  );
  console.log("  selected:", decision.selected.id);
  console.log("  cost:", `$${result.costUsd}`);
  console.log("  latency:", `${result.durationMs}ms`);
  console.log("  image bytes:", result.output?.byteLength);
  if (result.output?.imageBase64) {
    const buf = Buffer.from(result.output.imageBase64, "base64");
    await Bun.write("/tmp/pxs-image-test.png", buf);
    console.log("  ✓ Image saved /tmp/pxs-image-test.png");
  }
} catch (err) {
  console.log("  ✗ FAIL:", err instanceof Error ? err.message : err);
}

// === Test 2: LLM chat via Gemini 2.5 Flash ===
console.log("\n=== Test 2: llm.chat (Gemini 2.5 Flash) ===");
try {
  const { decision, result } = await router.invoke<any, any>(
    "llm.chat",
    {
      prompt: "Trong 1 câu, giải thích PixStudio là gì.",
      systemInstruction: "Bạn là CEO Tech của PixStudio. Trả lời ngắn gọn.",
      temperature: 0.7,
      maxOutputTokens: 100,
    },
    ctx,
  );
  console.log("  selected:", decision.selected.id);
  console.log("  cost:", `$${result.costUsd.toFixed(8)}`);
  console.log("  latency:", `${result.durationMs}ms`);
  console.log("  usage:", result.output?.usage);
  console.log("  text:", result.output?.text);
} catch (err) {
  console.log("  ✗ FAIL:", err instanceof Error ? err.message : err);
}

// === Test 3: TTS via ElevenLabs (re-validate) ===
console.log("\n=== Test 3: tts.synthesize (ElevenLabs) ===");
try {
  const { decision, result } = await router.invoke<any, any>(
    "tts.synthesize",
    {
      text: "PixStudio voice test successful",
      voiceId: "21m00Tcm4TlvDq8ikWAM",
      outputFormat: "mp3_44100_128",
    },
    ctx,
  );
  console.log("  selected:", decision.selected.id);
  console.log("  cost:", `$${result.costUsd.toFixed(4)}`);
  console.log("  latency:", `${result.durationMs}ms`);
  console.log("  audio bytes:", result.output?.byteLength);
} catch (err) {
  console.log("  ✗ FAIL:", err instanceof Error ? err.message : err);
}

console.log("\n✅ Multi-provider end-to-end test complete");
