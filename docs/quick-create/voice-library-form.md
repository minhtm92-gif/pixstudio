# Quick Create — ElevenLabs Voice Library (Full Import + UI Preview)

*Updated 2026-05-02 per anh feedback: take ALL ElevenLabs voices + user preview ngay UI khi dùng PixStudio. Anh không cần cherry-pick voices.*

---

## Architecture overview

Voice library = full mirror of ElevenLabs marketplace + user's cloned voices (Max tier).

```
ElevenLabs API (source of truth)
   ├─ GET /v1/voices                              → cached 1h Upstash Redis
   │  └─ filter language=vi/en, age, gender, use_case
   ├─ GET /v1/voices/{id}/sample (preview audio)  → cached R2 24h
   └─ POST /v1/text-to-speech/{id} (full TTS)     → on-demand, charges quota

Tier gating (per SCOPE.md):
   Standard  → 50 most-popular voices visible (filtered by ElevenLabs popularity)
   Pro       → 200 voices (community curated subset)
   Max       → all marketplace + voice cloning (Instant + Pro Voice Cloning)
```

## API endpoints (Phase 1 Sprint 2)

```
GET  /api/voices?lang=vi&gender=female&page=1&pageSize=50
     → list voices filtered + cached
     → tier-gated (Standard sees 50, Pro 200, Max all)

GET  /api/voices/:voiceId
     → full voice metadata + sample preview URL

POST /api/voices/:voiceId/preview
     body: { text: "Sample text 100 chars max" }
     → generate ad-hoc TTS preview, returns audio URL R2 24h cache
     → rate-limited 10/min/user (preview ≠ production TTS)

POST /api/voices/clone (Max tier only)
     body: { name: string, sampleAudioR2Key: string }
     → ElevenLabs Instant Voice Cloning ($0.02/clone)
     → save voiceId vào user.clonedVoices[]

GET  /api/voices/clones (Max tier only)
     → list user's cloned voices
```

## UI preview pattern

Per anh feedback, voices có UI preview INSIDE PixStudio. Component spec:

```typescript
// packages/quick-create/src/components/VoicePicker.tsx (Sprint 2)
interface VoicePickerProps {
  selectedVoiceId?: string;
  onSelect: (voiceId: string) => void;
  language?: 'vi' | 'en';
  tier: 'standard' | 'pro' | 'max';
}

// Render:
// - Search bar (filter by voice name)
// - Filter chips: language, gender, age range, use case
// - Voice cards (paginated 20/page):
//   - Avatar (initials or gen image)
//   - Voice name
//   - Tags: VN/EN flag, gender, age, use case
//   - "Listen" button → click plays sample audio (cached R2 mp3 ~5s)
//   - "Custom preview" button → modal with textarea + "Generate sample" → plays user's text in this voice
//   - "Use this voice" button → onSelect(voiceId)
// - Tier badge if voice requires Pro/Max
```

## Sample preview text (default)

When user clicks "Listen" on a voice card, em play pre-generated 5s sample. ElevenLabs marketplace already provides preview URL for each voice via `voice.preview_url`.

When user clicks "Custom preview", em call `POST /api/voices/:voiceId/preview` with their text (max 100 chars to limit cost). Default text per language:

```typescript
const SAMPLE_TEXTS = {
  vi: "Chào bạn, đây là PixStudio — nền tảng tạo video AI dành cho creator Việt Nam.",
  en: "Welcome to PixStudio, an AI video platform built for content creators worldwide.",
};
```

Cost per custom preview: ~$0.0003 (100 chars × $0.000003/char Pro tier ElevenLabs).

## Database schema additions (Phase 1 Sprint 2)

```prisma
model VoiceCacheEntry {
  voiceId       String   @id  // ElevenLabs voice ID
  voiceName     String
  language      String   // "vi", "en", "multilingual"
  gender        String   // "male", "female", "neutral"
  ageRange      String   // "young", "middle", "senior", "child"
  useCase       String?  // "narrator", "conversational", "commercial", etc.
  category      String?  // "premade", "cloned", "professional"
  popularityScore Float? // for tier filtering (Standard sees top-50)
  isPublic      Boolean  @default(true) // false = private voice not in marketplace
  previewUrlR2Key String? // R2 key cho cached sample audio
  metadataJson  Json     // raw ElevenLabs response cho future fields
  cachedAt      DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([language, gender])
  @@index([popularityScore])
  @@map("voice_cache")
}

model UserClonedVoice {
  id            String   @id @default(uuid())
  userId        String
  voiceId       String   // ElevenLabs voice ID returned from clone API
  name          String
  sampleR2Key   String   // original sample anh uploaded for cloning
  createdAt     DateTime @default(now())

  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, voiceId])
  @@index([userId])
  @@map("user_cloned_voices")
}
```

## Cron sync job (Sprint 2)

Daily at 03:00 UTC (PixStudio off-peak):
```typescript
// apps/api/src/workers/voice-cache-sync.ts
// 1. GET https://api.elevenlabs.io/v1/voices (paginated)
// 2. Upsert each voice into voice_cache table
// 3. For each voice without cached preview, fetch preview_url + save R2
// 4. Drop voices removed from marketplace
// 5. Compute popularityScore (use ElevenLabs ranking or community votes)
```

Cost daily: 0$ (read-only API call + R2 storage minimal).

## Cost estimates

ElevenLabs API pricing (verified 2026-05):
- Listing voices: free unlimited
- Sample preview audio: free (provided by marketplace)
- Custom preview TTS: ~$0.000003/char (Pro tier $99/mo prepaid)
- Voice cloning: ~$0.02 per clone (Instant) or $80 one-time (Pro Voice Cloning)

PixStudio expected daily volume:
- 100 active users × 5 preview clicks/day × 100 chars = ~$0.15/day
- 10 cloning requests/month (Max users only) = $0.20/month
- Total voice library cost: <$10/month at 1000 daily users

## Voice popularity tier mapping

Algorithm to assign tier visibility:
```typescript
function tierForVoice(v: VoiceCacheEntry): 'standard' | 'pro' | 'max' {
  // Top 50 by popularity = standard tier
  if (v.popularityScore >= POP_TOP_50) return 'standard';
  // Top 200 = pro tier
  if (v.popularityScore >= POP_TOP_200) return 'pro';
  // Rest = max tier
  return 'max';
}
```

For Phase 1 launch:
- Standard tier voices: 50 (em pick top-50 popular)
- Pro tier voices: 150 additional (total 200 visible)
- Max tier: all marketplace + voice cloning

## Migration from old form

Anh không cần fill curated 8-12 voice IDs trong cũ form. Em xóa form cũ + replace với pattern này. Anh chỉ cần:

1. ✅ Verify `ELEVENLABS_API_KEY` set Doppler (đã có)
2. ✅ Confirm tier ElevenLabs subscription (Pro $99/mo recommend cho 500K chars/mo)
3. Phase 1 Sprint 2 implementation:
   - Em build VoiceCacheEntry table + cron sync
   - Em build VoicePicker component
   - Em build /api/voices/* endpoints
4. UAT: anh test 5 voices có preview audio play đúng

## Voice cloning UX (Max tier feature)

Sprint 2 polish:
- Settings page → "Voice Cloning" section
- Upload audio sample (1-3 minute MP3/WAV)
- "Name your voice" input (required)
- "Clone" button → calls ElevenLabs Instant Voice Cloning ($0.02 charged)
- New voice appears immediately in VoicePicker với badge "Your cloned voice"
- Max 5 cloned voices per Max user (per SCOPE.md tier quota)
- Delete cloned voice → calls ElevenLabs DELETE /v1/voices/:id

## Reference

- ElevenLabs API docs: https://elevenlabs.io/docs/api-reference
- Voice Library API: https://api.elevenlabs.io/v1/voices
- Pricing: https://elevenlabs.io/pricing
