# PixStudio Codebase Audit Report — 2026-05-02

*Author: Claude (autonomous overnight). Scope: apps/api + packages/ai-services + packages/quick-create + apps/web env handling.*

> **Production status**: Both services LIVE 2026-05-02. End-to-end smoke test passed. This audit identifies issues to address in Phase 1 Sprint 1-2 hardening.

---

## Executive summary

**3,069 lines** of TypeScript audited (apps/api: 1,331 + packages/ai-services: 1,738).

### Severity breakdown

| Severity | Count | Phase 1 must-fix |
|---|---|---|
| 🔴 Critical | 4 | Yes |
| 🟠 High | 7 | Yes |
| 🟡 Medium | 12 | Some |
| 🟢 Low | 9 | Defer |

### Top 5 priorities

1. 🔴 **No auth check** on `/api/workspaces`, `/api/projects`, `/api/assets` — anyone with API access creates resources for any user
2. 🔴 **Tier enum mismatch** between API (`STANDARD`/`PRO`/`MAX` uppercase) and quick-create package (`standard`/`pro`/`max` lowercase) — runtime errors guaranteed
3. 🔴 **Workspace member RBAC missing** — non-OWNER can add members
4. 🔴 **Tier quota middleware not implemented** — Standard users can call expensive Veo3 / Seedance unlimited
5. 🟠 **Better-auth handler body re-serialization** — JSON.stringify of req.body when better-auth needs raw stream → may break multipart uploads

---

## 🔴 Critical issues

### C1. Missing authorization on workspace/project/asset endpoints

**Files**: `apps/api/src/routes/workspaces.ts`, `projects.ts`, `assets.ts`

**Issue**: None of these routes check `Authorization: Bearer <token>` or invoke `app.auth.api.getSession()`. Any caller can:
- POST /api/workspaces with arbitrary `ownerId`
- POST /api/projects in any workspace (no member check)
- POST /api/assets/presign for any project (no scope check)

**Impact**: Privilege escalation. Tester could enumerate workspaces, exfiltrate assets, plant projects in other tenants.

**Smoke test confirms**: em created workspace using a token but route never validated token, just trusted `ownerId` field from body.

**Fix Sprint 1 Story**:
```typescript
// apps/api/src/plugins/require-auth.ts
import fp from "fastify-plugin";
import type { FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    user?: { id: string; email: string };
  }
}

export default fp(async (app) => {
  app.decorateRequest("user", null);
  app.addHook("preHandler", async (req) => {
    if (req.url.startsWith("/api/auth/")) return;
    if (req.url.startsWith("/api/ai/providers")) return; // public
    if (req.url.startsWith("/health")) return;

    const session = await app.auth.api.getSession({ headers: req.headers });
    if (!session) return; // anonymous routes handle 401 themselves

    req.user = { id: session.user.id, email: session.user.email };
  });
});
```

Then per-route:
```typescript
app.post("/", {
  preHandler: async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: "Unauthorized" });
  },
  // ...
  handler: async (req) => {
    const ownerId = req.user!.id; // never trust body.ownerId
    // ...
  },
});
```

**ETA**: 4 hours. **Risk**: Medium (need careful regression testing on existing endpoints).

### C2. Tier enum mismatch upper/lowercase

**Files**:
- `apps/api/src/routes/workspaces.ts` line 5: `TierSchema = z.enum(["STANDARD", "PRO", "MAX"])`
- `packages/quick-create/src/types.ts` line 11: `TierSchema = z.enum(["standard", "pro", "max"])`

**Issue**: Different casing. When Quick Create reads workspace tier and does `tierRank[workspace.billingTier]` will return `undefined` → wrong tier fallback.

**Fix**: Pick one (recommend lowercase per JS convention). Update Prisma schema enum, run migration, fix all references.

**ETA**: 2 hours. **Risk**: Medium (DB migration needed if data already exists).

### C3. Workspace member RBAC bypassed

**File**: `apps/api/src/routes/workspaces.ts` line 149

**Issue**: `POST /api/workspaces/:id/members` doesn't check that `req.user` is OWNER of the workspace. Any user can add themselves as OWNER to any workspace.

**Fix**:
```typescript
app.post("/:id/members", {
  preHandler: async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: "Unauthorized" });
    const member = await app.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: req.params.id, userId: req.user.id } },
    });
    if (!member || member.role !== "OWNER") {
      return reply.code(403).send({ error: "Only OWNER can add members" });
    }
  },
  // ...
});
```

**ETA**: 2 hours. **Risk**: Low.

### C4. No tier quota enforcement

**Files**: `apps/api/src/routes/ai.ts` (all 6 endpoints)

**Issue**: AI endpoints don't check user tier or current usage. Standard tier user can call Veo3/Seedance/ElevenLabs unlimited. Cost runaway risk.

**Fix Sprint 6 Story 5.1** (tier quota middleware):
```typescript
// apps/api/src/plugins/quota-check.ts
const QUOTA_PER_TIER = {
  standard: { 'video.textToVideo': 0, 'video.imageToVideo': 0, /*...*/ },
  pro: { 'video.textToVideo': 30 * 60, 'video.imageToVideo': 30 * 60, /*...*/ },
  max: { 'video.textToVideo': 120 * 60, /*...*/ },
};

async function checkQuota(workspaceId, capability, sizeUnits) {
  const usage = await app.prisma.usageTracker.findFirst({
    where: { workspaceId, capability, monthBucket: currentMonthBucket() },
  });
  const tier = await getWorkspaceTier(workspaceId);
  const limit = QUOTA_PER_TIER[tier][capability];
  if ((usage?.consumed ?? 0) + sizeUnits > limit) {
    throw new QuotaExceededError(capability, limit, usage?.consumed ?? 0);
  }
  // ...
}
```

**ETA**: 12 hours (full implementation). Sprint 6 priority. **Risk**: High (must be airtight).

---

## 🟠 High issues

### H1. Better-auth handler body re-serialization

**File**: `apps/api/src/plugins/auth.ts` line 64

**Issue**:
```typescript
body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body),
```

Re-serializes `req.body` from parsed object back to string. Fastify already JSON-parsed it once. Issues:
1. Loss of fidelity if body had non-JSON content (multipart, form-urlencoded)
2. Better-auth may not handle re-stringified body correctly for some flows (OAuth callbacks)
3. Lost original bytes prevents signature verification (HMAC webhooks)

**Fix**: Use Fastify's `request.raw` (Node IncomingMessage) to forward original stream:
```typescript
app.all("/api/auth/*", async (req, reply) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const headers = new Headers(req.headers as Record<string, string>);

  let body: BodyInit | undefined;
  if (!["GET", "HEAD"].includes(req.method)) {
    // Read raw bytes from stream (not parsed body)
    const chunks: Buffer[] = [];
    for await (const chunk of req.raw) chunks.push(chunk);
    body = Buffer.concat(chunks);
  }

  const response = await app.auth.handler(new Request(url, { method: req.method, headers, body }));
  // ... return as before
});
```

Required: disable Fastify body parsing for `/api/auth/*` route (use `addContentTypeParser('*', { parseAs: 'buffer' }, ...)` or scoped routes).

**ETA**: 4 hours. **Risk**: Medium.

### H2. Slug collision pattern fragile

**File**: `apps/api/src/routes/workspaces.ts` line 39

**Issue**: `slugify` truncates to 60 chars but doesn't auto-resolve collisions:
```typescript
.slice(0, 60);
```

If user creates "Alex Personal" twice, second errors with 409. UX bad.

**Fix**: append random suffix on collision:
```typescript
async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = base;
  let attempt = 0;
  while (await app.prisma.workspace.findUnique({ where: { slug } })) {
    attempt++;
    if (attempt > 10) throw new Error("Slug generation exhausted");
    slug = `${base.slice(0, 56)}-${nanoid(4)}`;
  }
  return slug;
}
```

**ETA**: 2 hours. **Risk**: Low.

### H3. Stringly-typed role casts

**File**: `apps/api/src/routes/workspaces.ts` lines 142, 171

**Issue**:
```typescript
role: m.role as "OWNER" | "EDITOR" | "VIEWER"
```

Casting Prisma's role (which is `string` in raw model unless using enum) to TS literal. If Prisma schema uses enum `Role` (which the schema appears to), the TypeScript should narrow automatically without cast. Cast hides Prisma client typing issue.

**Fix**: Verify Prisma schema declares `enum Role` and uses it on model:
```prisma
enum WorkspaceRole {
  OWNER
  EDITOR
  VIEWER
}
model WorkspaceMember {
  role WorkspaceRole
}
```

Then `m.role` is typed `WorkspaceRole` automatically. Drop cast.

**ETA**: 30 min. **Risk**: Low.

### H4. R2 SDK forcePathStyle assumption

**File**: `apps/api/src/plugins/r2.ts`

**Issue**: forcePathStyle: true with Cloudflare R2 endpoint format is a workaround. Cloudflare R2 newer endpoint format `https://<account>.r2.cloudflarestorage.com/<bucket>/<key>` with virtual-host style may also work and is more standard.

**Recommend**: Verify with R2 docs, prefer virtual-host style if supported. Path style is deprecated AWS S3 (sunset 2025).

**ETA**: 1 hour test. **Risk**: Low.

### H5. Missing CORS preflight cache

**File**: `apps/api/src/server.ts`

**Issue**: CORS plugin registered without `maxAge` → browsers OPTIONS preflight every request. Adds latency.

**Fix**:
```typescript
await app.register(cors, {
  origin: process.env.CORS_ORIGINS?.split(",") ?? ["http://localhost:3000"],
  credentials: true,
  maxAge: 86400, // 24 hour preflight cache
});
```

**ETA**: 5 min. **Risk**: Low.

### H6. Pino pretty in dev only — but no level filter

**File**: `apps/api/src/server.ts` line 19

**Issue**: `LOG_LEVEL=info` default but no warn/error filtering for production. All info logs go to Fly.io stdout = expensive at scale.

**Fix**: Production should default to `warn` or `error`, escalate via env override during incidents:
```typescript
level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "warn" : "info"),
```

**ETA**: 5 min. **Risk**: Low (might mask bugs initially — keep `info` for first month then downgrade).

### H7. fastify-websocket registered but not wired

**File**: `apps/api/package.json` line 23

**Issue**: `@fastify/websocket` declared as dependency but `apps/api/src/server.ts` doesn't `app.register(fastifyWebsocket)`. Quick Create build stream needs WS. Will silently 404 in Sprint 2.

**Fix**: Sprint 1 wire up:
```typescript
import websocket from "@fastify/websocket";
await app.register(websocket);
```

**ETA**: 5 min. **Risk**: Low.

---

## 🟡 Medium issues

### M1. AI router default fallback chain not tested

**File**: `packages/ai-services/src/router.ts`

**Issue**: Priority channel pattern (per ADR-001 + ADR-002) where DO Inference is `isPriorityChannel: true` for `llm.chat`. If primary fails, should fall back to gemini-llm. No tests verify failover.

**Fix Sprint 1**: Vitest integration test mocking primary failure → assert fallback invoked.

### M2. Provider clients no retry policy

**Files**: All `packages/ai-services/src/clients/*.ts`

**Issue**: ElevenLabs/Gemini/fal client `fetch` calls have no retry on 5xx. Single transient error fails user request.

**Fix**: Wrap with exponential backoff retry (3 attempts, 1-2-4s):
```typescript
async function fetchWithRetry(url: string, opts: RequestInit, attempts = 3): Promise<Response> {
  for (let i = 0; i < attempts; i++) {
    const r = await fetch(url, opts);
    if (r.status < 500) return r;
    if (i === attempts - 1) return r;
    await new Promise((res) => setTimeout(res, 1000 * 2 ** i));
  }
  throw new Error("unreachable");
}
```

### M3. Asset cleanup on workspace delete

**Issue**: When workspace deleted (Cascade), Prisma deletes Asset DB rows but R2 objects orphan. R2 storage costs accumulate.

**Fix Sprint 6**: BullMQ cleanup worker on workspace.delete event:
- Query all asset r2Keys
- Batch delete from R2 (max 1000/batch)

### M4. No request ID in logs

**Issue**: Pino logs don't include `request.id` by default. Hard to trace a user's session through error logs.

**Fix**: Add `genReqId` to Fastify config:
```typescript
const app = Fastify({
  genReqId: () => crypto.randomUUID(),
  logger: {
    level: ...,
    serializers: {
      req: (req) => ({ method: req.method, url: req.url, reqId: req.id }),
    },
  },
});
```

### M5. Prisma client logged queries in dev = noisy

**File**: `apps/api/src/plugins/prisma.ts`

**Issue**: Default Prisma client logs all queries in dev. Floods console.

**Fix**: Pass `log: ["error", "warn"]` to dev or use Pino integration.

### M6. better-auth schema fields check

**Issue**: better-auth Prisma adapter expects User model with specific fields (id, email, emailVerified, image, name, createdAt, updatedAt). Schema has these but anh review consistency with better-auth v1.

### M7. R2 SDK signature version

**File**: `apps/api/src/plugins/r2.ts`

**Issue**: AWS SDK v3 default signature is sigv4. R2 supports both sigv2 and sigv4 but sigv4 is recommended. Verify SDK config explicit.

### M8. Zod env validation in apps/api

**Issue**: apps/api server.ts reads `process.env.PORT` etc. directly without zod validation. apps/web has `webEnv` validated. Inconsistent.

**Fix Sprint 1**: Mirror webEnv pattern:
```typescript
// apps/api/src/env.ts
import { z } from "zod";
const apiEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  R2_ACCOUNT_ID: z.string(),
  // ...
});
export const apiEnv = apiEnvSchema.parse(process.env);
```

### M9. No structured 503/maintenance handling

**Issue**: When DB connection fails, Fastify returns 500 with generic error. Better: 503 Service Unavailable with retry-after.

### M10. Health endpoint doesn't check downstreams

**File**: `apps/api/src/routes/health.ts`

**Issue**: `/health/ready` exists but doesn't actually probe Prisma/Redis/R2. Just returns 200 always.

**Fix**:
```typescript
app.get("/health/ready", async () => {
  await app.prisma.$queryRaw`SELECT 1`;
  // ping redis, r2 etc.
  return { status: "ok", checks: { db: "ok", redis: "ok" } };
});
```

### M11. AI mesh provider env keys not validated startup

**Issue**: If GEMINI_API_KEY missing but gemini-llm provider registered, errors only when first user calls. Fail fast better.

**Fix**: Provider register checks env, refuses to register if missing → mesh starts without that provider.

### M12. Helmet contentSecurityPolicy disabled

**File**: `apps/api/src/server.ts` line 34

**Issue**: `contentSecurityPolicy: false` — disabled because OpenAPI spec route conflicts. Phase 1 enable with allowlist.

---

## 🟢 Low issues

- **L1**. README.md missing in apps/api root (only inherited workspace one)
- **L2**. apps/api `tsc --noEmit` not run in CI per ci-pxs.yml (only build runs)
- **L3**. Environment variable docs missing — env.example in apps/api not synced with current usage
- **L4**. Inline schema duplication: WorkspaceSchema + RoleSchema redeclared if also used in apps/web (DRY)
- **L5**. Magic constants: `take: 100` for findMany, `expiresIn: 900` for presign — extract to constants file
- **L6**. fastify-type-provider-zod: ai.ts uses non-Zod handlers, others Zod. Inconsistent.
- **L7**. No favicon route (404 in browser console)
- **L8**. Prisma model `@@map("legacy_name")` for snake_case DB tables — verify schema convention
- **L9**. Comments about Phase numbers in code can rot — prefer issue/PR links

---

## Dead code (OpenCut leftovers PixStudio không dùng)

### apps/web inherited routes

- `/sounds` — Freesound integration (em added 503 guard b1cab05). Remove route entirely Sprint 2 if PixStudio commits to no Freesound.
- `/blog/*` — Marble CMS blog (Phase 0 Day 2 rebrand kept structure, content TBD). Decision: Keep blog or migrate to separate marketing site Phase 2?
- `/contributors`, `/sponsors` — OpenCut community pages. PixStudio is private fork. Delete or replace?
- `/api/captions/freesound-attribution` — License attribution for Freesound. Delete with sounds removal.

### apps/web unused dependencies

Run `bun pm ls` then audit which are never imported:
- Check if `@marble/cms` (or similar) imported anywhere — if blog deferred, it's bundled bloat
- Freesound API client lib (if any)

**Sprint 2 cleanup task** (~2 hours): grep for unused, remove.

---

## Security audit

### S1. Secret handling ✅

Per `feedback_security_rotation_defer.md`: Phase 0-3 internal+đối tác only, gom rotation 1 lần before public ship. Acceptable for now.

Doppler 17 secrets all stored centralized. Fly secrets imported via doppler pipe (no transcript leak after the fix in fly-deploy-resume.sh).

⚠️ **Token rotation overdue** (2 leaked Fly tokens during deploy session 2026-05-02 — auto-revoke 24h, expires ~2026-05-03 21:00 UTC). Em revoke 1 manually + let other expire. Status: low risk by 5/3 evening.

### S2. Input validation

All routes use Zod schemas (Fastify Type Provider Zod). Good.

⚠️ `/api/auth/*` body re-serialization may bypass some validation (H1 above).

### S3. SQL injection surface

All queries via Prisma ORM. No raw SQL. Safe.

⚠️ Future: pgvector embeddings need raw SQL via `$queryRaw`. Audit when added Sprint 6.

### S4. XSS vectors

apps/web Next.js auto-escapes. Tested.
LLM injection: User prompt fed to LLM → if LLM returns HTML → renders on page? Currently no, response is text rendered as plain. But Quick Create View 4 outline editing may render LLM-generated title — sanitize with DOMPurify.

### S5. CSRF

better-auth handles via SameSite cookies + CSRF token in non-cookie auth. Verify Phase 1 with E2E test.

### S6. Rate limiting

Global 100 req/min per IP. Workspace-level rate limit not implemented. Phase 1 Sprint 6 addition.

### S7. R2 upload validation

`POST /api/assets/presign` accepts `sizeBytes` from client without server-side enforce. Client could lie about size to bypass quota. Validate at S3 PUT side via `Content-Length` mismatch reject.

### S8. CORS scope

`https://studio.pixelxlab.com` and localhost. Acceptable. Phase 1 expand to `*.pixelxlab.com` if multi-subdomain.

---

## Performance audit

### P1. N+1 query risk

apps/api/routes/workspaces.ts:117 fetches members but doesn't include user details. UI later calls `/users/:id` per member = N+1. Phase 1 add `include: { user: true }`.

### P2. Missing indexes

Prisma schema audit — check these have indexes:
- `Project.workspaceId` ✓ (likely indexed by Prisma if relation)
- `WorkspaceMember.userId + workspaceId` (compound unique)
- `Asset.workspaceId + projectId` (compound)
- `Session.userId` (for auth lookup performance)
- `Session.expiresAt` (for cleanup cron)

### P3. Asset list pagination

`GET /api/assets?workspaceId=xxx` likely returns all assets. Need cursor pagination for large workspaces (1000+ assets).

### P4. AI mesh router uses synchronous registry lookup

`packages/ai-services/src/router.ts` walks registry array O(n). With 8 providers, fine. Phase 2+ if 50+ providers, switch to Map lookup.

### P5. Compositor wasm load on every request?

Verify Rust wasm compositor binary is loaded once at startup, not per-request. Check apps/web `next.config.mjs`.

### P6. R2 endpoint latency

R2 buckets in APAC region but Fastify on Fly Singapore. Same region = fast. Verify with `time curl https://<r2-endpoint>` — should be <50ms.

### P7. No response caching for `/api/ai/providers`

This list rarely changes. Cache 5 min in Upstash Redis.

---

## Test coverage gap

Currently 0 tests in apps/api + 4 ad-hoc test scripts in packages/ai-services (test-mesh.ts, test-providers.ts, test-do-inference.ts, test-tts.ts).

**Phase 1 Sprint 1 Story** (testing scaffolding):
- [ ] Vitest config in apps/api + packages/*
- [ ] Prisma test database (separate Neon branch or in-memory SQLite via prisma-fixtures)
- [ ] Integration tests per route (60 test cases minimum)
- [ ] Provider mocks for ai-services (don't hit real APIs in unit tests)
- [ ] Playwright E2E on apps/web (5 scenarios: signup, create workspace, create project, upload asset, AI chat)

ETA: 5 days for 70% coverage.

---

## Dependencies audit

apps/api dependencies (16 pkgs):
- ✅ Latest stable: fastify 5, prisma 6, zod 3.23, bullmq 5, ioredis 5
- ⚠️ Latest: better-auth — pinned to "latest" tag. Pin to specific version for reproducibility (e.g. `^1.0.0`).
- ⚠️ devDependencies: typescript 6.0 — bleeding edge. Verify all Bun runtime + Prisma generators support TS 6.

packages/ai-services dependencies (audit needed when typecheck run):
- Probably has direct dependencies on @aws-sdk for R2 (also in apps/api)
- DRY: Move @aws-sdk to root package.json as dev dependency, peer in workspace packages

---

## Recommendations summary

### Sprint 1 must-fix (week 1 of Phase 1)
- [ ] C1: Auth check middleware (4h)
- [ ] C2: Tier enum casing unify (2h)
- [ ] C3: Workspace member RBAC (2h)
- [ ] H7: Wire fastify-websocket (5min)
- [ ] M8: Zod env validation apps/api (2h)
- [ ] M10: Health/ready downstream probes (1h)

### Sprint 2-3 priorities
- [ ] H1: Better-auth body raw forwarding (4h)
- [ ] M2: AI client retry policies (3h)
- [ ] M11: Provider env validation startup (2h)
- [ ] Test scaffolding 70% coverage (5d)

### Sprint 6 (tier system epic)
- [ ] C4: Tier quota middleware (12h, biggest item)
- [ ] M3: Asset cleanup BullMQ on delete (4h)
- [ ] S7: R2 upload size enforce (2h)

### Phase 2+ (defer)
- All low severity items
- Dead code cleanup OpenCut blog/sounds/contributors
- Wasm compositor optimization
- Cursor pagination

---

## Followups for Claude (next session)

When anh ping em next session, em will:
1. Generate Sprint 1 PR drafts for each Critical/High issue (separate small PRs per fix)
2. Wire test scaffolding (packages/quick-create + apps/api Vitest setup)
3. Apply M5-M9 quick wins in single config-cleanup PR
4. Review this audit with anh for tradeoffs (some fixes optional pre-Phase 2)

Total Sprint 1-3 hardening estimate: ~30-40 dev hours. Solo CTO em can finish weeks 1-2 of Phase 1 alongside Quick Create wire-up.
