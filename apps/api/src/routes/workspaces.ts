import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireUser } from "../plugins/require-auth.js";

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
  // List workspaces: scoped to current user's memberships only (audit C1).
  app.get("/", {
    schema: {
      response: { 200: z.object({ items: z.array(WorkspaceSchema) }) },
    },
    handler: async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const items = await app.prisma.workspace.findMany({
        where: { members: { some: { userId: user.id } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return { items: items.map(serializeWorkspace) };
    },
  });

  // Create workspace: req.user.id authoritative — body.ownerId removed (audit C1).
  app.post("/", {
    schema: {
      body: z.object({
        name: z.string().min(1).max(120),
        slug: z.string().min(2).max(60).optional(),
        region: RegionSchema.optional(),
        billingTier: TierSchema.optional(),
      }),
      response: { 201: WorkspaceSchema, 409: z.object({ error: z.string() }) },
    },
    handler: async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const slug = req.body.slug ?? slugify(req.body.name);
      try {
        const ws = await app.prisma.workspace.create({
          data: {
            name: req.body.name,
            slug,
            ownerId: user.id,
            region: req.body.region,
            billingTier: req.body.billingTier,
            members: {
              create: { userId: user.id, role: "OWNER" },
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

  // Helper: ensure caller is member of workspace (any role).
  async function requireMember(workspaceId: string, userId: string) {
    return app.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
  }

  // Get workspace by id — must be member (audit C1).
  app.get("/:id", {
    schema: {
      params: z.object({ id: z.string() }),
      response: {
        200: WorkspaceSchema,
        403: z.object({ error: z.string() }),
        404: z.object({ error: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const member = await requireMember(req.params.id, user.id);
      if (!member) {
        reply.status(403);
        return { error: "Not a member of this workspace" };
      }
      const ws = await app.prisma.workspace.findUnique({ where: { id: req.params.id } });
      if (!ws) {
        reply.status(404);
        return { error: "Workspace not found" };
      }
      return serializeWorkspace(ws);
    },
  });

  // List members — must be member (audit C1).
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
        403: z.object({ error: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const member = await requireMember(req.params.id, user.id);
      if (!member) {
        reply.status(403);
        return { error: "Not a member of this workspace" };
      }
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

  // Add member — only OWNER can add (audit C3 RBAC).
  app.post("/:id/members", {
    schema: {
      params: z.object({ id: z.string() }),
      body: z.object({ userId: z.string(), role: RoleSchema.optional() }),
      response: {
        201: z.object({ id: z.string(), userId: z.string(), role: RoleSchema, joinedAt: z.string() }),
        403: z.object({ error: z.string() }),
        409: z.object({ error: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const callerMember = await requireMember(req.params.id, user.id);
      if (!callerMember || callerMember.role !== "OWNER") {
        reply.status(403);
        return { error: "Only OWNER can add members" };
      }
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
