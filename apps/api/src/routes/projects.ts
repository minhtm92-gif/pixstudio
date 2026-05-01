import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

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
  app.get("/", {
    schema: {
      querystring: z.object({
        workspaceId: z.string().optional(),
        archived: z.coerce.boolean().optional(),
      }),
      response: { 200: z.object({ items: z.array(ProjectSchema) }) },
    },
    handler: async (req) => {
      const where: Record<string, unknown> = {};
      if (req.query.workspaceId) where.workspaceId = req.query.workspaceId;
      if (req.query.archived !== undefined) where.archived = req.query.archived;
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
      response: { 201: ProjectSchema },
    },
    handler: async (req, reply) => {
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
      response: { 200: ProjectSchema, 404: z.object({ error: z.string() }) },
    },
    handler: async (req, reply) => {
      const project = await app.prisma.project.findUnique({ where: { id: req.params.id } });
      if (!project) {
        reply.status(404);
        return { error: "Project not found" };
      }
      return serializeProject(project);
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
      response: { 200: ProjectSchema, 404: z.object({ error: z.string() }) },
    },
    handler: async (req, reply) => {
      try {
        const project = await app.prisma.project.update({
          where: { id: req.params.id },
          data: { ...req.body, lastEditedAt: new Date() },
        });
        return serializeProject(project);
      } catch {
        reply.status(404);
        return { error: "Project not found" };
      }
    },
  });

  app.delete("/:id", {
    schema: {
      params: z.object({ id: z.string() }),
      response: { 204: z.null(), 404: z.object({ error: z.string() }) },
    },
    handler: async (req, reply) => {
      try {
        await app.prisma.project.delete({ where: { id: req.params.id } });
        reply.status(204);
        return null;
      } catch {
        reply.status(404);
        return { error: "Project not found" };
      }
    },
  });
};
