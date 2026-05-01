# @pixstudio/api

Fastify backend cho PixStudio — health endpoint + project CRUD stub.

> **Status:** Day 1 5/14 scaffold. Wire-up trong Sprint 1 với better-auth + Prisma + R2 SDK.

## Quick start

```bash
cd apps/api
bun install
doppler run -- bun dev      # dev mode hot reload, port 8080
```

## Endpoints (Phase 0 stub)

```
GET    /health              # liveness check
GET    /health/ready        # readiness (DATABASE_URL + Redis ping)
GET    /api/projects        # list (in-memory stub Phase 0)
POST   /api/projects        # create
GET    /api/projects/:id    # get one
DELETE /api/projects/:id    # delete
```

Test:

```bash
curl http://localhost:8080/health
# {"status":"ok","service":"pixstudio-api","version":"0.1.0","uptime":1.23,"timestamp":"..."}

curl -X POST http://localhost:8080/api/projects \
  -H "Content-Type: application/json" \
  -d '{"workspaceId":"ws-test","name":"My first PixStudio project"}'
```

## Sprint 1 wire-up (5/27-6/6)

Replace in-memory stub với:
- `@prisma/client` for Postgres CRUD (schema in `prisma/schema.prisma`)
- `better-auth` middleware for auth
- Workspace + member + role checks
- R2 storage upload signed URLs

## Tech stack

- **Runtime:** Bun 1.3+
- **Framework:** Fastify 5
- **Validation:** Zod (via fastify-type-provider-zod)
- **Logging:** Pino với pretty transport (dev)
- **CORS / Helmet / Rate-limit:** Standard Fastify plugins
- **Auth (Sprint 1):** better-auth
- **DB (Sprint 1):** Prisma 6 + Postgres 16
- **Cache + queue (Sprint 1):** ioredis + BullMQ

## Env vars (via Doppler)

```
PORT                   # default 8080
HOST                   # default 0.0.0.0
LOG_LEVEL              # default info
NODE_ENV               # development | production
CORS_ORIGINS           # comma-separated origins, default http://localhost:3000
DATABASE_URL           # Postgres connection string (Sprint 1)
REDIS_URL              # Redis connection string (Sprint 1)
NEXTAUTH_SECRET        # better-auth signing key (Sprint 1)
R2_ACCESS_KEY_ID       # ✅ saved Doppler 2026-05-01
R2_SECRET_ACCESS_KEY   # ✅ saved Doppler 2026-05-01
R2_ENDPOINT_URL        # ✅ saved Doppler 2026-05-01
R2_ACCOUNT_ID          # ✅ saved Doppler 2026-05-01
```
