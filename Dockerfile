# PixStudio API — Bun + Fastify + Prisma on Fly.io
FROM oven/bun:1.3.13-alpine AS base
WORKDIR /repo

# Stage 1: Install workspace deps using only manifests (cache-friendly)
FROM base AS deps
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/ai-services/package.json ./packages/ai-services/
COPY packages/brand/package.json ./packages/brand/
COPY packages/quick-create/package.json ./packages/quick-create/
# --ignore-scripts: skip workspace postinstall hooks (apps/api postinstall
# runs `prisma generate`, but prisma/schema.prisma isn't COPYed yet at deps
# stage). Build stage runs `prisma generate` explicitly after full COPY.
RUN bun install --frozen-lockfile --ignore-scripts

# Stage 2: Build (prisma generate)
FROM base AS build
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
RUN cd apps/api && bunx prisma generate

# Stage 3: Runtime
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
# Phase 3 binaries: ffmpeg (render + audio extract + scene detection via select
# filter), yt-dlp (Path B reference video download). Total ~80MB Alpine.
# PySceneDetect dropped — required opencv-python-headless which has no musl
# wheel and would need gcc+cmake to compile (~500MB build deps). FFmpeg's
# built-in `select='gt(scene,X)'` filter detects scene cuts equivalently.
RUN apk add --no-cache ffmpeg yt-dlp
COPY --from=build /repo /repo
WORKDIR /repo/apps/api
EXPOSE 8080
CMD ["bun", "src/server.ts"]
