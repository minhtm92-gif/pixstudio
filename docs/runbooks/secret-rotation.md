# Secret Rotation Runbook

> **Owner:** anh Minh (em document, anh execute). Run **1 time before public launch** per `feedback_security_rotation_defer.md`.
>
> Em can't rotate (no Cloudflare/Doppler/DO browser sessions per anh's chốt 2026-05-01). Em verify post-rotation health.

## When to rotate

- **Mandatory:** before public production ship (Phase 4 2026-07-12 target)
- **Triggered:** if any secret leaks (commit history scan, Discord screenshot, etc.)
- **Routine:** every 6 months Phase 4+

## What to rotate

Inventory: 13 active secrets across vendors. Group by blast radius.

### Tier A — production credentials (rotate first)

| Secret | Vendor | Rotation method | Downtime risk |
|---|---|---|---|
| `BETTER_AUTH_SECRET` | self-managed | Generate new 32-char hex; **all sessions logout** when rotated | High — anh schedule maintenance window |
| `DATABASE_URL` (Neon) | Neon dashboard → Settings → Connections | Reset password per branch; update Doppler `pxs-prod / prd` | Medium — brief connection drop |
| `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` | Cloudflare → R2 → Manage R2 API Tokens → Roll | Update Doppler | Low — old + new valid 1h overlap |
| `UPSTASH_REDIS_REST_URL` + `REDIS_URL` | Upstash dashboard → Database → Settings → Reset password | Update Doppler | Medium — BullMQ + cache flush |

### Tier B — AI vendor keys (rotate second)

| Secret | Vendor portal | Notes |
|---|---|---|
| `GEMINI_API_KEY` | console.cloud.google.com → Credentials → Roll | Project denial issue still open — may need re-bill |
| `ELEVENLABS_API_KEY` | elevenlabs.io → Profile → API Keys → Regenerate | Pro tier subscription |
| `BYTEPLUS_ACCESS_KEY` + `BYTEPLUS_SECRET_KEY` | Byteplus console → IAM → Roll | Seedance + Seedream HMAC |
| `DO_INFERENCE_TOKEN` | DO → API → Inference Engine → Roll | LLM gateway |
| `DO_API_TOKEN` | DO → API → Tokens → Roll | GPU spawn / R2 / Inference |
| `REPLICATE_API_TOKEN` | replicate.com → Account → API tokens → Regenerate | Demucs / SAM 2 / Real-ESRGAN / RIFE |
| `FAL_KEY` | fal.ai dashboard → API Keys → Regenerate | Kling 3.0 transitions |

### Tier C — infrastructure (rotate last)

| Secret | Vendor | Notes |
|---|---|---|
| `GITHUB_TOKEN` (personal) | github.com → Settings → Developer settings → Personal access tokens | Em không cần — chỉ anh dùng for `gh` CLI |
| `FLY_API_TOKEN` (CI deploy) | `flyctl tokens create deploy -x 999999h` (rotate by deleting old) | GitHub Actions secret |
| `DOPPLER_TOKEN_CI` | Doppler → pxs-prod → Access → Generate Service Token | CI test access |

## Rotation procedure

### Pre-rotation checklist

- [ ] **Backup current Doppler config**: anh export Doppler → JSON file (in case rollback needed)
- [ ] **Maintenance banner**: anh post Discord `#pixstudio-helpdesk` "Maintenance T-30 min, may see brief 502s"
- [ ] **Schedule low-traffic window**: typically 2am ICT (after Vietnam editor team EOD + before US East morning)

### Per-secret rotation steps

1. **Generate new value** in vendor portal (don't delete old yet)
2. **Update Doppler** `pxs-prod / prd` with new value
3. **Sync to runtime**:
   - Fly.io: `flyctl secrets set <NAME>=<value> -a pixstudio-api` → triggers rolling restart (~30s downtime per machine)
   - Vercel: project Settings → Environment Variables → edit + redeploy
4. **Verify**: em curl health endpoint + check Fly logs for vendor-specific test (e.g. Caption AI test if rotating ELEVENLABS_API_KEY)
5. **Revoke old** in vendor portal (most allow 24h grace; do this after verification)

### Order of rotation

Do Tier A together (single maintenance window ~30 min), then Tier B individually (no downtime each), then Tier C as needed.

```
T+0:  Banner posted, anh start rotation
T+5:  Rotate BETTER_AUTH_SECRET → flyctl deploy → all editors re-login (anh notify Discord)
T+10: Rotate DATABASE_URL → flyctl secrets set → Fly restart
T+15: Rotate R2 keys → flyctl secrets set → Fly restart
T+20: Rotate Upstash REDIS_URL → flyctl secrets set → Fly restart (BullMQ rebuilds in <1 min)
T+25: Health check pass → banner cleared
T+30: Tier B + C rotated rolling (no banner)
T+90: Old secrets revoked at vendor side
```

## Verification (em runs)

After each rotation, em automated checks:

```bash
# Health
curl -m 10 https://api.studio.pixelxlab.com/health
curl -m 10 https://studio.pixelxlab.com

# Auth (anh login + check session works)
curl -m 10 -H "Cookie: <session>" https://api.studio.pixelxlab.com/api/users/me

# DB connectivity (BullMQ depends on Redis + Postgres)
flyctl ssh console -a pixstudio-api -C "sh -c 'cd /repo/apps/api && bunx prisma db execute --stdin --schema=prisma/schema.prisma <<< \"SELECT 1;\"'"

# AI vendor smoke per rotated key
curl -m 30 https://api.studio.pixelxlab.com/api/captions/presets
curl -m 30 -X POST https://api.studio.pixelxlab.com/api/agent/brainstorm \
  -H "Cookie: <session>" -H "Content-Type: application/json" \
  -d '{"intent":"hook","prompt":"test"}'
```

If any verification fails: roll back via Doppler (paste previous value) + flyctl restart.

## Rollback

| Component | Rollback action |
|---|---|
| Doppler | Activity log → restore previous secret value |
| Fly.io | `flyctl releases` → identify pre-rotation release → `flyctl releases rollback v<X>` |
| Vercel | Vercel dashboard → Deployments → Promote previous |
| Vendor (e.g. R2) | If new key revoked too soon, generate fresh + repeat — old key already revoked, can't restore |

## Post-rotation

- [ ] Em verify all 13 keys swapped via Fly secrets list + Doppler audit log
- [ ] Em update memory `feedback_security_rotation_defer.md` with rotation date
- [ ] Anh post Discord `#pixstudio-feedback` "Rotation complete, system normal"
- [ ] Add reminder to calendar for next rotation 6 months out

## Known gotchas

- **BETTER_AUTH_SECRET rotation invalidates ALL sessions** — anh notify before, expect editor team re-login
- **R2 keys**: Cloudflare allows old + new tokens to coexist for 1h; do in this order: create new → verify → revoke old (not the reverse)
- **Neon DB password reset** requires brief connection drop; in-flight transactions abort. Schedule when builds queue is empty
- **Doppler audit log retention**: 90 days. Don't rely on activity log for >3 month-old rotations
- **Fly secret update**: implicit `flyctl deploy` — restart all machines. Don't rotate during anh's active editing session
