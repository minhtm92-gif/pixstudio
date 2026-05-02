import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireUser } from "../plugins/require-auth.js";

const ProjectSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  thumbnailKey: z.string().nullable().optional(),
  archived: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastEditedAt: z.string(),
});

const serializeProject = (p: {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  thumbnailKey: string | null;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastEditedAt: Date;
}) => ({
  id: p.id,
  workspaceId: p.workspaceId,
  name: p.name,
  description: p.description,
  thumbnailKey: p.thumbnailKey,
  archived: p.archived,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
  lastEditedAt: p.lastEditedAt.toISOString(),
});

export const projectsRoutes: FastifyPluginAsyncZod = async (app) => {
  // Helper: ensure caller is member of workspace.
  async function ensureMember(workspaceId: string, userId: string) {
    return app.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
  }

  app.get("/", {
    schema: {
      querystring: z.object({
        workspaceId: z.string(),
        archived: z.coerce.boolean().optional(),
      }),
      response: {
        200: z.object({ items: z.array(ProjectSchema) }),
        403: z.object({ error: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const member = await ensureMember(req.query.workspaceId, user.id);
      if (!member) {
        reply.status(403);
        return { error: "Not a member of this workspace" };
      }
      const where: Record<string, unknown> = { workspaceId: req.query.workspaceId };
      if (req.query.archived !== undefined) where["archived"] = req.query.archived;
      const items = await app.prisma.project.findMany({
        where,
        orderBy: { lastEditedAt: "desc" },
        take: 100,
      });
      return { items: items.map(serializeProject) };
    },
  });

  app.post("/", {
    schema: {
      body: z.object({
        workspaceId: z.string(),
        name: z.string().min(1).max(120),
        description: z.string().max(500).optional(),
      }),
      response: { 201: ProjectSchema, 403: z.object({ error: z.string() }) },
    },
    handler: async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const member = await ensureMember(req.body.workspaceId, user.id);
      if (!member || member.role === "VIEWER") {
        reply.status(403);
        return { error: "Need EDITOR or OWNER role to create projects" };
      }
      const project = await app.prisma.project.create({
        data: {
          workspaceId: req.body.workspaceId,
          name: req.body.name,
          description: req.body.description,
        },
      });
      reply.status(201);
      return serializeProject(project);
    },
  });

  app.get("/:id", {
    schema: {
      params: z.object({ id: z.string() }),
      response: {
        200: ProjectSchema,
        403: z.object({ error: z.string() }),
        404: z.object({ error: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const project = await app.prisma.project.findUnique({ where: { id: req.params.id } });
      if (!project) {
        reply.status(404);
        return { error: "Project not found" };
      }
      const member = await ensureMember(project.workspaceId, user.id);
      if (!member) {
        reply.status(403);
        return { error: "Not a member of this workspace" };
      }
      return serializeProject(project);
    },
  });

  // === Sprint 3 Story 3.2: Cloud sync editor state ===
  // GET /:id/editor-state — fetch current full editor state JSON for sync on load.
  app.get("/:id/editor-state", {
    schema: { params: z.object({ id: z.string() }) },
    handler: async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const project = await app.prisma.project.findUnique({
        where: { id: req.params.id },
      });
      if (!project) {
        reply.code(404);
        return { error: "Project not found" };
      }
      const member = await ensureMember(project.workspaceId, user.id);
      if (!member) {
        reply.code(403);
        return { error: "Not a member" };
      }
      return {
        projectId: project.id,
        editorStateJson:
          (project as { editorStateJson: unknown }).editorStateJson ?? null,
        version: (project as { editorStateVersion: number }).editorStateVersion,
        lastEditedAt: project.lastEditedAt.toISOString(),
      };
    },
  });

  app.patch("/:id", {
    schema: {
      params: z.object({ id: z.string() }),
      body: z.object({
        name: z.string().min(1).max(120).optional(),
        description: z.string().max(500).nullable().optional(),
        archived: z.boolean().optional(),
      }),
      response: {
        200: ProjectSchema,
        403: z.object({ error: z.string() }),
        404: z.object({ error: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const existing = await app.prisma.project.findUnique({ where: { id: req.params.id } });
      if (!existing) {
        reply.status(404);
        return { error: "Project not found" };
      }
      const member = await ensureMember(existing.workspaceId, user.id);
      if (!member || member.role === "VIEWER") {
        reply.status(403);
        return { error: "Need EDITOR or OWNER role to update projects" };
      }
      const project = await app.prisma.project.update({
        where: { id: req.params.id },
        data: { ...req.body, lastEditedAt: new Date() },
      });
      return serializeProject(project);
    },
  });

  // === Sprint 3 Story 3.3: Auto-save editor state + version history ===

  // POST /:id/auto-save — debounced from web client every 30s.
  // Updates Project.editorStateJson + bumps version. Snapshots ProjectVersion
  // every 10 saves OR if last snapshot >5min ago (configurable).
  app.post("/:id/auto-save", {
    schema: {
      params: z.object({ id: z.string() }),
      body: z.object({
        editorStateJson: z.record(z.string(), z.unknown()),
        clientVersion: z.number().int().nonnegative(), // for conflict detection
      }),
      response: {
        200: z.object({
          version: z.number(),
          savedAt: z.string(),
          snapshotCreated: z.boolean(),
        }),
        403: z.object({ error: z.string() }),
        404: z.object({ error: z.string() }),
        409: z.object({ error: z.string(), serverVersion: z.number() }),
      },
    },
    handler: async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const project = await app.prisma.project.findUnique({
        where: { id: req.params.id },
      });
      if (!project) {
        reply.code(404);
        return { error: "Project not found" };
      }
      const member = await ensureMember(project.workspaceId, user.id);
      if (!member || member.role === "VIEWER") {
        reply.code(403);
        return { error: "Need EDITOR or OWNER role" };
      }

      // Conflict detection: if client's version < server, reject (stale state).
      if (req.body.clientVersion < (project as { editorStateVersion?: number }).editorStateVersion!) {
        reply.code(409);
        return {
          error: "Stale editor state — pull latest version first",
          serverVersion: (project as { editorStateVersion: number }).editorStateVersion,
        };
      }

      const newVersion = (project as { editorStateVersion: number }).editorStateVersion + 1;
      const updated = await app.prisma.project.update({
        where: { id: req.params.id },
        data: {
          editorStateJson: req.body.editorStateJson as never,
          editorStateVersion: newVersion,
          lastEditedAt: new Date(),
        },
      });

      // Snapshot policy: every 10 versions OR if last snapshot >5min ago.
      const SNAPSHOT_INTERVAL = 10;
      const SNAPSHOT_MAX_AGE_MIN = 5;
      let snapshotCreated = false;
      if (newVersion % SNAPSHOT_INTERVAL === 0) {
        await app.prisma.projectVersion.create({
          data: {
            projectId: req.params.id,
            versionNumber: newVersion,
            editorStateJson: req.body.editorStateJson as never,
            triggeredBy: user.id,
            triggerReason: "auto-save",
          },
        });
        snapshotCreated = true;
      } else {
        const last = await app.prisma.projectVersion.findFirst({
          where: { projectId: req.params.id },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        });
        const ageMin = last
          ? (Date.now() - last.createdAt.getTime()) / 60000
          : Infinity;
        if (ageMin > SNAPSHOT_MAX_AGE_MIN) {
          await app.prisma.projectVersion.create({
            data: {
              projectId: req.params.id,
              versionNumber: newVersion,
              editorStateJson: req.body.editorStateJson as never,
              triggeredBy: user.id,
              triggerReason: "auto-save",
            },
          });
          snapshotCreated = true;
        }
      }

      return {
        version: newVersion,
        savedAt: updated.updatedAt.toISOString(),
        snapshotCreated,
      };
    },
  });

  // POST /:id/snapshot — manual snapshot (e.g. before risky edit).
  app.post("/:id/snapshot", {
    schema: {
      params: z.object({ id: z.string() }),
      body: z.object({
        label: z.string().max(120).optional(),
        triggerReason: z.string().max(50).default("manual"),
      }),
    },
    handler: async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const project = await app.prisma.project.findUnique({
        where: { id: req.params.id },
      });
      if (!project) {
        reply.code(404);
        return { error: "Project not found" };
      }
      const member = await ensureMember(project.workspaceId, user.id);
      if (!member || member.role === "VIEWER") {
        reply.code(403);
        return { error: "Need EDITOR or OWNER role" };
      }
      const editorState = (project as { editorStateJson: unknown }).editorStateJson;
      if (!editorState) {
        reply.code(400);
        return { error: "No editor state to snapshot" };
      }
      const version = await app.prisma.projectVersion.create({
        data: {
          projectId: req.params.id,
          versionNumber: (project as { editorStateVersion: number }).editorStateVersion,
          editorStateJson: editorState as never,
          label: req.body.label,
          triggeredBy: user.id,
          triggerReason: req.body.triggerReason,
        },
      });
      reply.code(201);
      return {
        id: version.id,
        versionNumber: version.versionNumber,
        createdAt: version.createdAt.toISOString(),
      };
    },
  });

  // GET /:id/versions — list project version history.
  app.get("/:id/versions", {
    schema: {
      params: z.object({ id: z.string() }),
      querystring: z.object({
        limit: z.coerce.number().int().min(1).max(100).default(20),
      }),
    },
    handler: async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const project = await app.prisma.project.findUnique({
        where: { id: req.params.id },
      });
      if (!project) {
        reply.code(404);
        return { error: "Project not found" };
      }
      const member = await ensureMember(project.workspaceId, user.id);
      if (!member) {
        reply.code(403);
        return { error: "Not a member" };
      }
      const versions = await app.prisma.projectVersion.findMany({
        where: { projectId: req.params.id },
        orderBy: { versionNumber: "desc" },
        take: req.query.limit,
        select: {
          id: true,
          versionNumber: true,
          label: true,
          triggeredBy: true,
          triggerReason: true,
          thumbnailKey: true,
          createdAt: true,
        },
      });
      return {
        items: versions.map((v) => ({
          id: v.id,
          versionNumber: v.versionNumber,
          label: v.label,
          triggeredBy: v.triggeredBy,
          triggerReason: v.triggerReason,
          thumbnailKey: v.thumbnailKey,
          createdAt: v.createdAt.toISOString(),
        })),
      };
    },
  });

  // POST /:id/versions/:versionId/restore — revert to old version.
  app.post("/:id/versions/:versionId/restore", {
    schema: {
      params: z.object({
        id: z.string(),
        versionId: z.string(),
      }),
    },
    handler: async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const project = await app.prisma.project.findUnique({
        where: { id: req.params.id },
      });
      if (!project) {
        reply.code(404);
        return { error: "Project not found" };
      }
      const member = await ensureMember(project.workspaceId, user.id);
      if (!member || member.role === "VIEWER") {
        reply.code(403);
        return { error: "Need EDITOR or OWNER role" };
      }
      const version = await app.prisma.projectVersion.findUnique({
        where: { id: req.params.versionId },
      });
      if (!version || version.projectId !== req.params.id) {
        reply.code(404);
        return { error: "Version not found" };
      }
      // Save current state as auto-snapshot before revert.
      await app.prisma.projectVersion.create({
        data: {
          projectId: req.params.id,
          versionNumber: (project as { editorStateVersion: number }).editorStateVersion,
          editorStateJson: (project as { editorStateJson: unknown }).editorStateJson as never,
          label: `Auto-snapshot before revert to v${version.versionNumber}`,
          triggeredBy: user.id,
          triggerReason: "before-revert",
        },
      });
      // Apply restored state.
      const newVersion = (project as { editorStateVersion: number }).editorStateVersion + 1;
      const restored = await app.prisma.project.update({
        where: { id: req.params.id },
        data: {
          editorStateJson: version.editorStateJson as never,
          editorStateVersion: newVersion,
          lastEditedAt: new Date(),
        },
      });
      return {
        version: newVersion,
        restoredAt: restored.updatedAt.toISOString(),
        restoredFromVersion: version.versionNumber,
      };
    },
  });

  app.delete("/:id", {
    schema: {
      params: z.object({ id: z.string() }),
      response: {
        204: z.null(),
        403: z.object({ error: z.string() }),
        404: z.object({ error: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const existing = await app.prisma.project.findUnique({ where: { id: req.params.id } });
      if (!existing) {
        reply.status(404);
        return { error: "Project not found" };
      }
      const member = await ensureMember(existing.workspaceId, user.id);
      if (!member || member.role !== "OWNER") {
        reply.status(403);
        return { error: "Only OWNER can delete projects" };
      }
      await app.prisma.project.delete({ where: { id: req.params.id } });
      reply.status(204);
      return null;
    },
  });
};
