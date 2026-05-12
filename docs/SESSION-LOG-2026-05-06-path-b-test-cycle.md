# PixStudio Path B Test Cycle — 2026-05-06

*Author: Claude (autonomous + interactive). Continuation from `SESSION-LOG-2026-05-05-phase23-autonomous.md` (20-sprint backend autonomous).*

> **Branch**: `main` — em ship 32 commits trực tiếp, anh test live.

---

## Anh test goals

Investor demo flow (chốt 2026-05-06):

1. **Use Case 1**: YouTube URL → Path B reverse engineer → translate caption sang EN → voice over EN → thay cảnh từ Envato Elements (Path A: 3 generic clips rotated) → render final MP4
2. **Use Case 2**: Manual MP4 upload 40-60s → same flow (deferred)

Source video: `https://www.youtube.com/watch?v=298UT7mYTYw` (16-min VN storytelling)

---

## Timeline (chronological)

### Round 1: Plan + cost estimate
- Em map cost per stage (Phase A pipeline + Phase B re-language + Phase C render)
- Anh chốt 5 decisions: PRO tier (16min → bump cap to 20min), aspect for user choice, voice ID auto-suggest, subtitle preset Minimal Clean OK
- Em present Phase C plan 10 items → /simplify self-critique → 6 items MVP

### Round 2: MVP backend ship (S1 + S3 + S4 + S5)
- `5acb31bc` Presign size cap 2GB
- `cb325d1a` Path B render MVP — new `path-b-render` BullMQ queue + service + endpoint

### Round 3: Submit job → live debugging
- Anh submit YouTube URL twice (`f51ffb43`, `59bf2cd1`) — first stuck post-deploy machine kill, second pickup after fixes
- Final job `4528a9d8` completed pipeline in 6m57s
- Anh "done step 3 (voice over)" → translate timeout error 30s default
- `eab056ea` frontend timeout bump translate 120s, voice-over 180s
- Anh retried translate → backend abort 120s → em ship per-scene
- `4122435f` per-scene translate sequential with progress
- Anh voice over hit `text exceeds 5000 chars (single request limit)`
- `df31fc06` per-scene voice-over + render concat per-scene MP3s

### Round 4: Render attempts — OOM cascade
- Attempt 1 `4028b64e`: empty body (state lost from auto-save 409) → 1.16MB black canvas output
  - `5c94fc39` auto-save 409 sync serverVersion break infinite loop
- Em combined snippet bypass DB → fetch scenes from stock-keywords + voice-over inline
  - `dd9870fd` GET /api/path-b/jobs/:id/stock-keywords
  - `3b7fe98e` GET /api/path-b/projects/:projectId/stock-keywords (translated state)
- Anh: "Network tab không có gì" → snippet domain wrong → fix relative→absolute URL
- Anh: 928MB + 562MB clips → 500 from presign (cap 500MB)
  - `5acb31bc` presign cap bump 500MB → 2GB
- Anh: CORS error R2 bucket → em browser automate Cloudflare R2 dashboard CORS config
- Anh: re-upload 3 clips succeed via direct R2 PUT
- Attempt 2 `961f1282`: replacementCount=52, OOM 4GB → BullMQ UnrecoverableError stalled
  - Em flyctl scale memory 1GB → 4GB
- Attempt 3 `d1509265`: retry attempt 2, OOM 3.8GB RSS → stalled again
  - `436972f7` cache + free + lock 20min
- Attempt 4 (pending): `ca6cbd42` stream R2 I/O + transcoded cleanup + `6ad7cba9` visual cap tier-aware + parallel concurrency

### Round 5: /simplify full review
- 3 agents parallel — 32 findings (3 high, 16 med, 11 low)
- Em ship 5 priority fixes (3 OOM + tier-aware visual cap + parallel frontend)
- Defer 27 lower-priority refactors to dedicated cleanup sprint

---

## Cumulative stats

- **32 commits** trên main
- **~2000 LOC** new + ~500 LOC refactored across 12+ files
- **5 new endpoints** (translate, voice-over, render-final, render-jobs poll, stock-keywords × 2)
- **1 new BullMQ queue** (path-b-render with concurrency 1, lock 20min)
- **1 new service** path-b-render.ts (FFmpeg orchestration)
- **3 docs** (workflow translation guide / cheat sheet / helpdesk SOP)
- **2 runbooks** (secret rotation / disaster recovery)
- **50 vitest tests** added (mergeShortScenes 8 + editor-state 9 + caption-presets 8 + cultural-bundles 10 + stylization 6 + template-seed 9)
- **1 GitHub Actions workflow** (Fly auto-deploy)
- **Cloudflare R2 CORS** configured for `pxs-vn-sg-uploads` bucket
- **Upstash Redis upgraded** free → PAYG (anh action)
- **Fly memory scaled** 1GB → 4GB

---

## Files modified (key)

```
apps/api/src/services/path-b-pipeline.ts       # B1+B2+B3+B5 + streaming I/O + visual cap tier
apps/api/src/services/path-b-render.ts         # NEW — FFmpeg render orchestration (caching + streaming)
apps/api/src/services/hero-attachment-enrichment.ts  # pdf-parse Bun fix
apps/api/src/plugins/queue.ts                  # B4 path-b-extract worker + path-b-render worker
apps/api/src/routes/path-b.ts                  # stock-keywords + render-final + render-jobs poll
apps/api/src/routes/captions.ts                # /translate + /voice-over endpoints
apps/api/src/routes/quick-create.ts            # BullMQ enqueue for Path B
apps/web/src/app/quick-create/_components/editor/tab-edit-script.tsx  # Translate + Voice over buttons + parallel concurrency
apps/web/src/components/editor/editor-header.tsx     # Caption AI sub-menu
apps/web/src/components/editor/export-button.tsx     # Platform preset chips
apps/web/src/app/quick-create/workflows/page.tsx     # Seasonal bundles chip
apps/web/src/hooks/use-auto-save.ts            # 409 conflict serverVersion sync
fly.toml                                       # autostop=off
.github/workflows/fly-deploy.yml               # NEW — Fly auto-deploy
docs/editor-migration/{workflow-translation-guide,cheat-sheet,helpdesk-sop}.md  # NEW
docs/runbooks/{secret-rotation,disaster-recovery}.md  # NEW
```

---

## Production state hiện tại

- **Fly app** `pixstudio-api`:
  - 2 machines `shared-cpu-2x` 4GB each
  - Latest deploy: commit `6ad7cba9` (visual cap tier + parallel frontend)
  - autostop=off (Path B fire-and-forget would orphan, B4 migrated to BullMQ but kept autostop off)
- **Path B test project**: `d1ba94c2-9464-4885-b58e-582904cb2672`
  - From job `4528a9d8-23dc-4f0a-a218-3f661cdde804` (extraction COMPLETED)
  - WorkspaceId `066d9de0-b134-4203-b035-14b10fbdb268` PRO tier
- **3 Envato clips** uploaded:
  - `path-b/manual-stock/4528a9d8.../clip-1-1778096263880-...mov` (885MB)
  - `path-b/manual-stock/4528a9d8.../clip-2-1778096310030-...mp4` (562MB)
  - `path-b/manual-stock/4528a9d8.../clip-3-1778096327464-...mov` (15MB)

---

## Console snippet (combined upload + voice-over + render)

Anh saved trong session memory `session_2026_05_06_path_b_test_cycle.md`. Re-pastable cho attempt 4 sau context compact.

---

## Critical issues + workarounds

| Issue | Status | Workaround / Fix |
|---|---|---|
| Auto-save 409 infinite loop | Fixed `5c94fc39` | sync serverVersion → next save matches |
| Translate batch >30s timeout | Fixed `eab056ea` + `4122435f` | per-scene + bump frontend timeout |
| Voice-over 5000-char limit | Fixed `df31fc06` | per-scene loop + render concat MP3s |
| Render OOM 4GB | Fixed `436972f7` + `ca6cbd42` | cache unique r2Keys + stream R2 I/O + free intermediates |
| BullMQ stalled | Fixed `436972f7` | lockDuration 20min, stalledInterval 1min |
| Visual analysis 20-cap | Fixed `6ad7cba9` | tier-aware (STANDARD 20 / PRO 60 / MAX 100) |
| Upstash Redis quota | Fixed (anh upgrade PAYG) | + `84cb3f07` TLS altname skip |
| R2 CORS missing | Fixed (em browser automate) | bucket pxs-vn-sg-uploads CORS rule |
| Frontend translate/VO slow sequential | Fixed `6ad7cba9` | runWithConcurrency p=4 |
| Visual analysis 21+ scenes missing data on old jobs | Workaround | stock-keywords falls back to script tokenize |

---

## Deferred (27 from /simplify review)

**High value:**
- Extract shared utilities (runCmd, srtTime, downloadR2*, presignR2Put) — ~120 LOC dedup
- Split `processBuildJob` 480-line monolith
- Surface silent stage failures as `COMPLETED_WITH_WARNINGS` + `buildErrors[]`
- Drop legacy `voiceOverR2Key` field
- TanStack Query staleTime: Infinity for static presets

**Phase 4 cleanup sprint** sau khi anh production launch stable.

---

## Continuity for next session

After anh compact + restart:

1. **Anh test render attempt 4** với console snippet (combined upload + voice-over inline + render-final). Vercel + Fly đã deploy latest fixes.
2. Em should arm Monitor (or re-run cron) to watch render queue events:
   - `render: caching replacement clip` (new từ `436972f7`)
   - `render: done` với sizeBytes > 50MB (proves real video output)
   - `renderR2Key` for signed URL fetch
3. If render OOM again (4GB still not enough):
   - Option A: `flyctl machine update --vm-size performance-2x` (8GB, $25/mo per machine)
   - Option B: Refactor render to true streaming (process one scene at a time, no batch transcodes accumulated)
4. If render PASSES → anh download final MP4 via signed URL → Use Case 1 complete → optionally start Use Case 2 (40-60s upload test).

Memory file companion: `C:\Users\Admin\.claude\projects\D--Workspace-PixelxLab-PixCut\memory\session_2026_05_06_path_b_test_cycle.md` (agent recall format).
