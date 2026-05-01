/**
 * One-off test cho ElevenLabs TTS provider via plug-in router.
 * Usage: doppler run -- bun packages/ai-services/test-tts.ts
 */

import { ProviderRegistry, CapabilityRouter } from "./src/index.ts";

const registry = new ProviderRegistry({
  secrets: {
    BYTEPLUS_ACCESS_KEY: process.env.BYTEPLUS_ACCESS_KEY,
    BYTEPLUS_SECRET_KEY: process.env.BYTEPLUS_SECRET_KEY,
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
  },
});

console.log("Providers registered:", registry.listAll().map((p) => p.id));

const router = new CapabilityRouter(registry);

console.log("\n=== Test ElevenLabs TTS via router ===");
const { decision, result } = await router.invoke<
  Parameters<Awaited<ReturnType<typeof router.invoke<any, any>>>['result']['output']>[0],
  { audioBytes: ArrayBuffer; byteLength: number; durationEstimateMs: number; outputFormat: string }
>(
  "tts.synthesize",
  {
    text: "Hello, this is PixStudio voice synthesis test.",
    voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel (default English)
    outputFormat: "mp3_44100_128",
  } as any,
  {
    workspaceId: "ws-test",
    userId: "u-test",
    tier: "pro",
    region: "vn-sg",
    traceId: `test-${Date.now()}`,
  },
);

console.log("Decision:", {
  selected: decision.selected.id,
  triedAndFailed: decision.triedAndFailed,
});
console.log("Result:", {
  providerId: result.providerId,
  costUsd: result.costUsd,
  durationMs: result.durationMs,
  mode: result.mode,
  audioBytes: result.output?.byteLength,
  durationEstimateMs: (result.output as any)?.durationEstimateMs,
  outputFormat: (result.output as any)?.outputFormat,
});

if (result.output && (result.output as any).audioBytes) {
  const buf = (result.output as any).audioBytes as ArrayBuffer;
  await Bun.write("/tmp/pxs-tts-test.mp3", buf);
  console.log("\n✓ Audio saved /tmp/pxs-tts-test.mp3");
}

console.log("\n✅ ElevenLabs TTS end-to-end OK");
