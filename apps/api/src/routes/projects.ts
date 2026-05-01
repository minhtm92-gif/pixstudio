import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

const ProjectSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string().min(1).max(120),
  createdAt: z.string(),
});

type Project = z.infer<typeof ProjectSchema>;

const stub = new Map<string, Project>();

export const projectsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    schema: {
      querystring: z.object({ workspaceId: z.string().optional() }),
      response: { 200: z.object({ items: z.array(ProjectSchema) }) },
    },
    handler: async (req) => {
      const items = [...stub.values()].filter(
        (p) => !req.query.workspaceId || p.workspaceId === req.query.workspaceId,
      );
      return { items };
    },
  });

  app.post("/", {
    schema: {
      body: z.object({ workspaceId: z.string(), name: z.string().min(1).max(120) }),
      response: { 201: ProjectSchema },
    },
    handler: async (req, reply) => {
      const project: Project = {
        id: crypto.randomUUID(),
        workspaceId: req.body.workspaceId,
        name: req.body.name,
        createdAt: new Date().toISOString(),
      };
      stub.set(project.id, project);
      reply.status(201);
      return project;
    },
  });

  app.get("/:id", {
    schema: {
      params: z.object({ id: z.string() }),
      response: { 200: ProjectSchema, 404: z.object({ error: z.string() }) },
    },
    handler: async (req, reply) => {
      const project = stub.get(req.params.id);
      if (!project) {
        reply.status(404);
        return { error: "Project not found" };
      }
      return project;
    },
  });

  app.delete("/:id", {
    schema: {
      params: z.object({ id: z.string() }),
      response: { 204: z.null(), 404: z.object({ error: z.string() }) },
    },
    handler: async (req, reply) => {
      if (!stub.delete(req.params.id)) {
        reply.status(404);
        return { error: "Project not found" };
      }
      reply.status(204);
      return null;
    },
  });
};
