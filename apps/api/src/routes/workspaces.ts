import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

const RegionSchema = z.enum(["VN_SG", "EU", "US"]);
const TierSchema = z.enum(["STANDARD", "PRO", "MAX"]);
const RoleSchema = z.enum(["OWNER", "EDITOR", "VIEWER"]);

const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  ownerId: z.string(),
  region: RegionSchema,
  billingTier: TierSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

const serializeWorkspace = (w: {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  region: "VN_SG" | "EU" | "US";
  billingTier: "STANDARD" | "PRO" | "MAX";
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: w.id,
  name: w.name,
  slug: w.slug,
  ownerId: w.ownerId,
  region: w.region,
  billingTier: w.billingTier,
  createdAt: w.createdAt.toISOString(),
  updatedAt: w.updatedAt.toISOString(),
});

const slugify = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

export const workspacesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    schema: {
      querystring: z.object({ ownerId: z.string().optional() }),
      response: { 200: z.object({ items: z.array(WorkspaceSchema) }) },
    },
    handler: async (req) => {
      const items = await app.prisma.workspace.findMany({
        where: req.query.ownerId ? { ownerId: req.query.ownerId } : undefined,
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return { items: items.map(serializeWorkspace) };
    },
  });

  app.post("/", {
    schema: {
      body: z.object({
        name: z.string().min(1).max(120),
        ownerId: z.string(),
        slug: z.string().min(2).max(60).optional(),
        region: RegionSchema.optional(),
        billingTier: TierSchema.optional(),
      }),
      response: { 201: WorkspaceSchema, 409: z.object({ error: z.string() }) },
    },
    handler: async (req, reply) => {
      const slug = req.body.slug ?? slugify(req.body.name);
      try {
        const ws = await app.prisma.workspace.create({
          data: {
            name: req.body.name,
            slug,
            ownerId: req.body.ownerId,
            region: req.body.region,
            billingTier: req.body.billingTier,
            members: {
              create: { userId: req.body.ownerId, role: "OWNER" },
            },
          },
        });
        reply.status(201);
        return serializeWorkspace(ws);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("Unique") || msg.includes("unique")) {
          reply.status(409);
          return { error: `Workspace slug "${slug}" already exists` };
        }
        throw err;
      }
    },
  });

  app.get("/:id", {
    schema: {
      params: z.object({ id: z.string() }),
      response: { 200: WorkspaceSchema, 404: z.object({ error: z.string() }) },
    },
    handler: async (req, reply) => {
      const ws = await app.prisma.workspace.findUnique({ where: { id: req.params.id } });
      if (!ws) {
        reply.status(404);
        return { error: "Workspace not found" };
      }
      return serializeWorkspace(ws);
    },
  });

  app.get("/:id/members", {
    schema: {
      params: z.object({ id: z.string() }),
      response: {
        200: z.object({
          items: z.array(
            z.object({
              id: z.string(),
              userId: z.string(),
              role: RoleSchema,
              joinedAt: z.string(),
            }),
          ),
        }),
      },
    },
    handler: async (req) => {
      const items = await app.prisma.workspaceMember.findMany({
        where: { workspaceId: req.params.id },
        orderBy: { joinedAt: "asc" },
      });
      return {
        items: items.map((m) => ({
          id: m.id,
          userId: m.userId,
          role: m.role as "OWNER" | "EDITOR" | "VIEWER",
          joinedAt: m.joinedAt.toISOString(),
        })),
      };
    },
  });

  app.post("/:id/members", {
    schema: {
      params: z.object({ id: z.string() }),
      body: z.object({ userId: z.string(), role: RoleSchema.optional() }),
      response: {
        201: z.object({ id: z.string(), userId: z.string(), role: RoleSchema, joinedAt: z.string() }),
        409: z.object({ error: z.string() }),
      },
    },
    handler: async (req, reply) => {
      try {
        const m = await app.prisma.workspaceMember.create({
          data: {
            workspaceId: req.params.id,
            userId: req.body.userId,
            role: req.body.role ?? "EDITOR",
          },
        });
        reply.status(201);
        return {
          id: m.id,
          userId: m.userId,
          role: m.role as "OWNER" | "EDITOR" | "VIEWER",
          joinedAt: m.joinedAt.toISOString(),
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("Unique") || msg.includes("unique")) {
          reply.status(409);
          return { error: "User already member of this workspace" };
        }
        throw err;
      }
    },
  });
};
