# Quick Create — Acceptance Criteria DRAFT

*Em draft, anh review + chốt. Phase 1 5/14-7/12 ship.*

> **Status**: Draft v0.1 by Claude. Anh edit → chốt v1.0 → em build to spec.

---

## v1.0 MVP scope (must-have ship Phase 1 internal alpha)

### Path A — Tạo từ ý tưởng (6 view)

#### View 1: Hero input

- [ ] Textarea 25K chars max ✓
- [ ] Placeholder: "Cho em một chủ đề, ngôn ngữ và mô tả chi tiết..."
- [ ] "Tạo video ✨" button (primary CTA)
- [ ] "Browse workflows" link (secondary)
- [ ] Mode toggle: "Từ video tham khảo" → switch to Path B
- [ ] Char counter (current/25,000)
- [ ] **Acceptance**: User type prompt + click → trigger View 2 Workflow picker

#### View 2: Workflow picker

- [ ] Display 8 workflows (Phase 1 v1):
  - Quảng cáo sản phẩm
  - UGC Senior 50+
  - Demo product
  - Reel ngắn
  - YouTube long
  - Storytelling cinematic
  - Tết bundle (seasonal lockout)
  - Script-to-Video
- [ ] Each workflow card shows: thumbnail + name + 1-line description + tier badge
- [ ] Tet bundle hidden if outside Dec 1 - Feb 28 (anh confirm in workflow form)
- [ ] Plugins section (Max tier only): Clone giọng, Brand kit, Stylization preset
- [ ] **Acceptance**: User pick workflow → trigger View 3 config modal

#### View 3: Workflow config modal

- [ ] Form workflow-specific (each workflow shows different fields per template)
- [ ] Fields universal:
  - Pace dropdown: slow / medium / fast
  - Topic textarea (~500 char)
  - Make the background music textarea (mood/genre prompt)
  - Language: vi / en (default workflow's defaultLanguage)
  - Style textarea
- [ ] Settings 5 numbered sections (per SCOPE.md §13):
  1. Voice gender + voice picker (from voice-library) + role + (+) add narrator
  2. Subtitle preferences (font / size / color / animation)
  3. Watermark text (default `PXL-XXXXX` 5-char user ID)
  4. Stock vendor pool (default per workflow.stockSources)
  5. Music source (Library / Uploaded radio)
- [ ] "Generate Outline" button → trigger View 4
- [ ] **Acceptance**: User completes form → outline generation 5-15s

#### View 4: Outline review

- [ ] Title card auto-generated (from prompt + workflow context)
- [ ] Chip selector 3 categories (per chip-content-form):
  - Audience (multi 1-3)
  - Look & Feel (multi 1-2)
  - Platform (single)
- [ ] "Dịch" button per chip section (translate VN ↔ EN labels)
- [ ] Edit title inline
- [ ] "Build Video" button → trigger View 5
- [ ] **Acceptance**: User confirms outline → build starts

#### View 5: Waiting/Build

- [ ] White card layout
- [ ] Top icons row 5 (per SCOPE.md):
  - X cancel
  - ✓ green status (current step)
  - slideshow preview
  - lightbulb hint
  - ⋮ more options
- [ ] Spinner (animated)
- [ ] Progress bar % (0-100)
- [ ] "Notify when ready" checkbox (push notification + email when done)
- [ ] Stages displayed:
  - Generating script
  - Synthesizing voice (ElevenLabs)
  - Matching stock media
  - Composing scenes
  - Rendering preview
- [ ] ETA estimate (e.g. "~2 minutes remaining")
- [ ] **Acceptance**: All 5 stages complete → trigger View 6 Editor

#### View 6: Editor 3-tab (main work surface)

##### Tab "Edit media"

- [ ] Scene strip top (horizontal scroll, click scene = jump timeline)
- [ ] Script display with highlight scene đang chọn
- [ ] Media browser dưới:
  - Tabs: Upload / iStock / Shutterstock / Envato
  - Premium 👑 badge per asset
  - Free badge per asset
  - Click multi-select assets
  - Replace button → trigger Trim Dialog if total > scene duration
- [ ] Scene duration adjustable slider, constraint: ≥ voice duration
- [ ] Voice always start from scene begin
- [ ] **Acceptance**: User can swap media in any scene

##### Tab "Edit script"

- [ ] Rows = scenes, each row has:
  - Editable text (textarea)
  - Media button (jump to scene's media in Tab 1)
  - Narrator button:
    - Speed slider 1.0x-2.0x (per SCOPE.md)
    - Checkbox "Apply to all scenes"
- [ ] Pause "(ngừng)" indicator between sentences
- [ ] "Apply Changes" button → regen TTS CHỈ scene đã thay đổi (incremental, save quota)
- [ ] **Acceptance**: User edit script → only changed scenes re-TTS

##### Tab "Edit music"

- [ ] Selected music card top với:
  - Track name + artist
  - Duration
  - Drag handle 2 đầu = trim start/end point
  - Play/pause preview
- [ ] Library list dưới:
  - Search bar
  - Premium toggle (filter premium tracks)
  - Genre filter
  - Mood filter
- [ ] Upload button (custom music)
- [ ] Auto-trim đoạn nhạc fit total video duration
- [ ] **Acceptance**: User pick music → preview + save

##### Common

- [ ] "Save Project" auto-save IndexedDB + cloud sync (debounced 5s)
- [ ] "Export" button → trigger Export view (different from build, this is final render)
- [ ] **Acceptance**: User can save project + export final video

#### Trim Dialog modal (across tabs)

- [ ] Scene timeline = scene duration limit
- [ ] Each clip:
  - Drag handle 2 đầu = trim
  - Drag ⋮⋮ = re-order
  - ✕ remove button
- [ ] Realtime preview top (canvas)
- [ ] OK / Cancel buttons
- [ ] **Acceptance**: User can fit multiple clips into 1 scene duration

### Path B — Reverse engineer từ video tham khảo

- [ ] User options:
  - Upload MP4 file (max 500MB)
  - Paste URL: YouTube, TikTok, Instagram Reel
- [ ] Backend pipeline (per SCOPE.md §13):
  1. Download + extract audio (FFmpeg)
  2. Tách cảnh (PySceneDetect)
  3. Tách audio 4-stem (Demucs htdemucs_ft)
  4. Transcribe voice (ElevenLabs Scribe VN, word-level + diarization)
  5. Identify music genre/mood (audio fingerprint - Chromaprint)
  6. Visual analysis từng cảnh (Gemini 2.5 Pro multimodal)
  7. Build editor state with scenes + script + music match
- [ ] Cost ~$0.07-0.10/phút reference video
- [ ] Quota: Standard 5min/mo, Pro 30min, Max 120min fair-use
- [ ] **Copyright safety**: Output là project file user edit, KHÔNG redistribute video gốc. Extract structure only.
- [ ] **Acceptance**: User upload video → 30-90s pipeline → Editor view 6 với scenes pre-populated

### Tier quotas v1

| Feature | Standard | Pro | Max |
|---|---|---|---|
| Quick Create projects/month | 10 | 100 | unlimited |
| Path B reverse engineer / month | 5 min | 30 min | 120 min fair-use |
| ElevenLabs TTS chars/mo | 10K | 100K | 500K |
| Stock library access | Free + 1 vendor | Free + 3 vendors | Free + 3 vendors + premium pool |
| AI image gen (Nano Banana) | 50/mo | 500/mo | 2000/mo |
| AI video gen (Veo3 + Seedance) | 0 | 30 min/mo | 120 min/mo |
| Voice cloning | ❌ | ❌ | 5 cloned voices |
| Brand kit upload | ❌ | 1 kit | 5 kits |
| Cloud storage | 5 GB | 50 GB | 200 GB |
| Watermark removable | ❌ | ✅ | ✅ |

→ Anh confirm hoặc adjust quotas based on cost analysis.

---

## v1.1 nice-to-have (Phase 1 Sprint 4-5)

- [ ] Workflow plugins (Max only): Clone giọng, Brand kit, Stylization preset
- [ ] Multi-narrator (2+ voices alternating per scene)
- [ ] Script translate (VN ↔ EN inline)
- [ ] Export presets per platform (TikTok auto-format, IG Reels, etc.)
- [ ] Project templates (anh save current as template)
- [ ] Collaboration: invite editor (read-only Phase 1, edit Phase 3 Yjs)

---

## v2.0 future scope (Phase 2-3, defer)

- [ ] Yjs CRDT collab (Phase 3 with chaos fuzzing 1000 simulated edits)
- [ ] Custom workflow builder (user define new workflow)
- [ ] AI directorial mode (em decide pace + cuts based on emotion analysis)
- [ ] Auto A/B variant generation (3 variants from same prompt)
- [ ] Stock library admin UI (Phase 2 Day 6 deferred)

---

## Out of scope v1.0 (don't build)

- ❌ Live streaming integration
- ❌ Real-time collab (defer Phase 3)
- ❌ Mobile app (web responsive only)
- ❌ Video trimmer outside Quick Create (use Pro Workspace direct)
- ❌ Audio-only podcast mode (video-first product)
- ❌ Free tier (chốt SCOPE.md — không có Free)

---

## Definition of Done v1.0

PixStudio Editor team migrate ≥80% daily creative from CapCut sang PixStudio Quick Create within 4 weeks of Phase 1 launch (per SCOPE.md §14 KPI).

Sub-KPIs:
- [ ] Time-to-first-video < 5 minutes (prompt → exportable MP4)
- [ ] User satisfaction > 4/5 in internal alpha survey
- [ ] Path A success rate > 80% (no error/abort)
- [ ] Path B success rate > 70% (failure modes: copyright detection, low audio quality, etc.)

---

## Anh review checklist

- [ ] Verify 6-view scope appropriate (cut nice-to-have if too aggressive Phase 1?)
- [ ] Tier quota numbers acceptable based on cost projections
- [ ] Workflow priorities: 8 all v1.0 hoặc cut to 4-5?
- [ ] Path B v1.0 must-have hoặc defer Phase 2?
- [ ] Editor team test plan: anh assign N editors? When start internal alpha?

Khi anh chốt v1.0 scope final, em wire backlog cụ thể vào Linear/GitHub Projects.
