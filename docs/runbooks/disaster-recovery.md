# Disaster Recovery Runbook

> **Owner:** anh Minh executes critical path. Em assists with diagnostics + verification. Pairs với `secret-rotation.md` cho production gate.
>
> Severity scale: **SEV-1** = full outage / data loss · **SEV-2** = single component down · **SEV-3** = degraded performance.

## Decision tree (use first 30 seconds)

```
Production user reports issue?
├─ studio.pixelxlab.com unreachable     → §1 Vercel outage
├─ api.studio.pixelxlab.com 5xx          → §2 Fly.io outage
├─ Builds queued but not running         → §3 Redis / BullMQ outage
├─ Login fails / sessions all dropped    → §4 Postgres / better-auth
├─ Existing data missing                 → §5 Data loss (CRITICAL)
├─ Asset upload fails                    → §6 R2 outage
├─ AI feature returns 502                → §7 Vendor outage
└─ Slow but no errors                    → §8 Performance degradation
```

---

## §1 Vercel outage (apps/web)

**Symptoms:** `studio.pixelxlab.com` returns 503 / DNS error / blank page.

**Diagnostics:**
```bash
curl -m 10 -sS -o /dev/null -w "%{http_code}\n" https://studio.pixelxlab.com
# Vercel status: https://www.vercel-status.com/
```

**Recovery:**
1. Check Vercel dashboard → Deployments → latest deployment status
2. If recent commit broke build: **Promote previous deployment** (Vercel dashboard → Deployments → ... → Promote)
3. If Vercel-side outage: wait + post Discord banner
4. If fully blocked >30 min: temporary fallback `pixstudio-api.fly.dev` direct (no frontend, anh shows API endpoints only)

---

## §2 Fly.io outage (apps/api)

**Symptoms:** `api.studio.pixelxlab.com` 502/503/timeout.

**Diagnostics:**
```bash
flyctl status -a pixstudio-api
flyctl logs -a pixstudio-api --no-tail | tail -100
flyctl checks list -a pixstudio-api
# Fly status: https://status.fly.io/
```

**Recovery options (in order):**

### A. App crashed but Fly platform OK
```bash
# Identify last good release
flyctl releases -a pixstudio-api

# Roll back
flyctl releases rollback -a pixstudio-api v<X>
```

### B. Machine restart loop
```bash
# Check error logs
flyctl logs -a pixstudio-api --no-tail | grep -i "error\|exit\|fail" | tail -20

# Force fresh machine (kills + recreates)
flyctl machine restart <machine_id> -a pixstudio-api
```

### C. Region capacity squeeze (memory)
- Use `--skip-release-command` flag for deploy (avoids 3rd machine)
- If both running machines OOM: upgrade VM via `flyctl scale memory 2048 -a pixstudio-api`

### D. Fly platform-side outage
- Wait + post Discord banner
- If >2h: spin emergency Fly app in different region (e.g. `nrt`) — em document exact steps:
  ```bash
  flyctl apps create pixstudio-api-nrt --org personal
  flyctl deploy --app pixstudio-api-nrt --primary-region nrt
  # Update CF DNS to point api.studio.pixelxlab.com → nrt app
  ```

---

## §3 Redis / BullMQ outage (Upstash)

**Symptoms:** Build pipeline jobs stuck PENDING. Session login fails (cache miss → DB hit slow). Path B jobs orphaned.

**Diagnostics:**
```bash
# Health check
flyctl logs -a pixstudio-api --no-tail | grep "BullMQ\|Redis\|connection refused" | tail -10
# Upstash dashboard: https://console.upstash.com/
```

**Recovery:**
1. Upstash dashboard → Database → check Status / Active connections
2. If DB hit memory limit: anh upgrade tier (Pro Pay-as-you-go) immediately
3. If connection issue: anh reset password → update Doppler `UPSTASH_REDIS_REST_URL` + `REDIS_URL` → `flyctl secrets set` → wait 30s machine restart
4. Verify BullMQ resumes:
   ```bash
   flyctl logs -a pixstudio-api --no-tail | grep "BullMQ worker started" | tail -2
   ```
5. **Stuck jobs cleanup**: query DB for orphaned jobs:
   ```sql
   UPDATE "QuickCreateSession" SET buildStatus = 'CANCELLED', errorMessage = 'Redis outage recovery'
   WHERE buildStatus IN ('GENERATING_SCRIPT','SYNTHESIZING_VOICE','MATCHING_STOCK','COMPOSING_SCENES','RENDERING_PREVIEW')
     AND updatedAt < NOW() - INTERVAL '30 minutes';

   UPDATE reverse_engineer_jobs SET status = 'CANCELLED', "errorMessage" = 'Redis outage recovery', "completedAt" = NOW()
   WHERE status NOT IN ('COMPLETED','FAILED','CANCELLED','PENDING')
     AND "updatedAt" < NOW() - INTERVAL '30 minutes';
   ```

---

## §4 Postgres / better-auth (Neon)

**Symptoms:** Login 500. All `/api/*` requests fail.

**Diagnostics:**
```bash
flyctl logs -a pixstudio-api --no-tail | grep "Prisma\|connection\|ECONNREFUSED" | tail -10
# Neon console: https://console.neon.tech/
```

**Recovery:**
1. Neon dashboard → Project → Branches → check `main` branch status
2. If suspended (auto-suspend after idle): re-activate (instant)
3. If connection limit: anh upgrade plan or kill idle connections
4. If schema corruption: roll back via branch — Neon keeps point-in-time recovery 7d
   ```
   Neon dashboard → Branches → Create branch from earlier timestamp
   → Connect API to new branch → verify → swap DATABASE_URL
   ```
5. **DB password reset risk**: see §3 procedure (same flow); existing sessions invalidated only if `BETTER_AUTH_SECRET` rotates simultaneously

---

## §5 Data loss (CRITICAL — SEV-1)

**Symptoms:** Editor reports project gone / scenes missing / asset 404.

**STOP — don't write to DB until cause identified.**

**Diagnostics:**
1. Check audit log:
   ```sql
   -- Recent project deletions
   SELECT * FROM "Project" WHERE updatedAt > NOW() - INTERVAL '24 hours' ORDER BY updatedAt DESC LIMIT 50;

   -- ReverseEngineerJob updates
   SELECT * FROM reverse_engineer_jobs WHERE "updatedAt" > NOW() - INTERVAL '24 hours' ORDER BY "updatedAt" DESC LIMIT 50;
   ```
2. Check R2 bucket (if asset issue): Cloudflare dashboard → R2 → bucket → object versioning enabled?

**Recovery:**

### A. Postgres data loss
- Neon point-in-time recovery (PITR) — branch from timestamp before incident:
  ```
  Neon console → Branches → New from <timestamp>
  → temp branch → SELECT data → INSERT back into main
  ```

### B. R2 object loss
- If versioning enabled: Cloudflare dashboard → R2 → bucket → Object Versions → restore
- If versioning NOT enabled (current state v1): **data lost**. Em update incident postmortem + propose enabling versioning Phase 2.

### C. R2 bucket fully wiped
- Restore from snapshot OR cross-bucket replication (Phase 4 Cloudflare R2 backup setup pending)

**Postmortem template:** create issue `DR-YYYY-MM-DD` with:
- Timeline (T+0 incident detected → T+X recovery)
- Root cause (5-why analysis)
- Data recovered vs lost (specific records)
- Prevention (e.g. enable R2 versioning, add audit log column)

---

## §6 R2 outage / asset upload fails

**Symptoms:** Hero attachment upload 502, render output not saving.

**Diagnostics:**
```bash
# R2 client logs
flyctl logs -a pixstudio-api --no-tail | grep -i "r2\|s3\|cloudflare" | tail -10
# Cloudflare status: https://www.cloudflarestatus.com/
```

**Recovery:**
1. Check Cloudflare R2 dashboard — bucket Status / token validity
2. If R2 token expired/revoked: see `secret-rotation.md` Tier A R2 keys procedure
3. If Cloudflare-side outage: post Discord banner, queue uploads in BullMQ + retry when service restored
4. If bucket region issue: **avoid switching regions** (R2 doesn't auto-replicate). Wait service restoration.

---

## §7 AI vendor outage

**Symptoms:** specific feature 502 (Caption AI / Seedance video / Veo3 / etc).

**Diagnostics:**
```bash
flyctl logs -a pixstudio-api --no-tail | grep -i "vendor\|elevenlabs\|gemini\|byteplus\|replicate\|fal\|do_inference" | tail -20
```

**Recovery — degrade gracefully:**

| Vendor | Fallback |
|---|---|
| ElevenLabs (TTS + Scribe) | Disable Caption AI / TTS feature; queue for retry. No fallback for Multilingual v2. |
| Gemini API (Veo 3 + Nano Banana) | Disable image/video AI gen feature. Queue. |
| Byteplus (Seedance) | Fallback to Kling 3.0 (different vendor) for short transitions. Disable full Seedance gen. |
| DO Inference (LLM) | No drop-in fallback. Disable LLM-dependent features (outline gen, brainstorm, translate). |
| Replicate (Demucs + SAM 2) | Disable Path B stage 4 + BG remove. Pipeline auto-skips with warning. |
| fal.ai (Kling) | Disable Kling-only transition feature. |

**Action:** em add temp `disabled` flags in `app.aiRouter` → returns mocked-error to UI with helpful message ("Caption AI tạm thời gián đoạn — anh thử lại sau X phút").

---

## §8 Performance degradation

**Symptoms:** Health 200 but p95 latency >5s (target ~500ms).

**Diagnostics:**
```bash
# Fly metrics dashboard
# https://fly.io/apps/pixstudio-api/metrics

flyctl logs -a pixstudio-api --no-tail | grep "responseTime" | awk -F'"responseTime":' '{print $2}' | awk -F',' '{print $1}' | sort -n | tail -20
```

**Common causes + fix:**

| Cause | Fix |
|---|---|
| Outline LLM slow (>15s) | Switch model: env var → `do-inference: gpt-oss-120b` (faster) instead of `claude-sonnet-4` |
| Path B pipeline saturating CPU | Reduce concurrency (already at 1) — accept queue backup; anh provision GPU droplet to offload |
| BullMQ backlog | Spin a 2nd Fly machine → starts 2nd worker (concurrency 1 each = 2 parallel jobs) |
| Postgres slow query | Check Neon dashboard → Slow Queries; add index via migration |
| R2 cold (first read) | Acceptable; subsequent reads hit Cloudflare edge cache |

---

## Emergency contacts

| Role | Contact | Tier-1 priority |
|---|---|---|
| Anh Minh (CEO) | Direct ping Discord + SMS | All SEV-1 |
| Em (Claude) | Discord `#pixstudio-helpdesk` | SEV-2/SEV-3 |
| Vendor support | Per vendor portal | SEV-1 vendor outage |

## Communication template (Discord post)

```
⚠️ INCIDENT: <component> degraded
- Started: <time UTC>
- Impact: <user-visible issue>
- Status: investigating | recovering | resolved
- ETA: <Xmin>

Updates every 15min until resolved.
```
