/**
 * Asset routes — presigned upload URL flow + DB metadata.
 * Phase 0/Sprint 1: client requests presigned PUT URL → uploads direct R2 →
 * client POST /complete to register asset row in DB.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireUser } from "../plugins/require-auth.js";

const AssetTypeSchema = z.enum([
  "VIDEO",
  "IMAGE",
  "MUSIC",
  "CHARACTER",
  "SCRIPT",
  "TTS_AUDIO",
  "AI_GEN_IMAGE",
  "AI_GEN_VIDEO",
]);

const AssetSourceSchema = z.enum(["USER_UPLOAD", "STOCK_POOL", "AI_GEN", "TEMPLATE"]);

const AssetSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  type: AssetTypeSchema,
  source: AssetSourceSchema,
  name: z.string(),
  r2Key: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  durationMs: z.number().nullable().optional(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  createdAt: z.string(),
});

const buildR2Key = (projectId: string, type: string, name: string) => {
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${projectId}/${type.toLowerCase()}/${stamp}-${rand}${ext}`;
};

export const assetsRoutes: FastifyPluginAsyncZod = async (app) => {
  // Helper: ensure caller is member of workspace owning this project (audit C1).
  async function requireProjectAccess(
    projectId: string,
    userId: string,
    minRole: "VIEWER" | "EDITOR" | "OWNER" = "EDITOR",
  ) {
    const project = await app.prisma.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    });
    if (!project) return null;
    const member = await app.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } },
    });
    if (!member) return null;
    const rank = { VIEWER: 0, EDITOR: 1, OWNER: 2 };
    if (rank[member.role as keyof typeof rank] < rank[minRole]) return null;
    return { project, member };
  }

  // === POST /presign — request presigned PUT URL ===
  app.post("/presign", {
    schema: {
      body: z.object({
        projectId: z.string(),
        name: z.string().min(1).max(255),
        type: AssetTypeSchema,
        mimeType: z.string(),
        sizeBytes: z.number().int().positive().max(2 * 1024 * 1024 * 1024), // 2GB cap
      }),
      response: {
        200: z.object({
          uploadUrl: z.string(),
          r2Key: z.string(),
          bucket: z.string(),
          expiresIn: z.number(),
        }),
        403: z.object({ error: z.string() }),
        503: z.object({ error: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const access = await requireProjectAccess(req.body.projectId, user.id, "EDITOR");
      if (!access) {
        reply.status(403);
        return { error: "Need EDITOR or OWNER role on workspace owning this project" };
      }
      if (!app.r2) {
        reply.status(503);
        return { error: "R2 not configured (check R2_ACCESS_KEY_ID env)" };
      }
      const r2Key = buildR2Key(req.body.projectId, req.body.type, req.body.name);
      const cmd = new PutObjectCommand({
        Bucket: app.r2Buckets.uploads,
        Key: r2Key,
        ContentType: req.body.mimeType,
        ContentLength: req.body.sizeBytes,
      });
      const uploadUrl = await getSignedUrl(app.r2, cmd, { expiresIn: 900 }); // 15 min
      return {
        uploadUrl,
        r2Key,
        bucket: app.r2Buckets.uploads,
        expiresIn: 900,
      };
    },
  });

  // === POST /complete — register asset metadata after client uploads ===
  app.post("/complete", {
    schema: {
      body: z.object({
        projectId: z.string(),
        name: z.string().min(1).max(255),
        type: AssetTypeSchema,
        source: AssetSourceSchema.optional(),
        r2Key: z.string(),
        mimeType: z.string(),
        sizeBytes: z.number().int().positive(),
        durationMs: z.number().int().positive().optional(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
      }),
      response: { 201: AssetSchema },
    },
    handler: async (req, reply) => {
      const asset = await app.prisma.asset.create({
        data: {
          projectId: req.body.projectId,
          type: req.body.type,
          source: req.body.source ?? "USER_UPLOAD",
          name: req.body.name,
          r2Key: req.body.r2Key,
          mimeType: req.body.mimeType,
          sizeBytes: BigInt(req.body.sizeBytes),
          durationMs: req.body.durationMs,
          width: req.body.width,
          height: req.body.height,
        },
      });
      reply.status(201);
      return {
        id: asset.id,
        projectId: asset.projectId,
        type: asset.type as z.infer<typeof AssetTypeSchema>,
        source: asset.source as z.infer<typeof AssetSourceSchema>,
        name: asset.name,
        r2Key: asset.r2Key,
        mimeType: asset.mimeType,
        sizeBytes: Number(asset.sizeBytes),
        durationMs: asset.durationMs,
        width: asset.width,
        height: asset.height,
        createdAt: asset.createdAt.toISOString(),
      };
    },
  });

  // === GET /:id/url — presigned GET URL (download) ===
  app.get("/:id/url", {
    schema: {
      params: z.object({ id: z.string() }),
      querystring: z.object({ expiresIn: z.coerce.number().int().min(60).max(86400).default(3600) }),
      response: {
        200: z.object({ downloadUrl: z.string(), expiresIn: z.number() }),
        404: z.object({ error: z.string() }),
        503: z.object({ error: z.string() }),
      },
    },
    handler: async (req, reply) => {
      if (!app.r2) {
        reply.status(503);
        return { error: "R2 not configured" };
      }
      const asset = await app.prisma.asset.findUnique({ where: { id: req.params.id } });
      if (!asset) {
        reply.status(404);
        return { error: "Asset not found" };
      }
      const cmd = new GetObjectCommand({
        Bucket: app.r2Buckets.uploads,
        Key: asset.r2Key,
      });
      const downloadUrl = await getSignedUrl(app.r2, cmd, { expiresIn: req.query.expiresIn });
      return { downloadUrl, expiresIn: req.query.expiresIn };
    },
  });

  // === GET / — list assets (filter by projectId) ===
  app.get("/", {
    schema: {
      querystring: z.object({
        projectId: z.string(),
        type: AssetTypeSchema.optional(),
      }),
      response: { 200: z.object({ items: z.array(AssetSchema) }) },
    },
    handler: async (req) => {
      const items = await app.prisma.asset.findMany({
        where: {
          projectId: req.query.projectId,
          ...(req.query.type ? { type: req.query.type } : {}),
        },
        orderBy: { createdAt: "desc" },
      });
      return {
        items: items.map((a) => ({
          id: a.id,
          projectId: a.projectId,
          type: a.type as z.infer<typeof AssetTypeSchema>,
          source: a.source as z.infer<typeof AssetSourceSchema>,
          name: a.name,
          r2Key: a.r2Key,
          mimeType: a.mimeType,
          sizeBytes: Number(a.sizeBytes),
          durationMs: a.durationMs,
          width: a.width,
          height: a.height,
          createdAt: a.createdAt.toISOString(),
        })),
      };
    },
  });

  // === DELETE /:id — remove asset (DB + R2) ===
  app.delete("/:id", {
    schema: {
      params: z.object({ id: z.string() }),
      response: {
        204: z.null(),
        404: z.object({ error: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const asset = await app.prisma.asset.findUnique({ where: { id: req.params.id } });
      if (!asset) {
        reply.status(404);
        return { error: "Asset not found" };
      }
      // Best-effort R2 delete; ignore if R2 not configured
      if (app.r2) {
        try {
          await app.r2.send(
            new DeleteObjectCommand({
              Bucket: app.r2Buckets.uploads,
              Key: asset.r2Key,
            }),
          );
        } catch (err) {
          app.log.warn({ err, r2Key: asset.r2Key }, "R2 delete failed; DB row will still be removed");
        }
      }
      await app.prisma.asset.delete({ where: { id: req.params.id } });
      reply.status(204);
      return null;
    },
  });
};
