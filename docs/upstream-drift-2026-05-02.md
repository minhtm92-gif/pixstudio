# OpenCut Upstream Drift Report — 2026-05-02

*Author: Claude (autonomous overnight). Per UPSTREAM.md cadence: pin only Phase 0-1, weekly rebase Phase 2-3.*

---

## Executive summary

**PixStudio fork = OpenCut HEAD (6ec818fc 2026-04-26). No upstream commits to merge.**

- Fork point: `6ec818fc chore: remove accidental file` (2026-04-26)
- Upstream main HEAD: `6ec818fc` (same commit, no new commits in 6 days)
- PixStudio main HEAD: `d8c66118 Merge pull request #1` (2026-05-02)
- **PixStudio is 22 commits ahead of upstream main**, **0 behind**

⚠️ **Decision point**: OpenCut maintainers have NOT merged any commits to main since 2026-04-26. Either:
1. They paused active development on main (active branches exist for refactor work)
2. They moved to private/branch-based development without merging to main

PixStudio not blocked by upstream — em can ship Phase 1 without rebase concerns.

---

## OpenCut active branches (informational)

Em fetched only `upstream/main`. OpenCut has multiple active feature branches (mirrored to em's fork at fork time but em không track them now):

```
upstream/main                              (HEAD = 6ec818fc 2026-04-26)
upstream/canvas-rendering                  (active feature — wasm canvas rewrite)
upstream/codebase-overhaul                 (refactor)
upstream/codebase-overhaul-v2              (refactor v2)
upstream/feature/separate-audio            (audio editor improvements)
upstream/feature/track-placement           (timeline UX)
upstream/desktop                           (Electron/Tauri desktop client)
upstream/dev                               (active development?)
upstream/domain-import                     (Domain Drive integration)
upstream/adaptive-thumbnail-2              (thumbnail v2)
upstream/cursor/* (3 branches)             (Cursor-IDE auto-suggested)
upstream/coderabbitai/docstrings/*         (CodeRabbit AI docstring suggestions)
upstream/fix/timeline-placement-lint
upstream/fix/background-blur-intensity-scale
upstream/fix/hardcode-blog
```

These suggest active OpenCut development on feature branches before merging to main. Track Phase 2 if PixStudio wants to absorb wasm canvas rewrite or desktop branch.

---

## PixStudio wedge commits (22 ahead of upstream)

### Phase 0 Day 1-2: Fork + Brand baseline (4 commits)

```
37cc1c24 chore(scaffold): bootstrap PixStudio additions on top of OpenCut fork
fced6e9b feat(brand): rebrand baseline OpenCut → PixStudio (Day 2 pull-in)
be037c69 refactor(brand): bulk rebrand OpenCut → PixStudio in 19 user-facing files
6a087feb feat(brand): apply PXL color tokens to apps/web theme (D39)
```

**Conflict risk on rebase**: Medium — text replace pattern across 19 files. Upstream commits modifying those same files would conflict.

### Phase 0 Day 4-5: AI mesh (5 commits)

```
0584df5a feat(ai-services): 4 real providers via plug-in mesh
972f9bce feat(ai-services): ElevenLabs TTS provider real impl + workspace wire
2cd1f063 feat(ai-services): Veo 3 + Kling 3.0 + DO Inference providers — 6-channel mesh
0251d246 test(ai-services): DO Inference real LLM end-to-end via priority channel
93173e4a feat(brand): swap apps/web logo files to PXL 3-square mark
```

**Conflict risk on rebase**: Low — entirely new package `packages/ai-services/` not in upstream.

### Phase 0 Day 5: apps/api integration (3 commits)

```
50ab4b37 feat(api): wire AI mesh into Fastify REST endpoints
d24e8679 feat(api): wire Postgres + Prisma + R2 + workspace/asset CRUD
abad59db feat(api): better-auth wire-up + comprehensive deployment guide
```

**Conflict risk on rebase**: None — entirely new app `apps/api/` not in upstream.

### 2026-05-02 deploy session: Vercel + Fly.io (4 commits, including merge)

```
ac980847 fix(deploy): make Marble + Freesound env vars optional, add Fly.io Dockerfile + fly.toml
2bc6f019 fix(env): make Marble + Freesound optional in web zod schema
b1cab05c fix(sounds): guard FREESOUND_API_KEY before Freesound API call
d8c66118 Merge pull request #1 from minhtm92-gif/deploy/fly-vercel-bootstrap
```

**Conflict risk on rebase**: Medium — `apps/web/src/env/web.ts` and `apps/web/src/app/api/sounds/search/route.ts` modified. Upstream changes here will conflict.

### 2026-05-02 overnight branch (this session, ~5 commits)

```
chore/overnight-2026-05-02-roadmap-prep:
- docs(quick-create): 4 spec forms
- docs(phase1): detailed backlog
- docs(api): comprehensive API reference
- feat(quick-create): Phase 1 foundation scaffolding
- docs(audit): codebase audit report
- docs(upstream): this drift report
```

**Conflict risk on rebase**: None — pure additive (new docs + new package).

---

## Wedge analysis

### What we ADD vs upstream OpenCut

PixStudio extends OpenCut without rewriting core compositor. Wedge components (per UPSTREAM.md "default verb extend"):

| Component | Type | Conflict risk |
|---|---|---|
| `apps/api/` (full Fastify backend) | NEW | None |
| `packages/ai-services/` (8 AI providers + mesh) | NEW | None |
| `packages/brand/` (PXL tokens + logos) | NEW | None |
| `packages/quick-create/` (Phase 1 scaffold) | NEW | None |
| `Dockerfile` + `fly.toml` (deploy) | NEW | None |
| `docs/` (planning + audit + reference) | NEW | None |
| `.dockerignore` | MODIFIED | Low (additive lines) |
| `apps/web/src/env/web.ts` | MODIFIED | **Medium** (Marble + Freesound .optional()) |
| `apps/web/src/app/api/sounds/search/route.ts` | MODIFIED | **Medium** (503 guard) |
| `apps/web/src/site/brand.ts` | MODIFIED | **High** (full rebrand) |
| `apps/web/src/app/globals.css` | MODIFIED | **Medium** (PXL color tokens) |
| `apps/web/public/logos/` | MODIFIED | **High** (logo swap) |
| 19 files bulk text replace OpenCut→PixStudio | MODIFIED | **High** (conflict on every brand mention) |

### What we DON'T touch (preserve OpenCut compatibility)

- Compositor `apps/web/src/services/renderer/`
- Timeline editor `apps/web/src/components/editor/timeline/`
- Keyframe system
- Rust wasm `rust/wasm/` and `rust/crates/`
- Asset import (FFmpeg WASM integration)
- Project file format (IndexedDB schema)
- Test suites for renderer/timeline

→ Upstream improvements to these will merge cleanly via `git rebase upstream/main`.

---

## Rebase strategy recommendation

### Phase 0-1 (now → 7/12): PIN ONLY

Per UPSTREAM.md §2: "Phase 0-1 — Pin only — no rebase. Avoid mid-MVP churn."

Don't rebase even if upstream commits arrive. Em complete Phase 1 features against current pin (`6ec818fc`).

Update `UPSTREAM.md` with current pin:
```diff
-PINNED_COMMIT=<TBD-Day-1-after-fork>
-PINNED_VERSION=<vX.Y.Z>
-PINNED_DATE=2026-05-14
+PINNED_COMMIT=6ec818fc
+PINNED_VERSION=upstream-main-2026-04-26
+PINNED_DATE=2026-04-26
```

### Phase 2-3 (7/13 onwards): Weekly Friday rebase

Per UPSTREAM.md §2 cadence:
1. Fetch upstream `git fetch upstream main`
2. Check diff `git log --oneline upstream/main..HEAD`
3. Rebase `git rebase upstream/main` on dedicated rebase branch
4. Resolve conflicts (expected: brand strings, env schema, CSS tokens)
5. Smoke test 30min: `bun run build`, `cd apps/web && bun run dev`, end-to-end test 5 flows
6. PR rebase branch → main (squash merge)
7. Tag `pre-rebase-<date>` before merge for rollback

### Active branches to consider absorbing

If upstream merges these branches to main, decide whether to absorb each:

| Branch | Likely value to PixStudio | Decision |
|---|---|---|
| canvas-rendering (wasm rewrite) | High — perf improvement | Absorb when stable |
| desktop (Tauri client) | Low — PixStudio web-first per CLAUDE.md | Skip (PXL Desktop App is separate product) |
| feature/separate-audio | High — improves audio track UX | Absorb |
| feature/track-placement | Medium — timeline UX polish | Absorb if no conflicts |
| codebase-overhaul-v2 | Medium — depends on scope | Review when merged |
| domain-import | Low — niche feature | Skip |

---

## Contribution back upstream

Per UPSTREAM.md "Contribute non-conflicting fixes upstream":

PixStudio fixes that are NOT PixStudio-specific (worth upstream PR):

1. **`fix/freesound-api-key-guard`** (b1cab05c) — Early 503 when FREESOUND_API_KEY undefined. Useful for any OpenCut self-hoster who doesn't have Freesound account.
2. **`fix/marble-env-optional`** (2bc6f019) — Make MARBLE_WORKSPACE_KEY optional. Same self-hoster benefit.
3. **`fix/dockerfile-monorepo`** — em's Dockerfile pattern for Bun monorepo Docker build. Could share as docs example.

PixStudio-specific (don't upstream):
- Brand changes (PixStudio logo, color, copy)
- AI mesh package
- Fastify API server (OpenCut is web-only)
- PXL deploy config

**Upstream PR plan Phase 2** (~3 hours work):
1. Create branch `fix/optional-3rd-party-env-vars` on a clean OpenCut fork
2. Cherry-pick env schema fix + sounds guard
3. Open PR to OpenCut-app/OpenCut
4. Discuss if maintainers accept

---

## Long-term upstream relationship

PixStudio fork philosophy per CLAUDE.md:
- Default verb: extend
- Don't rewrite core (compositor, timeline, keyframe)
- Build wedge in `packages/`
- Contribute non-conflicting fixes back

This drift report confirms approach is working:
- 22 commits ahead, 0 behind, low conflict risk on most files
- Major wedge (apps/api, packages/ai-services, packages/quick-create) is entirely additive
- Future rebases will mostly resolve in `apps/web/src/site/brand.ts` and copy strings (predictable)

**Phase 4+ consideration**: If divergence grows >100 commits or core conflicts increase, consider hard fork (full ownership) vs continued soft fork. Re-evaluate Phase 4 (Q4 2026).

---

## Followups

When anh approve, em (next session):
- [ ] Update `UPSTREAM.md` PINNED_COMMIT field to `6ec818fc` (currently TBD placeholder)
- [ ] Set up CI script `scripts/check-upstream-drift.sh` — runs weekly, reports if upstream main HEAD != our pin
- [ ] Phase 2 prep: cherry-pick non-PixStudio fixes for upstream PR submission
- [ ] Phase 2 evaluate: which active feature branches (canvas-rendering, separate-audio) worth absorbing
