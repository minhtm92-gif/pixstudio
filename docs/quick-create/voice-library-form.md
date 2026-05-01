# Quick Create — ElevenLabs Voice Library Form

*Per SCOPE.md §13. Anh research ElevenLabs marketplace + pick 8-12 voices VN/EN. Em wire `packages/workflows/voice-library.ts` registry.*

---

## How to research voices

1. Anh login ElevenLabs dashboard: https://elevenlabs.io/app/voice-library
2. Filter by:
   - Language: Vietnamese (vi) hoặc English (en)
   - Gender: Male / Female
   - Age: Young / Middle aged / Old
   - Use case: News / Audiobook / Conversational / Commercial
3. Click voice → "Add to Library" → copy voice ID (format `21m00Tcm4TlvDq8ikWAM`)
4. Test voice with sample VN text trước khi commit

## Test sample text (anh paste vào ElevenLabs preview)

**Vietnamese sample (~30 words):**
```
Chào bạn, đây là PixStudio — nền tảng tạo video AI dành riêng cho người sáng tạo nội dung Việt Nam. Hôm nay, chúng ta sẽ cùng khám phá cách biến ý tưởng thành video chuyên nghiệp chỉ trong vài phút.
```

**English sample (~30 words):**
```
Welcome to PixStudio, an AI video platform built for content creators in Vietnam and beyond. Today, let's explore how to turn your ideas into professional videos in just a few minutes.
```

---

## Voice picks (anh fill)

### Vietnamese voices (recommend 5)

#### 1. VN Senior Male

```yaml
id: vn-senior-male-01
voiceId: <TBD>
voiceName: <TBD ElevenLabs marketplace name>
language: vi
gender: male
ageRange: senior   # 50+ tone
useCase: ad-narrator
defaultStability: 0.7
defaultSimilarityBoost: 0.85
defaultSpeed: 0.9
sampleAudioUrl: <TBD R2 path em sẽ generate sample>
description: <TBD - notes về tone, e.g. "trầm, ấm, gravitas">
```

#### 2. VN Senior Female

```yaml
id: vn-senior-female-01
voiceId: <TBD>
voiceName: <TBD>
language: vi
gender: female
ageRange: senior
useCase: ad-narrator
defaultStability: 0.7
defaultSimilarityBoost: 0.85
defaultSpeed: 0.9
sampleAudioUrl: <TBD>
description: <TBD>
```

#### 3. VN Young Male (Gen Z hooks)

```yaml
id: vn-young-male-01
voiceId: <TBD>
voiceName: <TBD>
language: vi
gender: male
ageRange: young   # 18-30
useCase: tiktok-reel
defaultStability: 0.4
defaultSimilarityBoost: 0.7
defaultSpeed: 1.1
sampleAudioUrl: <TBD>
description: <TBD trẻ trung, energetic>
```

#### 4. VN Young Female (Gen Z + millennial)

```yaml
id: vn-young-female-01
voiceId: <TBD>
voiceName: <TBD>
language: vi
gender: female
ageRange: young
useCase: vlog-conversational
defaultStability: 0.5
defaultSimilarityBoost: 0.75
defaultSpeed: 1.05
sampleAudioUrl: <TBD>
description: <TBD>
```

#### 5. VN Middle-aged Female (parents segment)

```yaml
id: vn-middle-female-01
voiceId: <TBD>
voiceName: <TBD>
language: vi
gender: female
ageRange: middle   # 30-45
useCase: family-product
defaultStability: 0.6
defaultSimilarityBoost: 0.8
defaultSpeed: 1.0
sampleAudioUrl: <TBD>
description: <TBD>
```

### English voices (recommend 3)

#### 6. EN Professional Male (B2B / SaaS)

```yaml
id: en-pro-male-01
voiceId: <TBD>
voiceName: <TBD>
language: en
gender: male
ageRange: middle
useCase: corporate-narrator
defaultStability: 0.7
defaultSimilarityBoost: 0.85
defaultSpeed: 1.0
sampleAudioUrl: <TBD>
description: <TBD>
```

#### 7. EN Conversational Female

```yaml
id: en-conv-female-01
voiceId: <TBD>
voiceName: <TBD>
language: en
gender: female
ageRange: young
useCase: vlog-conversational
defaultStability: 0.5
defaultSimilarityBoost: 0.75
defaultSpeed: 1.05
sampleAudioUrl: <TBD>
description: <TBD>
```

#### 8. EN Storytelling Narrator

```yaml
id: en-narrator-male-01
voiceId: <TBD>
voiceName: <TBD>
language: en
gender: male
ageRange: middle
useCase: storytelling-cinematic
defaultStability: 0.8
defaultSimilarityBoost: 0.9
defaultSpeed: 0.95
sampleAudioUrl: <TBD>
description: <TBD>
```

### Optional bonus voices

#### 9. VN Child / Kid voice (parents content có khi cần)

```yaml
id: vn-child-female-01
voiceId: <TBD - check ElevenLabs nếu có VN child voice>
voiceName: <TBD>
language: vi
gender: female
ageRange: child
useCase: kid-character
defaultStability: 0.5
defaultSimilarityBoost: 0.7
defaultSpeed: 1.0
sampleAudioUrl: <TBD>
description: <TBD - cho character avatar talking child>
```

#### 10. VN Asian-accent EN (anh muốn voice EN có VN accent cho VN-EN bilingual content?)

```yaml
id: vn-en-bilingual-01
voiceId: <TBD>
voiceName: <TBD>
language: en
gender: <TBD>
ageRange: <TBD>
useCase: bilingual-narrator
sampleAudioUrl: <TBD>
description: <TBD>
```

---

## Cost estimate

ElevenLabs pricing (as of 2026-05):
- **Creator tier $22/mo**: 100K chars/mo, 30+ premium voices, voice cloning
- **Pro tier $99/mo**: 500K chars/mo, 192K chars carryover

Per video:
- 30s ad ~80 words ~400 chars = $0.001 (Creator) - $0.0002 (Pro)
- 5min YouTube ~750 words ~3,750 chars = $0.011 (Creator) - $0.0019 (Pro)
- 100 videos/day = $0.10-1.10/day TTS cost

Anh đã add `ELEVENLABS_API_KEY` Doppler. Tier nào anh đang dùng?

---

## Voice cloning (Pro tier feature)

Per SCOPE.md §13 plugin "Clone giọng" (Max tier):
- User upload 1-3 minute audio sample
- ElevenLabs Instant Voice Cloning ($0.02 per clone)
- Generated voice ID save user's `cloned_voices[]` field
- Pro Workspace voice picker shows cloned voices + library voices

Anh confirm:
- Max tier only? Hay Pro tier cũng có clone?
- Quota: how many cloned voices per user? (ElevenLabs limit 10-50/account)

---

## Final checklist anh

- [ ] Login ElevenLabs marketplace
- [ ] Test 8-12 voices với VN/EN sample text
- [ ] Pick best voice ID per slot
- [ ] Fill `<TBD>` fields above
- [ ] Confirm tier + quota allocations
- [ ] Notify em → wire `packages/workflows/voice-library.ts` + Voice picker UI

---

## Em wire Sprint 2

Sau khi anh fill, em sẽ:
1. Generate sample audio mỗi voice (TTS the VN/EN sample text), upload R2 `pxs-vn-sg-derived/voice-samples/`
2. Voice picker UI shows:
   - Voice name + flag (VN/EN)
   - Age range badge
   - Use case tag
   - Click → preview sample audio
   - "Use this voice" button
3. Workflow templates reference voice IDs by `voice-library.ts` slug

Editor team có thể request thêm voices later, anh add vào library file → em ship Sprint 2.
