# Quick Create — Music Library (FREE Sources)

*Updated 2026-05-02 per anh feedback #7: skip Epidemic/Artlist paid licensed deal. Use FREE sources: Facebook Music for Creators + TikTok Creative Center music library.*

---

## Source #1: Facebook Music for Creators

### Reference
- Docs: https://developers.facebook.com/docs/video-api/guides/music-recommendations/
- Music Library: Built-in Facebook Sound Collection
- License: Free for use in content posted to Facebook + Instagram (and per Meta TOS for off-platform if specified)

### Access methods

**Option A — Facebook Sound Collection (web browse, manual download):**
- URL: https://business.facebook.com/creatorstudio/?tab=ie_sound_collection
- Browse 7,000+ tracks + 7,000+ sound effects
- Download MP3 directly, license auto-attached for FB/IG use
- Anh có thể manual curate top 200-500 tracks → upload R2 bucket `pxs-vn-sg-derived/music/fb/`

**Option B — Music Recommendations API (programmatic, requires Music Library license):**
- Endpoint: `GET /{music-asset-id}` and `POST /{video-id}` to attach music
- Used for assigning Facebook-licensed music to video uploads
- ⚠️ This API is for tagging music with FB videos, NOT downloading music files
- Limited to FB-published videos — không phù hợp PixStudio independent player

### Decision

Em recommend **Option A manual curation**:
1. Anh hoặc team browse FB Sound Collection
2. Pick 200-500 tracks across genres (cinematic, lo-fi, ad, etc.)
3. Download + upload R2 với metadata
4. Tag mỗi track: genre, mood, BPM, duration, license (FB Sound Collection)
5. Em build admin UI Sprint 5 để upload + tag

License compliance: FB Sound Collection terms allow download + use khi nội dung đăng FB/IG. Khi user export PixStudio → đăng platform khác (TikTok, YouTube), need verify each track's specific license. Some FB tracks support multi-platform, others restrict to FB/IG.

**Anh confirm**: PixStudio document license clearly per track + show user warning trước khi export sang non-FB/IG platform.

## Source #2: TikTok Creative Center

### Reference
- URL: https://ads.tiktok.com/business/creativecenter/music/pc/en
- Hub for trending TikTok ads music
- License: TikTok Commercial Music Library (free for ads on TikTok platform)

### Access

TikTok Creative Center có web browse only — không public API. Web scrape là option nhưng có rủi ro TOS violation + brittle.

**Decision**: Manual curation pattern same as FB:
1. Anh browse TikTok Creative Center top trending songs weekly
2. Pick top 50-100 tracks across regions (VN, US, global)
3. Verify each track license terms (some Creative Center songs require TikTok ad use only)
4. Download via TikTok Creative Center download button
5. Upload R2 với metadata + license note

**Caveat**: TikTok Commercial Music Library license restricts use to TikTok ads platform. If user exports PixStudio video for use elsewhere (FB, YouTube, paid TV), the track may not be licensed.

## Source #3 (bonus): YouTube Audio Library

### Reference
- URL: https://studio.youtube.com/channel/UC.../music (need YouTube Studio access)
- 7,000+ free tracks + 1,500 sound effects
- License: Most tracks usable across platforms (some require attribution)

YouTube Audio Library is broader license than FB/TikTok — many tracks are CC-BY or full royalty-free. Better than FB/TikTok for cross-platform use.

**Recommend add**: Anh có YouTube channel? Login YouTube Studio, manual curate top 200 tracks.

## Source #4 (alternative): Free Music Archive

### Reference
- URL: https://freemusicarchive.org/
- Open API: https://github.com/dakami/freemusicarchive (community wrapper)
- License: Mix of CC-BY, CC-BY-SA, CC0, public domain (filter at search)

FMA có public API để programmatic search + download. Most accessible for PixStudio:
1. PixStudio integrates FMA search API as fallback
2. User pick "Browse free music" → query FMA
3. Filter by Creative Commons license type
4. Download to R2 cache cho project

Tradeoff: FMA library smaller than FB/TikTok and less curated. Quality varies. Best as supplemental.

---

## Implementation plan (Phase 1 Sprint 4)

### Schema (Prisma additions)

```prisma
enum MusicLicense {
  FB_SOUND_COLLECTION       // free for FB/IG, may restrict elsewhere
  TIKTOK_CREATIVE_CENTER    // free for TikTok ads
  YOUTUBE_AUDIO_LIBRARY     // most tracks cross-platform
  CC_BY                     // attribution required
  CC_BY_SA                  // attribution + share-alike
  CC0                       // public domain
  USER_UPLOAD               // user provides own license
}

enum MusicGenre {
  CINEMATIC
  LO_FI
  POP
  ROCK
  ELECTRONIC
  AMBIENT
  ORCHESTRAL
  TRAP
  HOUSE
  COUNTRY
  RNB
  JAZZ
  CLASSICAL
  TRADITIONAL_VN
  WORLD
}

enum MusicMood {
  HAPPY
  SAD
  EPIC
  CALM
  ENERGETIC
  ROMANTIC
  TENSE
  PLAYFUL
  MELANCHOLY
  DRAMATIC
}

model MusicTrack {
  id              String       @id @default(uuid())
  title           String
  artist          String
  album           String?
  durationSec     Float
  bpm             Int?
  genre           MusicGenre
  mood            MusicMood
  license         MusicLicense
  licenseNote     String?      // human-readable license terms
  source          String       // "FB", "TikTok", "YT", "FMA", "user_upload"
  sourceUrl       String?      // original page URL for attribution
  r2Key           String       // pxs-vn-sg-derived/music/...
  waveformR2Key   String?      // pre-generated waveform PNG for UI scrubber
  fingerprintHash String?      // Chromaprint hash for Path B music match
  tags            String[]     // free-form tags: ["upbeat", "viral", "VN", ...]
  popularityScore Float        @default(0)
  active          Boolean      @default(true)
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@index([genre, mood])
  @@index([popularityScore])
  @@index([source, active])
  @@map("music_tracks")
}
```

### API endpoints (Phase 1 Sprint 4)

```
GET  /api/music?genre=cinematic&mood=epic&durationMin=30&durationMax=120&page=1
     → list tracks filtered, paginated 20/page

GET  /api/music/:id
     → full metadata + presigned R2 URL for stream

GET  /api/music/:id/waveform
     → presigned R2 URL for waveform PNG (pre-generated)

POST /api/music/upload (Pro+ tier)
     → user uploads custom track to project
     → assigns license=USER_UPLOAD, user takes responsibility

GET  /api/music/match
     query: { genre, mood, durationSec, bpm? }
     → recommendation engine: pick best fit for given constraints
     → used by Quick Create build pipeline (workflow auto-pick music)
```

### Admin curation UI (Sprint 5)

```
Admin Settings → Music Library
- "Add track" button → upload form:
  - File upload MP3/WAV
  - Title, artist, album, BPM
  - Genre dropdown, mood dropdown
  - License dropdown + license note text
  - Source dropdown
  - Tags free-form
  - "Auto-extract metadata" button (FFprobe + Chromaprint)
- Bulk import CSV
- Edit existing tracks
- Toggle active/inactive
- Preview play with waveform scrubber
```

### Music recommendation engine (Sprint 4-5)

Algorithm `POST /api/music/match`:
```typescript
async function matchMusic(criteria: MatchCriteria): Promise<MusicTrack[]> {
  // 1. Filter by required (genre, mood, license compatible with target platform)
  // 2. Filter by duration window (target ±10%)
  // 3. Optional BPM filter (±5 BPM)
  // 4. Sort by popularityScore descending
  // 5. Return top 5 candidates
  // User picks one in UI, OR Quick Create auto-picks #1
}
```

For Path B reverse engineer pipeline, replace match step:
```typescript
// Use Chromaprint fingerprint hash to find similar PixStudio tracks
async function findSimilarMusic(referenceFingerprint: string): Promise<MusicTrack[]> {
  // Query MusicTrack where fingerprint hamming distance < threshold
  // Returns top 3 candidates
}
```

## Cost estimate

| Item | Cost |
|---|---|
| FB Sound Collection (manual curate 500 tracks) | $0 (free) |
| TikTok Creative Center (50 tracks) | $0 (free) |
| YouTube Audio Library (200 tracks) | $0 (free) |
| FMA API integration | $0 (free) |
| R2 storage for 750 tracks × 5MB avg = 3.75GB | ~$0.05/month |
| Bandwidth for 1000 user previews/day × 30s × 256kbps = ~30GB/mo | ~$0.45/month (R2 free tier 10GB egress) |
| Chromaprint server (for fingerprinting Sprint 5) | $0 (open source, runs on Fly.io VM) |

**Total monthly music infrastructure: <$1/month** (vs Epidemic Sound $20-30/mo per user OR Artlist $250-500/year).

## Anh action items

- [ ] Decide: FB + TikTok + YT manual curation phase 1 (5-10h work) OR FMA programmatic only (faster but smaller library)
- [ ] Verify license compliance: confirm okay use FB Sound Collection for off-FB platforms (need legal check)
- [ ] Designate team member for music curation (anh hay marketing team Tùng?)
- [ ] Review PixStudio export warning UI: show track license restrictions when user exports

Em recommend **mix approach**:
- 200 FB Sound Collection tracks (most commercial-friendly)
- 50 TikTok Creative Center hot trending (VN-specific)
- 200 YouTube Audio Library (broadest cross-platform)
- FMA API search dropdown cho user explore extra (Pro+ tier)

Total ~450 curated + unlimited FMA browse = covers Phase 1 needs cho ~99% creator workflows.

---

## Reference

- FB Sound Collection: https://business.facebook.com/creatorstudio/
- FB Music API guide: https://developers.facebook.com/docs/video-api/guides/music-recommendations/
- TikTok Creative Center: https://ads.tiktok.com/business/creativecenter/music/pc/en
- YouTube Audio Library: https://studio.youtube.com (channel-specific URL)
- Free Music Archive: https://freemusicarchive.org/
- Chromaprint (audio fingerprinting): https://acoustid.org/chromaprint
