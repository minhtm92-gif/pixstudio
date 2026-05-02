# PixStudio Phase 1 Backlog (5/14 → 7/12, 8 weeks)

*Author: Claude (autonomous overnight 2026-05-02). Anh review + prioritize before Sprint 1 kickoff.*

> **Phase 1 goal**: Editor team migrate ≥80% daily creative from CapCut to PixStudio Pro Workspace + Quick Create v1.0 (per SCOPE.md §14).
>
> **Phase 0 completed**: 13 commits + 8 AI providers + Postgres + Prisma + R2 + better-auth + Vercel/Fly.io production live (2026-05-02).

## Sprint cadence

| Sprint | Week | Theme | Demo target |
|---|---|---|---|
| 1 | 5/14-5/20 | Quick Create Path A foundation | View 1+2+3 functional |
| 2 | 5/21-5/27 | Quick Create Path A wire AI mesh | View 4+5 generate working |
| 3 | 5/28-6/3 | Pro Workspace polish + Editor migration | Editor team start daily PixStudio |
| 4 | 6/4-6/10 | Quick Create Editor view + Path B scaffold | View 6 3-tab functional |
| 5 | 6/11-6/17 | Path B GPU pipeline + admin stock library | Reverse engineer pipeline working |
| 6 | 6/18-6/24 | Tier quotas + billing prep + Crossian RAG | Tier system enforced |
| 7 | 6/25-7/1 | Internal alpha + bug bash | KPI tracking dashboard |
| 8 | 7/2-7/8 | Migration KPI achieve + Phase 2 plan | ≥80% Editor team daily |
| Buffer | 7/9-7/12 | Polish + Phase 2 kickoff | Phase 1 close |

---

## EPIC 1: Quick Create Path A (8 workflows)

**Goal**: Single-prompt → exportable video MP4 in <5 min (acceptance criteria DoD).

### Sprint 1: Foundation (5/14-5/20)

#### Story 1.1 — Quick Create Hero View (View 1)
- **As** Creator (Editor team)
- **I want** type ý tưởng vào textarea + chọn workflow
- **So that** start video generation in 1 click
- **Acceptance**:
  - [ ] Textarea 25K char limit + counter
  - [ ] "Tạo video ✨" CTA primary blue PXL
  - [ ] "Browse workflows" link → View 2
  - [ ] Mode toggle "Từ video tham khảo" → Path B (defer Sprint 5)
  - [ ] Loading state when click CTA
- **Depends on**: None
- **ETA**: 2 days
- **Risk**: Low (new component, no AI calls)
- **Files**: `apps/web/src/app/quick-create/page.tsx`, `packages/quick-create/HeroView.tsx`

#### Story 1.2 — Workflow Picker View (View 2)
- **As** Creator
- **I want** browse 8 workflows + pick one
- **So that** get tuned settings cho content type
- **Acceptance**:
  - [ ] 8 workflow cards: thumbnail + name + tier badge
  - [ ] Hover preview gif (optional Phase 1.5)
  - [ ] Tet bundle hidden outside Dec-Feb (seasonalLockout check)
  - [ ] Plugins section Max tier only
  - [ ] Click → View 3 config modal
- **Depends on**: 1.1, workflow registry from `packages/workflows/templates/*`
- **ETA**: 2 days
- **Risk**: Medium (anh content phải sẵn sàng before)
- **Files**: `packages/quick-create/WorkflowPickerView.tsx`, `packages/workflows/templates/*.ts`

#### Story 1.3 — Workflow Config Modal (View 3)
- **As** Creator
- **I want** customize voice/subtitle/watermark/stock/music settings
- **So that** override defaults per project
- **Acceptance**:
  - [ ] Form workflow-specific (each template renders different fields)
  - [ ] 5 numbered settings per SCOPE.md §13
  - [ ] Voice picker uses `voice-library` registry
  - [ ] "Generate Outline" CTA
  - [ ] Save form state Zustand store
- **Depends on**: 1.2, voice-library, chip-registry
- **ETA**: 3 days
- **Risk**: Medium (UI complexity)
- **Files**: `packages/quick-create/ConfigModal.tsx`, voice-library/, chips/

#### Story 1.4 — Workflow Registry Pattern
- **As** Engineer
- **I want** plugin-style workflow registry
- **So that** add new workflow = new file (no hub change)
- **Acceptance**:
  - [ ] `packages/workflows/types.ts` defines `WorkflowTemplate` interface
  - [ ] `packages/workflows/templates/` folder with 8 .ts files
  - [ ] `packages/workflows/registry.ts` auto-load all templates
  - [ ] Hot reload dev (Vite watch)
- **Depends on**: None
- **ETA**: 1 day
- **Risk**: Low
- **Files**: `packages/workflows/*`

### Sprint 2: AI mesh wire-up (5/21-5/27)

#### Story 1.5 — Outline Generation Service
- **As** Creator
- **I want** my prompt → AI-generated title + scene outline + chip suggestions
- **So that** preview structure before commit to full build
- **Acceptance**:
  - [ ] `POST /api/quick-create/outline` accepts prompt + workflow + config
  - [ ] DO Inference Engine call generates: title, 3-8 scene outline, suggested chips
  - [ ] Response time <15s (p95)
  - [ ] Cost <$0.01/outline
  - [ ] Returns structured JSON parsable by View 4
- **Depends on**: 1.4 workflow registry, ai-mesh provider
- **ETA**: 3 days
- **Risk**: High (LLM prompt engineering critical)
- **Files**: `apps/api/src/routes/quick-create.ts`, `packages/quick-create/services/outline.ts`

#### Story 1.6 — Outline Review View (View 4)
- **As** Creator
- **I want** edit title + pick chips Audience/Look&Feel/Platform
- **So that** refine output before build
- **Acceptance**:
  - [ ] Title editable inline
  - [ ] Chip selectors with search filter
  - [ ] "Dịch" per-section toggle VN ↔ EN
  - [ ] "Build Video" CTA → trigger View 5
- **Depends on**: 1.5, chip-content-form
- **ETA**: 2 days
- **Risk**: Medium
- **Files**: `packages/quick-create/OutlineView.tsx`

#### Story 1.7 — Build View Progress UI (View 5)
- **As** Creator
- **I want** see live progress as video being built
- **So that** know how long left + can multitask
- **Acceptance**:
  - [ ] White card + spinner + progress bar %
  - [ ] 5 stages displayed sequentially
  - [ ] ETA estimate (recalc per stage)
  - [ ] "Notify when ready" checkbox (push notif + email)
  - [ ] Cancel button (pre-stage 3 only, after that costs incurred)
  - [ ] WebSocket updates via Fastify ws plugin
- **Depends on**: 1.6, BullMQ queue infra
- **ETA**: 3 days
- **Risk**: Medium (real-time WebSocket)
- **Files**: `packages/quick-create/BuildView.tsx`, `apps/api/src/routes/quick-create-ws.ts`

#### Story 1.8 — Build Pipeline Backend
- **As** System
- **I need** queue + worker pipeline for video build
- **So that** scale concurrent users
- **Acceptance**:
  - [ ] BullMQ queue `quick-create-build`
  - [ ] Worker process steps: script → tts → stock match → compose → render
  - [ ] Progress events emit to WebSocket
  - [ ] Retry policy: max 3 retries, exponential backoff
  - [ ] DLQ for failed jobs
- **Depends on**: Upstash Redis (Phase 0 done)
- **ETA**: 4 days
- **Risk**: High (queue infra critical path)
- **Files**: `apps/api/src/workers/quick-create-build.worker.ts`, `packages/queue/*`

### Sprint 3-4: Editor view (5/28-6/10)

#### Story 1.9 — Editor 3-tab "Edit media" (View 6 Tab 1)
- Scene strip + script display + media browser + replace flow
- **ETA**: 5 days, **Risk**: High (compositor integration)

#### Story 1.10 — Editor 3-tab "Edit script" (View 6 Tab 2)
- Editable rows + narrator settings + incremental TTS regen
- **ETA**: 4 days, **Risk**: Medium

#### Story 1.11 — Editor 3-tab "Edit music" (View 6 Tab 3)
- Selected music card + library + auto-trim
- **ETA**: 3 days, **Risk**: Low (after music library deal)

#### Story 1.12 — Trim Dialog modal
- Multi-clip per scene + drag handles + reorder
- **ETA**: 3 days, **Risk**: Medium

---

## EPIC 2: Path B Reverse Engineer Pipeline

### Sprint 5: GPU pipeline (6/11-6/17)

#### Story 2.1 — Video Download + Audio Extract (FFmpeg)
- **Acceptance**: Accept MP4 upload OR URL (YouTube/TikTok/IG), extract audio WAV 48kHz
- **ETA**: 2 days, **Risk**: Medium (URL extraction libs change frequently — yt-dlp wrapper)
- **Cost per video**: ~$0 (FFmpeg local on GPU spawn)

#### Story 2.2 — Scene Detection (PySceneDetect)
- **Acceptance**: 30s video → 5-15 scenes JSON with start/end timestamps
- **ETA**: 1 day, **Risk**: Low

#### Story 2.3 — Audio Stem Separation (Demucs htdemucs_ft)
- **Acceptance**: 4-stem split: voice / drums / bass / other
- **ETA**: 2 days, **Risk**: Medium (GPU memory mgmt)
- **Cost per video**: ~$0.005 (Demucs on RTX 6000 ~30s for 60s audio)

#### Story 2.4 — Voice Transcription (ElevenLabs Scribe)
- **Acceptance**: Word-level timestamps + speaker diarization (2 speakers)
- **ETA**: 1 day, **Risk**: Low (API call)
- **Cost per video**: ~$0.02-0.04/min

#### Story 2.5 — Music Genre/Mood Identification (Chromaprint)
- **Acceptance**: Match against PixStudio music library, return top 3 candidates
- **ETA**: 2 days, **Risk**: High (fingerprint accuracy)
- **Cost per video**: ~$0 (local lib)

#### Story 2.6 — Visual Scene Analysis (Gemini 2.5 Pro multimodal)
- **Acceptance**: Per scene, output: tone (warm/cool/neutral) + color palette (3 colors) + style (vlog/cinematic/ad) + dominant objects (5 max) + emotion
- **ETA**: 3 days, **Risk**: Medium (prompt engineering)
- **Cost per video**: ~$0.03-0.05 (Gemini multimodal × 10 scenes)

#### Story 2.7 — Editor State Builder
- **Acceptance**: Combine all pipeline outputs into project JSON ready for Editor view
- **ETA**: 3 days, **Risk**: High (data integration complexity)

#### Story 2.8 — GPU Spawn Orchestration
- **Acceptance**: Auto-spawn DO L40S/RTX 6000 from snapshot when Path B job triggered, destroy 30min idle
- **ETA**: 2 days, **Risk**: Medium (DO API + worker coordination)

---

## EPIC 3: Pro Workspace Polish (Editor migration)

### Sprint 3: Migration prep (5/28-6/3)

#### Story 3.1 — Brand kit upload (Pro+ tier)
- Logo + color palette + font preferences saved per workspace
- **ETA**: 3 days, **Risk**: Low

#### Story 3.2 — Project list cloud sync
- IndexedDB → Postgres bidirectional sync (last-write-wins simple)
- **ETA**: 4 days, **Risk**: Medium

#### Story 3.3 — Auto-save + version history
- Snapshot project state every 5 min, keep last 20 versions
- **ETA**: 3 days, **Risk**: Low

#### Story 3.4 — Editor team onboarding flow
- Welcome wizard: connect Brand kit + import existing CapCut project (export to standard format) + tutorial
- **ETA**: 4 days, **Risk**: Medium (CapCut import quality)

---

## EPIC 4: Admin Stock Library

### Sprint 5-6: Stock Library (6/11-6/24)

#### Story 4.1 — Stock account schema + admin UI
- Per SCOPE.md §11: 10-20 accounts iStock + Envato + Shutter, admin only access
- **ETA**: 4 days, **Risk**: Low

#### Story 4.2 — Account rotation logic
- Daily quota tracking, auto-pick least-used account per request
- **ETA**: 3 days, **Risk**: Medium

#### Story 4.3 — License tracking per download
- "Stock — iStock" badge + license file save R2
- **ETA**: 2 days, **Risk**: Low

#### Story 4.4 — Search proxy (cache-first)
- Cache popular queries Upstash Redis 24h, reduce per-account quota burn
- **ETA**: 3 days, **Risk**: Medium

---

## EPIC 5: Tier Quotas + Billing Prep

### Sprint 6: Tier System (6/18-6/24)

#### Story 5.1 — Quota tracking middleware
- Fastify middleware checks user tier + current usage before allowing AI calls
- **ETA**: 3 days, **Risk**: Medium

#### Story 5.2 — Usage dashboard (per workspace)
- Show: current tier + quota used % per resource (TTS chars, video gen min, etc.)
- **ETA**: 4 days, **Risk**: Low

#### Story 5.3 — Tier upgrade flow (Phase 1 manual, no payment)
- "Upgrade to Pro" CTA → contact form (admin manually upgrade)
- **ETA**: 1 day, **Risk**: Low
- **Note**: No Stripe v1 (per SCOPE.md). Phase 2 wire payment.

#### Story 5.4 — Quota reset cron
- Monthly reset all usage counters at month boundary (UTC)
- **ETA**: 1 day, **Risk**: Low

---

## EPIC 6: Crossian RAG Background

### Sprint 6: RAG Integration (6/18-6/24)

#### Story 6.1 — Crossian KB sanitization pipeline
- Read `D:/Workspace/Crossian Research/Knowhow_for_AI_Agent/`
- Replace brand names, drop COGS, drop Slack, sanitize per CLAUDE.md
- **Acceptance**: Output sanitized JSONL ready ingestion
- **ETA**: 3 days, **Risk**: Medium (PII leak risk if missed)

#### Story 6.2 — Embedding + index pipeline
- OpenAI ada-002 embedding (or DO Inference equivalent)
- Store pgvector Neon Postgres
- Chunk strategy: 500 token sliding window 50 overlap
- **ETA**: 3 days, **Risk**: Medium

#### Story 6.3 — RAG query service (background only)
- Per SCOPE.md §5: User prompt → RAG retrieve top-5 → augment LLM context → output
- **CRITICAL**: NO UI exposure (user không biết Crossian KB tồn tại)
- **ETA**: 2 days, **Risk**: High (complete invisibility requirement)

#### Story 6.4 — Cost + monitoring
- Log RAG retrieval cost per call, monthly budget alarm
- **ETA**: 1 day, **Risk**: Low

---

## EPIC 7: Internal Alpha + KPI Tracking

### Sprint 7: Alpha Launch (6/25-7/1)

#### Story 7.1 — Editor migration metrics dashboard
- Track: daily active editors, projects created/day, CapCut vs PixStudio split (per editor self-report)
- **ETA**: 3 days, **Risk**: Medium

#### Story 7.2 — Bug bash + triage
- Daily standup with Editor team during alpha week
- **ETA**: 5 days, **Risk**: High (unknown unknowns)

#### Story 7.3 — Performance optimization pass
- Profile slow paths, optimize hot loops, add CDN caching
- **ETA**: 3 days, **Risk**: Medium

#### Story 7.4 — Pino logs → Logflare/Axiom
- Structured logging shipped to log aggregator
- **ETA**: 1 day, **Risk**: Low

---

## EPIC 8: Quick Create Plugins (Max tier, Phase 1.5)

#### Story 8.1 — Voice cloning (Clone giọng)
- ElevenLabs Instant Voice Cloning (Pro tier ElevenLabs)
- Quota: 5 cloned voices per Max user
- **ETA**: 4 days, **Risk**: Medium

#### Story 8.2 — Brand kit (Brand kit plugin)
- Override watermark + intro/outro + color theme + typography per workspace
- **ETA**: 3 days, **Risk**: Low

#### Story 8.3 — Stylization preset
- Predefined LUT + color grade preset, applied as post-process
- **ETA**: 5 days, **Risk**: High (compositor integration)

---

## Cross-cutting concerns

### Testing
- [ ] Vitest unit tests min 70% coverage on `packages/`
- [ ] Playwright E2E for Quick Create happy path (5 scenarios)
- [ ] Load test: 100 concurrent Quick Create jobs (BullMQ throughput)
- [ ] Chaos test: GPU spawn failure / API timeout / quota exceeded handling

### Observability
- [ ] Structured logs all API endpoints (Pino + request ID)
- [ ] Provider-level cost tracking dashboard
- [ ] Alert thresholds: error rate >2%, p95 latency >5s
- [ ] Sentry error tracking (Phase 2 add)

### Security
- [ ] Rate limit per workspace (already implemented Phase 0 — verify)
- [ ] Input validation Zod schemas all API endpoints
- [ ] XSS sanitize user prompts (LLM injection)
- [ ] R2 upload virus scan (ClamAV optional)
- [ ] Secret rotation 1x before public ship (per `feedback_security_rotation_defer.md`)

### DevOps
- [ ] CI/CD GitHub Actions auto-deploy on main merge
- [ ] DB migration auto-run on Fly deploy (prisma migrate deploy in Dockerfile CMD)
- [ ] Backup: Neon daily auto-backup (verify on)
- [ ] Disaster recovery runbook (incidents response)

---

## Risk register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| ElevenLabs quota exceeded mid-build | Medium | High | Pro tier $99/mo + soft warn at 80% quota |
| Path B copyright DMCA | Medium | High | Output structure-only (no media redistribute) + legal review |
| GPU spawn fails Path B SLA | Medium | Medium | Fallback to CPU-only Demucs (slower but always works) |
| Editor team migration <80% | Low | High | Daily standup + rapid feature iteration based on feedback |
| Crossian RAG accidentally exposes brand | Low | Critical | Sanitization pipeline review + sample audit before ingest |
| Vendor cost spike (Veo3, Seedance) | Medium | High | Hard quota Max tier + alert at 50% monthly budget |

---

## Phase 2 preview (defer items)

After Phase 1 close (7/12):
- Stripe billing wire-up + tier upgrade self-service
- Yjs CRDT collab (Phase 3 actually, but groundwork Phase 2)
- Mobile responsive Pro Workspace
- Public marketing site (separate from app)
- Analytics integration (PostHog)
- A/B testing framework

---

## Anh next steps

1. Review this backlog → flag stories anh disagree priority/scope
2. Fill `docs/quick-create/*-form.md` content (workflows + chips + voices) — unblocks Sprint 1
3. Confirm tier quotas (acceptance-criteria-draft.md) — unblocks Epic 5
4. Authorize Stripe / Epidemic Sound music license deals — unblocks Sprints 4+
5. Schedule Editor team kickoff meeting 5/14 morning

Total stories: ~40 stories, ~120-160 dev days. With Claude solo CTO (em alone), realistic Phase 1 = 8 weeks aggressive. Buffer week 7/9-7/12 for unknowns.
