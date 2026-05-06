# PixStudio Deployment Guide

*Author: Claude · 2026-05-02 · Phase 0 → Production-ready*

> Anh execute manual via browser/CLI khi ready. Em document step-by-step.

## 1. Architecture topology

```
Internet
   │
   ▼
Cloudflare (DNS + WAF + R2 storage)
   │
   ├─ studio.pixelxlab.com  ──► Vercel (apps/web Next.js 16)
   │                              │
   │                              ▼
   ├─ api.studio.pixelxlab.com ──► Fly.io (apps/api Fastify)
   │                              │
   │                              ├──► Neon Postgres (DB)
   │                              ├──► Upstash Redis (cache + queue)
   │                              ├──► Cloudflare R2 (3 buckets APAC)
   │                              ├──► DO Inference Engine (LLM ⭐)
   │                              ├──► Byteplus Seedance 2.0 (video ⭐)
   │                              ├──► Gemini API (Veo 3 + Nano Banana)
   │                              ├──► fal.ai (Kling 3.0)
   │                              └──► ElevenLabs (TTS + Scribe)
   │
   └─ gpu.studio.pixelxlab.com ──► DO L40S/RTX 6000 Ada TOR1 (manual spawn)
                                   │
                                   ├──► Whisper-large-v3
                                   ├──► Demucs htdemucs_ft
                                   ├──► SAM 2 base+
                                   ├──► Real-ESRGAN x4
                                   └──► ComfyUI + AnimateDiff (Phase 2+)
```

## 2. Prerequisites checklist

- [x] GitHub repo `minhtm92-gif/pixstudio` private
- [x] Doppler `pxs-prod` project + `prd` config với 13 secrets
- [x] Cloudflare zone `pixelxlab.com` Active + R2 buckets `pxs-vn-sg-{uploads,renders,derived}`
- [x] DNS `studio.pixelxlab.com` → CF proxy → eventual Vercel preview
- [ ] **Neon Postgres** project create (anh manual via dashboard)
- [ ] **Upstash Redis** database create
- [ ] **Vercel** project link GitHub repo
- [ ] **Fly.io** app create + deploy
- [ ] **DO GPU snapshot** built (Phase 0 in-progress)

## 3. Vercel deploy `apps/web` (browser, ~10 phút)

### 3.1 Create project

1. https://vercel.com/new → "Import Git Repository"
2. Authorize GitHub `minhtm92-gif/pixstudio` if not yet
3. Import → Configure:
   - **Project Name:** `pixstudio-web`
   - **Framework Preset:** Next.js (auto-detect)
   - **Root Directory:** `apps/web`
   - **Build Command:** `bun run build` (override default `next build`)
   - **Install Command:** `bun install --frozen-lockfile`
   - **Output Directory:** `.next` (default)

### 3.2 Environment variables (Vercel → Project Settings → Environment)

Em provide values từ Doppler `pxs-prod / prd`:

| Variable | Source |
|----------|--------|
| `NEXT_PUBLIC_SITE_URL` | `https://studio.pixelxlab.com` |
| `NEXT_PUBLIC_API_URL` | `https://api.studio.pixelxlab.com` |
| `DATABASE_URL` | Neon Postgres connection string (after step 4) |
| `BETTER_AUTH_SECRET` | Generate `openssl rand -base64 32`, add Doppler |
| `R2_ACCESS_KEY_ID` | Doppler |
| `R2_SECRET_ACCESS_KEY` | Doppler |
| `R2_ENDPOINT_URL` | Doppler |
| `R2_ACCOUNT_ID` | Doppler |

Recommend: Vercel-Doppler integration để auto-sync (Vercel marketplace → Doppler → Authorize → Map prd config to Production environment).

### 3.3 Custom domain

1. Vercel → Project → Settings → Domains
2. Add `studio.pixelxlab.com`
3. Vercel shows CNAME target `cname.vercel-dns.com`
4. Cloudflare → DNS → Edit `studio` record → CNAME → `cname.vercel-dns.com` (proxy OFF khi verify, then ON)
5. Wait DNS propagation 1-5min

### 3.4 First deploy

1. Push commit triggers auto-deploy
2. Vercel preview URL → verify build succeeds + `/health` returns 200
3. Promote preview → Production

## 4. Neon Postgres setup (browser, ~5 phút)

1. https://console.neon.tech → Create project `pixstudio-prod`
2. Region: **AWS Singapore** (`ap-southeast-1`) — match VN/SG R2 region
3. Postgres version: 16
4. Copy connection string format `postgresql://user:pass@host/db?sslmode=require`
5. Add to Doppler `DATABASE_URL`
6. Enable extensions:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```
7. Run `bunx prisma db push` to deploy 8-table schema

**Cost Phase 0-1:** Neon free tier (0.5GB storage + autoscale). Phase 2+ upgrade to Launch ($19/mo) khi >0.5GB.

## 5. Upstash Redis setup (browser, ~3 phút)

1. https://console.upstash.com → Create database `pixstudio-redis`
2. Region: **Singapore** (`ap-southeast-1`)
3. Type: **Regional** (free tier 10K commands/day)
4. Copy `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
5. Add to Doppler

**Cost:** Free tier OK Phase 0-2; Phase 3+ Pay-as-you-go khi BullMQ queue >10K/day.

## 6. Fly.io deploy `apps/api` (CLI, ~15 phút)

### 6.1 Install flyctl

```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

### 6.2 Login + create app

```bash
fly auth login
cd apps/api
fly launch --name pixstudio-api --region sin --no-deploy
# Edit fly.toml: set primary_region = "sin", min_machines_running = 1
```

### 6.3 fly.toml (em ship)

```toml
app = "pixstudio-api"
primary_region = "sin"

[build]
dockerfile = "Dockerfile"

[env]
PORT = "8080"
HOST = "0.0.0.0"
NODE_ENV = "production"
LOG_LEVEL = "info"

[http_service]
internal_port = 8080
force_https = true
auto_stop_machines = "stop"
auto_start_machines = true
min_machines_running = 1
processes = ["app"]

[[vm]]
size = "shared-cpu-2x"
memory_mb = 1024
```

### 6.4 Set Doppler secrets

```bash
# Get all PXS secrets từ Doppler
doppler secrets download --no-file --format env-no-quotes \
  --project pxs-prod --config prd \
  | xargs -I {} fly secrets set {} --app pixstudio-api
```

Or manual:
```bash
fly secrets set --app pixstudio-api \
  DATABASE_URL="postgresql://..." \
  BETTER_AUTH_SECRET="..." \
  GEMINI_API_KEY="..." \
  DO_INFERENCE_TOKEN="..." \
  ELEVENLABS_API_KEY="..." \
  BYTEPLUS_ACCESS_KEY="..." \
  BYTEPLUS_SECRET_KEY="..." \
  FAL_API_KEY="..." \
  R2_ACCESS_KEY_ID="..." \
  R2_SECRET_ACCESS_KEY="..." \
  R2_ENDPOINT_URL="..." \
  R2_ACCOUNT_ID="..."
```

### 6.5 Deploy

```bash
fly deploy --app pixstudio-api
```

### 6.6 Custom domain `api.studio.pixelxlab.com`

1. Cloudflare → DNS → Add CNAME `api.studio` → `pixstudio-api.fly.dev` (proxy OFF first)
2. `fly certs add api.studio.pixelxlab.com`
3. Wait cert issued (~5min)
4. Re-enable Cloudflare proxy ON
5. Test: `curl https://api.studio.pixelxlab.com/health`

## 7. GPU droplet snapshot strategy (per ADR-003 + ADR-004 v3)

**Em already shipped scripts:**
- `scripts/do-gpu-stock-check.sh` — daily availability check
- `scripts/do-gpu-spawn.sh` — fallback chain spawn (L40S → RTX 6000 Ada → H100 → AMS3)
- `scripts/do-gpu-destroy.sh` — confirmed destroy
- `scripts/gpu-bootstrap.sh` — install all AI tools (Whisper + Demucs + SAM 2 + Real-ESRGAN + RIFE + ComfyUI + Chromaprint)

**One-time snapshot (Phase 0 5/2):**
1. Anh canh slot via stock check
2. Spawn base Ubuntu 22.04 droplet
3. SSH `bash gpu-bootstrap.sh` (~30-45 min)
4. Power off → Snapshot via DO API
5. Save `PIXSTUDIO_GPU_SNAPSHOT_ID_TOR1` to Doppler
6. Destroy builder droplet (stop $1.57/hr billing)
7. Future spawns ~60-90s boot từ snapshot

**Daily ops Phase 1+:**
- Admin Start GPU button trong PixStudio admin UI
- Workers run AI jobs (Demucs/SAM 2/Whisper/etc.)
- Admin Destroy when queue empty + idle 30min
- Cost: avg ~$10-20/day (6-12 hrs active × $1.57/hr)

## 8. CI/CD pipeline

GitHub Actions `.github/workflows/ci-pxs.yml` ALREADY shipped:
- Triggers on push/PR
- Bun install + typecheck + lint + test + build
- Rust compositor cargo check
- Upstream OpenCut drift report

**Required GitHub repo secret:**
- `DOPPLER_TOKEN_CI` — Doppler service token với CI scope (anh generate via Doppler dashboard → Project pxs-prod → Access → Generate Service Token cho `dev` config)

Vercel-GitHub integration auto-deploys preview/production on commit.

**Fly.io auto-deploy** (`.github/workflows/fly-deploy.yml`, shipped 2026-05-06):
- Triggers on push to main when `apps/api/**` `packages/**` `Dockerfile` `fly.toml` changes
- Runs `flyctl deploy --remote-only --skip-release-command`
- **Required secret:** `FLY_API_TOKEN` — generate via `flyctl tokens create deploy -x 999999h`, add to Settings → Secrets and variables → Actions

**Schema migration deploy** (manual, không qua action vì sin region capacity squeeze):
1. Add prisma migration locally (`bunx prisma migrate dev --name <slug>`)
2. Commit + push as usual (auto-deploy ships code with `--skip-release-command`, so migration KHÔNG run yet)
3. Manually `flyctl ssh console -a pixstudio-api -C "sh -c 'cd /repo/apps/api && bunx prisma migrate deploy'"` — runs in 1 of the existing app machines, no extra memory needed

## 9. Monitoring + observability

Phase 1 prep:
- **Pino structured logs** → Logflare or Axiom (Sprint 1)
- **PostHog analytics** apps/web (X-7 Sprint 3)
- **Vercel Analytics** auto via Vercel project
- **Fly.io metrics** built-in dashboard
- **Cloudflare Analytics** zone-level

Phase 2+ add:
- **Sentry** error tracking
- **OpenTelemetry** traces — DO Inference Engine + provider mesh

## 10. Rollback strategy

| Component | Rollback |
|-----------|----------|
| Vercel | Vercel dashboard → Deployments → Promote previous |
| Fly.io | `fly releases --app pixstudio-api` then `fly releases revert <id>` |
| Neon DB | Branch-per-PR + restore via `pg_dump` (auto daily backup Phase 1+) |
| R2 | Cloudflare dashboard → Bucket → Versioning (enable Phase 1+) |
| Doppler | Activity log shows full diff; revert via copy-paste |
| GPU snapshot | Roll back to previous snapshot (DO keeps last 2) |

## 11. Production gate checklist

Before public launch (Phase 4 12/7):
- [ ] All 13 Doppler secrets rotated 1 time
- [ ] DB backups daily verified restore tested
- [ ] R2 versioning enabled
- [ ] Sentry error tracking live
- [ ] PostHog funnel + retention dashboards
- [ ] Editor team migration ≥80% (Phase 1 KPI)
- [ ] Fly.io min_machines_running scale to 2+ regions (sin + nrt for VN+EN)
- [ ] CDN cache rules tuned for video heavy paths
- [ ] DDoS test via Cloudflare WAF
- [ ] Privacy policy + Terms of Service legal review

---

**Status:** Deployment guide v1.0. Anh trigger Vercel/Fly.io/Neon/Upstash setup khi ready. Em standby support qua Chrome MCP shared session.
