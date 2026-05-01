# Quick Create — 8 Workflow Templates Form

*Anh fill mỗi template để em wire vào workflow registry. Form pattern theo SCOPE.md §13 + InVideo AI v2.0 reference.*

> **How to use**: Edit từng section dưới — replace placeholder `<TBD>` với content cụ thể. Khi xong, anh ping em → em load vào `packages/workflows/templates/*.ts` registry + Quick Create UI surface.

## Common fields cho mọi workflow

Mỗi workflow extends base config:

```typescript
interface WorkflowTemplate {
  id: string;                    // unique slug e.g. "ad-product-vn"
  name: string;                  // display VN
  nameEn: string;                // display EN
  description: string;           // 1-line VN
  thumbnail: string;             // R2 URL preview image
  pace: "slow" | "medium" | "fast";  // default scene cut speed
  defaultLanguage: "vi" | "en";
  platform: PlatformPreset;      // ratio + duration
  voice: VoicePreset;            // ElevenLabs voice ID
  subtitleStyle: SubtitleStyle;  // font + size + color + animation
  watermarkPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "none";
  stockSources: StockSource[];   // priority order: iStock, Envato, Shutter
  musicSourcePolicy: "library-only" | "library-or-uploaded" | "auto-generate";
  samplePrompts: string[];       // 3-5 example anh's customer flow
  requiredTier: "standard" | "pro" | "max";
}

interface PlatformPreset {
  ratio: "9:16" | "16:9" | "1:1" | "4:5";
  minDurationSec: number;
  maxDurationSec: number;
  defaultDurationSec: number;
}

interface VoicePreset {
  voiceId: string;            // ElevenLabs voice ID
  voiceName: string;          // display
  speed: number;              // 0.5-2.0, default 1.0
  stability: number;          // 0-1
  similarityBoost: number;    // 0-1
}

interface SubtitleStyle {
  font: "Inter" | "Bebas Neue" | "Montserrat" | "Pacifico" | "Noto Sans VN";
  fontSize: number;           // px
  fontColor: string;          // hex
  strokeColor: string;        // hex
  strokeWidth: number;
  animation: "fade-in" | "scale-pop" | "typewriter" | "slide-up" | "none";
  position: "bottom" | "center" | "top";
}
```

---

## Workflow 1: Quảng cáo sản phẩm

```yaml
id: ad-product-vn
name: Quảng cáo sản phẩm
nameEn: Product Ad
description: <TBD anh điền 1 line>
thumbnail: <TBD R2 path - em sẽ tạo bucket /workflows/thumbnails/>
pace: <TBD slow|medium|fast>
defaultLanguage: vi
platform:
  ratio: <TBD 9:16 hoặc 1:1>
  minDurationSec: <TBD>
  maxDurationSec: <TBD>
  defaultDurationSec: <TBD>
voice:
  voiceId: <TBD ElevenLabs voice ID>
  voiceName: <TBD>
  speed: <TBD 0.95-1.05>
  stability: <TBD 0.5>
  similarityBoost: <TBD 0.75>
subtitleStyle:
  font: <TBD>
  fontSize: <TBD>
  fontColor: '#FFFFFF'
  strokeColor: '#000000'
  strokeWidth: 2
  animation: <TBD>
  position: bottom
watermarkPosition: <TBD>
stockSources: [iStock, Envato, Shutterstock]
musicSourcePolicy: <TBD>
samplePrompts:
  - <TBD example 1>
  - <TBD example 2>
  - <TBD example 3>
requiredTier: standard
```

**Anh note**: Đây là workflow primary cho creator chạy ads FB/TikTok. Hiện Crossian + đối tác làm 30s-60s 9:16 chính. Anh confirm spec.

---

## Workflow 2: UGC Senior 50+

```yaml
id: ugc-senior-vn
name: UGC Senior 50+
nameEn: UGC Senior 50+
description: <TBD>
thumbnail: <TBD>
pace: <TBD slow recommended cho senior audience>
defaultLanguage: vi
platform:
  ratio: <TBD>
  minDurationSec: <TBD>
  maxDurationSec: <TBD>
  defaultDurationSec: <TBD>
voice:
  voiceId: <TBD - cần ElevenLabs voice senior tone, anh test marketplace pick>
  voiceName: <TBD>
  speed: <TBD chậm hơn default, e.g. 0.85>
  stability: <TBD>
  similarityBoost: <TBD>
subtitleStyle:
  font: <TBD - large readable cho senior>
  fontSize: <TBD - bigger than default>
  fontColor: '#FFFFFF'
  strokeColor: '#000000'
  strokeWidth: 3
  animation: <TBD - simple fade tránh complex>
  position: bottom
watermarkPosition: <TBD>
stockSources: [iStock, Envato]
musicSourcePolicy: <TBD>
samplePrompts:
  - <TBD VN senior product example>
  - <TBD>
  - <TBD>
requiredTier: standard
```

**Anh note**: Senior 50+ VN segment. Crossian có data từ ads campaigns. Pace chậm hơn, voice trầm hơn.

---

## Workflow 3: Demo product

```yaml
id: demo-product
name: Demo sản phẩm
nameEn: Product Demo
description: <TBD>
thumbnail: <TBD>
pace: medium
defaultLanguage: vi
platform:
  ratio: <TBD 16:9 cho YouTube hay 9:16 reel?>
  minDurationSec: 30
  maxDurationSec: 90
  defaultDurationSec: 60
voice:
  voiceId: <TBD clear professional voice>
  voiceName: <TBD>
  speed: 1.0
  stability: 0.6
  similarityBoost: 0.8
subtitleStyle:
  font: <TBD>
  fontSize: <TBD>
  fontColor: '#FFFFFF'
  strokeColor: '#000000'
  strokeWidth: 2
  animation: <TBD>
  position: bottom
watermarkPosition: <TBD>
stockSources: [Shutterstock, iStock]
musicSourcePolicy: <TBD>
samplePrompts:
  - <TBD>
  - <TBD>
  - <TBD>
requiredTier: standard
```

---

## Workflow 4: Reel ngắn (TikTok / Shorts hook 3s)

```yaml
id: reel-hook-3s
name: Reel ngắn (Hook 3s)
nameEn: Short Reel (3s hook)
description: <TBD>
thumbnail: <TBD>
pace: fast
defaultLanguage: vi
platform:
  ratio: 9:16
  minDurationSec: 7
  maxDurationSec: 60
  defaultDurationSec: 15
voice:
  voiceId: <TBD trẻ trung Gen Z tone>
  voiceName: <TBD>
  speed: 1.1
  stability: 0.4
  similarityBoost: 0.7
subtitleStyle:
  font: <TBD bold trendy font>
  fontSize: <TBD large cho mobile>
  fontColor: '#FFFFFF'
  strokeColor: '#000000'
  strokeWidth: 2
  animation: scale-pop
  position: center
watermarkPosition: top-right
stockSources: [Envato, iStock]
musicSourcePolicy: library-only
samplePrompts:
  - <TBD trending hook examples>
  - <TBD>
  - <TBD>
requiredTier: standard
```

**Anh note**: Music beat-sync recommend, em wire BPM detection vào timeline auto-cut on beat.

---

## Workflow 5: YouTube long (5-15 phút)

```yaml
id: youtube-long
name: YouTube long
nameEn: YouTube Long-form
description: <TBD>
thumbnail: <TBD>
pace: medium
defaultLanguage: <TBD vi or en>
platform:
  ratio: 16:9
  minDurationSec: 300    # 5 min
  maxDurationSec: 900    # 15 min
  defaultDurationSec: 600
voice:
  voiceId: <TBD narrator voice>
  voiceName: <TBD>
  speed: 1.0
  stability: 0.7
  similarityBoost: 0.85
subtitleStyle:
  font: <TBD>
  fontSize: <TBD>
  fontColor: '#FFFFFF'
  strokeColor: '#000000'
  strokeWidth: 1
  animation: fade-in
  position: bottom
watermarkPosition: <TBD>
stockSources: [Shutterstock, iStock, Envato]
musicSourcePolicy: library-or-uploaded
samplePrompts:
  - <TBD>
  - <TBD>
  - <TBD>
requiredTier: pro
chapterMarkers: true   # YouTube chapter markers in description
introOutro: true       # auto-generate intro 5s + outro 10s
```

---

## Workflow 6: Storytelling cinematic

```yaml
id: storytelling-cinematic
name: Storytelling Cinematic
nameEn: Storytelling Cinematic
description: <TBD>
thumbnail: <TBD>
pace: <TBD slow recommended cho cinematic feel>
defaultLanguage: <TBD>
platform:
  ratio: <TBD 16:9 hoặc 21:9 cinematic ratio?>
  minDurationSec: 60
  maxDurationSec: 300
  defaultDurationSec: 120
voice:
  voiceId: <TBD dramatic narrator>
  voiceName: <TBD>
  speed: 0.95
  stability: 0.8
  similarityBoost: 0.85
subtitleStyle:
  font: <TBD elegant serif>
  fontSize: <TBD>
  fontColor: <TBD>
  strokeColor: <TBD>
  strokeWidth: <TBD>
  animation: <TBD>
  position: bottom
watermarkPosition: <TBD - cinematic often no watermark>
stockSources: [Shutterstock, iStock]
musicSourcePolicy: library-only
samplePrompts:
  - <TBD>
  - <TBD>
  - <TBD>
requiredTier: pro
visualStyle:
  lut: <TBD cinematic LUT preset name e.g. "Teal-Orange" "Bleach Bypass">
  letterbox: true       # add black bars top/bottom for 21:9 effect
  filmGrain: <TBD level>
```

---

## Workflow 7: Tết bundle (VN holiday)

```yaml
id: tet-bundle-vn
name: Tết bundle
nameEn: Lunar New Year Bundle
description: <TBD>
thumbnail: <TBD - tết themed>
pace: medium
defaultLanguage: vi
platform:
  ratio: 9:16
  minDurationSec: 15
  maxDurationSec: 60
  defaultDurationSec: 30
voice:
  voiceId: <TBD VN tone tươi vui>
  voiceName: <TBD>
  speed: 1.0
  stability: 0.5
  similarityBoost: 0.75
subtitleStyle:
  font: <TBD - tết feel ưu tiên Pacifico hoặc decorative font?>
  fontSize: <TBD>
  fontColor: '#FFD700'   # gold tone
  strokeColor: '#A30000' # red tone
  strokeWidth: 2
  animation: scale-pop
  position: center
watermarkPosition: <TBD>
stockSources: [iStock-tet-pool, Envato-tet-pool]
musicSourcePolicy: library-only
musicLibraryFilter:
  genre: ["traditional-vn", "celebration"]
  mood: ["happy", "festive"]
samplePrompts:
  - <TBD tết product gift example>
  - <TBD tết family scene>
  - <TBD>
requiredTier: standard
seasonalLockout:
  startMonth: 12  # December
  endMonth: 2     # February
  # Workflow chỉ active 12/1 → 2/28 each year (anh confirm)
```

**Anh note**: Cần stock pool riêng cho Tết content (lì xì, hoa mai, bánh chưng, áo dài...). Anh setup curated pool trong admin Stock Library Day 6 Sprint 2.

---

## Workflow 8: Script-to-Video

```yaml
id: script-to-video
name: Script-to-Video
nameEn: Script to Video
description: <TBD - paste script và auto cut scenes>
thumbnail: <TBD>
pace: medium
defaultLanguage: <TBD>
platform:
  ratio: <TBD>
  minDurationSec: 15
  maxDurationSec: 600
  defaultDurationSec: <calculated from script length>
voice:
  voiceId: <TBD default, user override common>
  voiceName: <TBD>
  speed: 1.0
  stability: 0.6
  similarityBoost: 0.8
subtitleStyle:
  font: <TBD>
  fontSize: <TBD>
  fontColor: '#FFFFFF'
  strokeColor: '#000000'
  strokeWidth: 2
  animation: typewriter
  position: bottom
watermarkPosition: <TBD>
stockSources: [Envato, iStock, Shutterstock]
musicSourcePolicy: library-or-uploaded
samplePrompts:
  - "<TBD example script paste>"
inputMode: script-paste  # different from other workflows (no topic prompt, paste script directly)
sceneSplitStrategy: sentence  # sentence | paragraph | manual-markers
maxScriptLength: 25000  # 25K chars matching textarea limit
requiredTier: pro
```

**Anh note**: Workflow đặc biệt — anh input script raw, em parse scene boundaries (sentence-level), gen scenes auto. User edit script → em regen affected scenes only (incremental TTS).

---

## Reference: ElevenLabs voice ID research

Anh dùng list `quick-create-voice-library-form.md` (sibling doc) để pick voice IDs. Mỗi workflow reference vào voice library entry.

## Reference: Stock library admin pool

Stock sources `iStock`, `Envato`, `Shutterstock` map vào admin pool em sẽ wire Sprint 2. Mỗi pool có 5-7 accounts rotation theo daily quota.

## Final checklist anh

- [ ] 8 workflows mỗi cái fill `<TBD>` → cụ thể value
- [ ] 8 thumbnails (anh design hoặc em gen via Nano Banana — anh confirm sources)
- [ ] Music library license deal (Epidemic Sound / Artlist / etc.)
- [ ] Stock library admin accounts mua + add Doppler
- [ ] ElevenLabs voice IDs research (5-10 voices) → fill voice-library-form.md
- [ ] Acceptance criteria confirm draft

Khi xong 1 workflow đầu tiên, anh ping em → em wire `packages/workflows/templates/ad-product-vn.ts` làm sample, anh review pattern xong fill 7 workflows còn lại theo template đó.
