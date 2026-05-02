# PixStudio API Reference

*Base URL*: `https://api.studio.pixelxlab.com` (Fly.io Singapore production)
*Default URL*: `https://pixstudio-api.fly.dev`
*Tested live*: 2026-05-02 (Phase 0 production deploy session)
*Server*: Fastify 5 + Bun 1.3.13 + Prisma 6 + better-auth + @aws-sdk/client-s3

---

## Authentication

All endpoints `/api/projects`, `/api/workspaces`, `/api/assets`, `/api/ai/*` require Bearer token in header:

```
Authorization: Bearer <session_token>
```

Token obtained via `POST /api/auth/sign-up/email` or `POST /api/auth/sign-in/email`.

`/health/*`, `/api/auth/*`, `/api/ai/providers` are public (no auth).

---

## Health endpoints

### `GET /health`
Liveness probe. Returns service metadata.

**Response 200**:
```json
{
  "status": "ok",
  "service": "pixstudio-api",
  "version": "0.1.0",
  "uptime": 235.5,
  "timestamp": "2026-05-02T03:23:39Z"
}
```

### `GET /health/ready`
Readiness probe. Used by Fly.io health check (`/health/ready` per fly.toml).

**Response 200**: same shape as `/health`, plus dependency checks:
```json
{
  "status": "ok",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "r2": "ok"
  }
}
```

---

## Auth (better-auth)

### `POST /api/auth/sign-up/email`
Create new user account.

**Request**:
```json
{
  "email": "alex@pixelxlab.com",
  "password": "Test1234!Pass",
  "name": "Alex Truong"
}
```

**Response 200**:
```json
{
  "token": "RheqYQENQDVvFtqMtxNBQ0Su82Bwphlq",
  "user": {
    "id": "1JbPw82EGJKhUn6KgLDuTUIm5dSX4UcH",
    "email": "alex@pixelxlab.com",
    "name": "Alex Truong",
    "emailVerified": false,
    "image": null,
    "createdAt": "2026-05-02T03:27:02.716Z",
    "updatedAt": "2026-05-02T03:27:02.716Z"
  }
}
```

### `POST /api/auth/sign-in/email`
Login existing user.

**Request**:
```json
{
  "email": "alex@pixelxlab.com",
  "password": "Test1234!Pass"
}
```

**Response 200**: same shape as sign-up (token + user).

### `POST /api/auth/sign-out`
Invalidate current session.

**Headers**: `Authorization: Bearer <token>`
**Response 200**: `{}`

### `GET /api/auth/get-session`
Verify token + return session.

**Headers**: `Authorization: Bearer <token>`
**Response 200**:
```json
{
  "session": { "id": "...", "userId": "...", "expiresAt": "..." },
  "user": { ... }
}
```

---

## Workspaces

### `POST /api/workspaces`
Create new workspace. Requires owner ID.

**Request**:
```json
{
  "name": "Alex Personal",
  "ownerId": "1JbPw82EGJKhUn6KgLDuTUIm5dSX4UcH",
  "tier": "PRO",
  "region": "VN_SG"
}
```

Notes:
- `tier`: `STANDARD` | `PRO` | `MAX` (per SCOPE.md, no Free tier)
- `region`: `VN_SG` | `EU` | `US` (Phase 0 only `VN_SG` active)
- `slug` auto-generated from name (e.g. "Alex Personal" → "alex-personal")

**Response 200**:
```json
{
  "id": "bab5d152-93e2-4778-83e1-7002bf14846b",
  "name": "Alex Personal",
  "slug": "alex-personal",
  "ownerId": "1JbPw82EGJKhUn6KgLDuTUIm5dSX4UcH",
  "region": "VN_SG",
  "billingTier": "STANDARD",
  "createdAt": "2026-05-02T03:27:40.558Z",
  "updatedAt": "2026-05-02T03:27:40.558Z"
}
```

### `GET /api/workspaces/:id`
Fetch workspace by ID.

### `GET /api/workspaces/:id/members`
List workspace members + roles.

**Response 200**:
```json
{
  "members": [
    {
      "id": "...",
      "userId": "...",
      "role": "OWNER",
      "joinedAt": "..."
    }
  ]
}
```

### `POST /api/workspaces/:id/members`
Add member to workspace (OWNER only).

**Request**:
```json
{
  "email": "editor@pixelxlab.com",
  "role": "EDITOR"
}
```

Roles: `OWNER` | `EDITOR` | `VIEWER`.

---

## Projects

### `POST /api/projects`
Create project in workspace.

**Request**:
```json
{
  "workspaceId": "bab5d152-93e2-4778-83e1-7002bf14846b",
  "name": "My First PixStudio Project",
  "surface": "PRO_WORKSPACE"
}
```

`surface`: `PRO_WORKSPACE` | `QUICK_CREATE` | `ASSET_STUDIO`

**Response 200**:
```json
{
  "id": "2b7dfce2-ae3f-4ae2-9511-8ec73e00b506",
  "workspaceId": "...",
  "name": "My First PixStudio Project",
  "description": null,
  "thumbnailKey": null,
  "archived": false,
  "createdAt": "...",
  "updatedAt": "...",
  "lastEditedAt": "..."
}
```

### `GET /api/projects?workspaceId=<uuid>`
List projects in workspace.

**Response 200**:
```json
{
  "items": [{ /* project */ }, ...]
}
```

### `GET /api/projects/:id`
Fetch project by ID.

### `PATCH /api/projects/:id`
Update project (name, description, thumbnailKey, archived).

### `DELETE /api/projects/:id`
Soft-delete project. Sets `archived: true`.

---

## Assets (R2 storage)

### `POST /api/assets/presign`
Get presigned PUT URL for R2 upload (15-min expiry).

**Request**:
```json
{
  "workspaceId": "bab5d152-93e2-4778-83e1-7002bf14846b",
  "projectId": "2b7dfce2-ae3f-4ae2-9511-8ec73e00b506",
  "name": "test.png",
  "type": "IMAGE",
  "mimeType": "image/png",
  "sizeBytes": 1024
}
```

`type` enum:
- `VIDEO` | `IMAGE` | `MUSIC` | `CHARACTER` | `SCRIPT`
- `TTS_AUDIO` | `AI_GEN_IMAGE` | `AI_GEN_VIDEO`

**Response 200**:
```json
{
  "uploadUrl": "https://<r2-account-id>.r2.cloudflarestorage.com/pxs-vn-sg-uploads/<r2Key>?X-Amz-Algorithm=...&X-Amz-Signature=...",
  "r2Key": "2b7dfce2-ae3f-4ae2-9511-8ec73e00b506/image/1777670908371-l5nh9d.png",
  "bucket": "pxs-vn-sg-uploads",
  "expiresIn": 900
}
```

Client then `PUT` the file to `uploadUrl` with appropriate headers.

### `POST /api/assets/complete`
After successful PUT, register asset metadata in DB.

**Request**:
```json
{
  "workspaceId": "...",
  "projectId": "...",
  "r2Key": "...",
  "name": "test.png",
  "type": "IMAGE",
  "mimeType": "image/png",
  "sizeBytes": 1024
}
```

**Response 200**:
```json
{
  "id": "asset-uuid",
  "workspaceId": "...",
  "projectId": "...",
  "name": "test.png",
  "type": "IMAGE",
  "r2Bucket": "pxs-vn-sg-uploads",
  "r2Key": "...",
  "createdAt": "..."
}
```

### `GET /api/assets/:id/url?expiresIn=3600`
Get presigned GET URL (download).

**Response 200**:
```json
{
  "url": "https://...?X-Amz-Signature=...",
  "expiresIn": 3600
}
```

### `GET /api/assets?workspaceId=<uuid>&projectId=<uuid>`
List assets.

### `DELETE /api/assets/:id`
Soft-delete asset (DB record archived, R2 object retained 30 days for restore).

---

## AI Mesh (capability router)

### `GET /api/ai/providers`
List all registered providers + capabilities.

**Response 200**:
```json
{
  "providers": [
    {
      "id": "do-inference",
      "capability": "llm.chat",
      "vendor": "DigitalOcean",
      "displayName": "DO Inference Engine",
      "isPriorityChannel": true,
      "availableInTiers": ["standard", "pro", "max"]
    },
    {
      "id": "seedance-2-0",
      "capability": "video.imageToVideo",
      "vendor": "Byteplus",
      "displayName": "Seedance 2.0",
      "isPriorityChannel": true,
      "availableInTiers": ["pro", "max"]
    },
    /* ... */
  ]
}
```

8 providers (Phase 0):
- `do-inference` ⭐ — llm.chat (DO Inference Engine: Anthropic Claude Sonnet 4 + OpenAI + Llama)
- `gemini-llm` — llm.chat (Gemini fallback)
- `seedance-2-0` ⭐ — video.imageToVideo (Byteplus đối tác chiến lược)
- `veo-3` — video.textToVideo (Gemini API Max tier)
- `kling-3-0` — video.imageToVideo (fal.ai transition)
- `nano-banana-std` — image.generate (Gemini 2.5 Flash Image)
- `elevenlabs-tts` — tts.synthesize
- `elevenlabs-scribe` — stt.transcribe

### `POST /api/ai/chat` — LLM chat
**Request**:
```json
{
  "prompt": "Reply in 1 sentence: what is PixStudio?",
  "capability": "llm.chat",
  "model": "anthropic-claude-sonnet-4",
  "maxTokens": 1024,
  "temperature": 0.7,
  "systemPrompt": "You are a helpful assistant"
}
```

`capability`: `llm.chat` (required)
`model` optional, default `anthropic-claude-sonnet-4` (DO Inference)

**Response 200** (real test 2026-05-02):
```json
{
  "providerId": "do-inference",
  "text": "PixStudio is an AI-powered online design platform...",
  "costUsd": 0.000576,
  "durationMs": 2631,
  "usage": {
    "promptTokens": 22,
    "outputTokens": 34,
    "totalTokens": 56
  }
}
```

### `POST /api/ai/image` — Image generation
**Request**:
```json
{
  "prompt": "A serene sunset over Singapore skyline",
  "capability": "image.generate",
  "size": "1024x1024",
  "n": 1
}
```

`capability`: `image.generate`
Default provider: `nano-banana-std` (Gemini 2.5 Flash Image)

**Response 200**:
```json
{
  "providerId": "nano-banana-std",
  "images": [
    {
      "r2Key": "ai-gen/2026/05/02/abc123.png",
      "mimeType": "image/png",
      "sizeBytes": 856334,
      "url": "https://r2-presigned-url..."
    }
  ],
  "costUsd": 0.005,
  "durationMs": 8450
}
```

### `POST /api/ai/tts` — Text-to-speech
**Request**:
```json
{
  "text": "Xin chào, đây là PixStudio",
  "capability": "tts.synthesize",
  "voiceId": "VN_FEMALE_YOUNG_01",
  "speed": 1.0,
  "stability": 0.5,
  "similarityBoost": 0.75
}
```

`capability`: `tts.synthesize`
Default provider: `elevenlabs-tts`

**Response 200**: audio bytes streaming (Content-Type: audio/mpeg) OR JSON with R2 url:
```json
{
  "providerId": "elevenlabs-tts",
  "r2Key": "tts/2026/05/02/audio-xyz.mp3",
  "url": "https://r2-presigned-url...",
  "sizeBytes": 33458,
  "durationSec": 3.2,
  "costUsd": 0.012,
  "durationMs": 1850
}
```

### `POST /api/ai/video/i2v` — Image-to-video
**Request**:
```json
{
  "imageUrl": "https://r2-presigned-or-public-image-url",
  "prompt": "Camera dollies forward, gentle motion",
  "capability": "video.imageToVideo",
  "durationSec": 5,
  "ratio": "9:16"
}
```

`capability`: `video.imageToVideo`
Default provider: `seedance-2-0` (Byteplus priority)

**Response 200** (async job):
```json
{
  "jobId": "i2v-abc123",
  "providerId": "seedance-2-0",
  "status": "pending",
  "etaSec": 60,
  "pollUrl": "/api/ai/video/i2v/i2v-abc123"
}
```

Poll `GET /api/ai/video/i2v/:jobId` until `status: "completed"` then result has `videoUrl`.

### `POST /api/ai/video/t2v` — Text-to-video
**Request**:
```json
{
  "prompt": "Cinematic shot of dragonfly over rice paddy at sunset",
  "capability": "video.textToVideo",
  "durationSec": 5,
  "ratio": "16:9",
  "model": "veo-3"
}
```

`capability`: `video.textToVideo`
Default provider: `veo-3` (Gemini API, Max tier required)

Response shape similar to i2v (async job + poll).

---

## Quick Create (Phase 1, NOT YET IMPLEMENTED)

> Stub endpoints reserved for Phase 1 Sprint 1. See `docs/phase1-backlog.md`.

### `POST /api/quick-create/outline` (Phase 1)
Generate scene outline from prompt.

### `POST /api/quick-create/build` (Phase 1)
Trigger build pipeline (BullMQ job).

### `GET /api/quick-create/build/:jobId` (Phase 1)
Poll build status.

### `WS /api/quick-create/build/:jobId/stream` (Phase 1)
WebSocket live progress updates.

---

## Error responses

All errors follow Fastify default shape:

```json
{
  "statusCode": 400,
  "code": "FST_ERR_VALIDATION",
  "error": "Bad Request",
  "message": "body/name Required"
}
```

Common codes:
- `400 FST_ERR_VALIDATION` — Zod schema fail
- `401 UNAUTHORIZED` — missing/invalid Bearer token
- `403 FORBIDDEN` — auth OK but insufficient permissions (workspace member role)
- `404 NOT_FOUND` — resource doesn't exist or user not member
- `409 CONFLICT` — slug/email/etc already taken
- `429 TOO_MANY_REQUESTS` — rate limit (100 req/min default)
- `500 INTERNAL` — Prisma/R2/AI provider error
- `502 BAD_GATEWAY` — AI provider downstream error
- `503 UNAVAILABLE` — feature not configured (e.g. Freesound disabled per route guard)

## Rate limits

Default: 100 requests/minute per IP (Fastify rate-limit plugin).
Override per route in Phase 1 (e.g. `/api/ai/chat` lower if cost concern).

## CORS

Production origin allowlist (set via `CORS_ORIGINS` env):
- `https://studio.pixelxlab.com`
- `http://localhost:3000` (dev)

`credentials: true` enabled for cookie-based auth (better-auth uses cookies + bearer hybrid).

## Headers (helmet)

Defense-in-depth headers:
- `Strict-Transport-Security: max-age=15552000; includeSubDomains`
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`
- `Referrer-Policy: no-referrer`

## Observability

Structured logs via Pino (production: JSON, dev: pretty):
- Request ID (auto-generated)
- Latency (ms)
- Status code
- Workspace ID + User ID (when authenticated)

Future: ship to Logflare/Axiom (Sprint 7).

---

## Smoke test (verified live 2026-05-02)

```bash
# Health
curl https://api.studio.pixelxlab.com/health
# {"status":"ok","service":"pixstudio-api","version":"0.1.0",...}

# AI providers
curl https://api.studio.pixelxlab.com/api/ai/providers
# {"providers":[{...8 providers}]}

# AI chat (verified 2.6s, $0.000576)
curl -X POST https://api.studio.pixelxlab.com/api/ai/chat \
  -H "Content-Type: application/json" \
  --data-raw '{"prompt":"Reply in 1 sentence: what is PixStudio?","capability":"llm.chat"}'
# {"providerId":"do-inference","text":"PixStudio is an AI-powered...",...}

# Signup
TOKEN=$(curl -X POST https://api.studio.pixelxlab.com/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  --data-raw '{"email":"test@pixelxlab.com","password":"Pass1234!","name":"Test"}' \
  | jq -r '.token')

# Workspace
WS_ID=$(curl -X POST https://api.studio.pixelxlab.com/api/workspaces \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  --data-raw "{\"name\":\"Test WS\",\"ownerId\":\"<USER_ID>\",\"tier\":\"STANDARD\",\"region\":\"VN_SG\"}" \
  | jq -r '.id')

# R2 presign
curl -X POST https://api.studio.pixelxlab.com/api/assets/presign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  --data-raw "{\"workspaceId\":\"$WS_ID\",\"projectId\":\"$PROJ_ID\",\"name\":\"test.png\",\"type\":\"IMAGE\",\"mimeType\":\"image/png\",\"sizeBytes\":1024}"
# {"uploadUrl":"https://...r2.cloudflarestorage.com/...","r2Key":"...","bucket":"pxs-vn-sg-uploads","expiresIn":900}
```

All endpoints tested 2026-05-02 — sample response data captured in this doc.

---

## Next: OpenAPI 3.1 spec generation

Phase 1 Sprint 1 task: install `@fastify/swagger` + `@fastify/swagger-ui` (already in package.json), generate `apps/api/openapi.json` from Zod schemas, expose `/docs` Swagger UI.

Scaffolding code in `apps/api/src/server.ts` Phase 1.
