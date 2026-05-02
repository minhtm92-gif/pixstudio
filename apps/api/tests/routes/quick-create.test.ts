/**
 * Quick Create routes tests — session lifecycle + outline + auth boundaries.
 *
 * Sprint 2.5 baseline: tests against in-memory Prisma stub.
 * Sprint 3+: real Prisma test DB integration via Neon test branch.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import {
	serializerCompiler,
	validatorCompiler,
	type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { quickCreateRoutes } from "../../src/routes/quick-create.js";
import requireAuthPlugin from "../../src/plugins/require-auth.js";

interface SessionRow {
	id: string;
	userId: string;
	workspaceId: string;
	workflowId: string | null;
	prompt: string;
	mode: "PATH_A" | "PATH_B";
	configOverrides: object;
	outlineJson: object | null;
	chipSelectionsJson: object | null;
	buildJobId: string | null;
	buildStatus: string;
	buildProgress: number;
	totalCostUsd: number;
	createdAt: Date;
	updatedAt: Date;
	completedAt: Date | null;
}

function makeSession(overrides: Partial<SessionRow> = {}): SessionRow {
	const now = new Date();
	return {
		id: "00000000-0000-0000-0000-000000000001",
		userId: "u-test",
		workspaceId: "00000000-0000-0000-0000-aaaaaaaaaaaa",
		workflowId: null,
		prompt: "Test prompt",
		mode: "PATH_A",
		configOverrides: {},
		outlineJson: null,
		chipSelectionsJson: null,
		buildJobId: null,
		buildStatus: "PENDING",
		buildProgress: 0,
		totalCostUsd: 0,
		createdAt: now,
		updatedAt: now,
		completedAt: null,
		...overrides,
	};
}

function buildPrismaStub() {
	const sessions = new Map<string, SessionRow>();
	return {
		quickCreateSession: {
			create: async ({ data }: { data: Partial<SessionRow> }) => {
				const session = makeSession({
					...data,
					id: data.id ?? `s-${sessions.size + 1}`,
				});
				sessions.set(session.id, session);
				return session;
			},
			findUnique: async ({ where }: { where: { id: string } }) =>
				sessions.get(where.id) ?? null,
			update: async ({
				where,
				data,
			}: {
				where: { id: string };
				data: Partial<SessionRow> & { totalCostUsd?: { increment: number } };
			}) => {
				const existing = sessions.get(where.id);
				if (!existing) throw new Error("not found");
				const updated: SessionRow = {
					...existing,
					...(data.outlineJson !== undefined ? { outlineJson: data.outlineJson as object } : {}),
					...(data.chipSelectionsJson !== undefined
						? { chipSelectionsJson: data.chipSelectionsJson as object }
						: {}),
					...(data.workflowId !== undefined ? { workflowId: data.workflowId as string } : {}),
					...(data.configOverrides !== undefined
						? { configOverrides: data.configOverrides as object }
						: {}),
					...(data.buildStatus !== undefined ? { buildStatus: data.buildStatus as string } : {}),
					...(data.buildProgress !== undefined ? { buildProgress: data.buildProgress as number } : {}),
					...(data.buildJobId !== undefined ? { buildJobId: data.buildJobId as string } : {}),
				};
				if (data.totalCostUsd && "increment" in data.totalCostUsd) {
					updated.totalCostUsd = existing.totalCostUsd + data.totalCostUsd.increment;
				}
				sessions.set(where.id, updated);
				return updated;
			},
		},
	};
}

async function buildApp(authResult: "valid" | "none"): Promise<FastifyInstance> {
	const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);

	app.decorate("auth", {
		api: {
			getSession: async () =>
				authResult === "valid"
					? { user: { id: "u-test", email: "test@pxs.dev" }, session: { id: "s" } }
					: null,
		},
	} as unknown as Parameters<typeof app.decorate>[1]);

	app.decorate("prisma", buildPrismaStub() as unknown as Parameters<typeof app.decorate>[1]);

	await app.register(requireAuthPlugin);
	await app.register(quickCreateRoutes, { prefix: "/api/quick-create" });
	await app.ready();
	return app;
}

describe("Quick Create — session lifecycle", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildApp("valid");
	});

	afterAll(async () => {
		await app.close();
	});

	it("POST /sessions creates session with userId from req.user", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/api/quick-create/sessions",
			payload: {
				workspaceId: "00000000-0000-0000-0000-aaaaaaaaaaaa",
				prompt: "Quảng cáo serum SPF 50+",
				mode: "pathA",
			},
		});
		expect(res.statusCode).toBe(201);
		const body = res.json();
		expect(body).toMatchObject({
			id: expect.any(String),
			userId: "u-test",
			prompt: "Quảng cáo serum SPF 50+",
			mode: "PATH_A",
		});
	});

	it("GET /sessions/:id returns 404 for missing", async () => {
		const res = await app.inject({
			method: "GET",
			url: "/api/quick-create/sessions/00000000-0000-0000-0000-deadbeefdead",
		});
		expect(res.statusCode).toBe(404);
		expect(res.json()).toMatchObject({ error: "Session not found" });
	});

	it("PATCH /sessions/:id/config updates workflowId + overrides", async () => {
		const create = await app.inject({
			method: "POST",
			url: "/api/quick-create/sessions",
			payload: {
				workspaceId: "00000000-0000-0000-0000-aaaaaaaaaaaa",
				prompt: "Test",
				mode: "pathA",
			},
		});
		const sessionId = create.json().id;

		const res = await app.inject({
			method: "PATCH",
			url: `/api/quick-create/sessions/${sessionId}/config`,
			payload: {
				workflowId: "ad-product-vn",
				configOverrides: { pace: "medium" },
			},
		});
		expect(res.statusCode).toBe(200);
		expect(res.json()).toMatchObject({
			workflowId: "ad-product-vn",
			configOverrides: { pace: "medium" },
		});
	});

	it("POST /sessions/:id/outline returns 400 if no workflowId set", async () => {
		const create = await app.inject({
			method: "POST",
			url: "/api/quick-create/sessions",
			payload: {
				workspaceId: "00000000-0000-0000-0000-aaaaaaaaaaaa",
				prompt: "Test",
				mode: "pathA",
			},
		});
		const sessionId = create.json().id;

		const res = await app.inject({
			method: "POST",
			url: `/api/quick-create/sessions/${sessionId}/outline`,
		});
		expect(res.statusCode).toBe(400);
		expect(res.json()).toMatchObject({
			error: expect.stringContaining("no workflowId"),
		});
	});

	it("POST /sessions/:id/outline returns mock outline for valid workflow", async () => {
		const create = await app.inject({
			method: "POST",
			url: "/api/quick-create/sessions",
			payload: {
				workspaceId: "00000000-0000-0000-0000-aaaaaaaaaaaa",
				prompt: "Quảng cáo serum chống nắng",
				mode: "pathA",
			},
		});
		const sessionId = create.json().id;

		await app.inject({
			method: "PATCH",
			url: `/api/quick-create/sessions/${sessionId}/config`,
			payload: { workflowId: "ad-product-vn", configOverrides: {} },
		});

		const res = await app.inject({
			method: "POST",
			url: `/api/quick-create/sessions/${sessionId}/outline`,
		});
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body).toMatchObject({
			outline: {
				title: expect.any(String),
				scenes: expect.any(Array),
				suggestedChips: {
					audiences: expect.any(Array),
					lookFeel: expect.any(Array),
					platform: expect.any(String),
				},
			},
			meta: {
				mode: "mock",
			},
		});
		expect(body.outline.scenes.length).toBeGreaterThan(0);
	});

	it("PATCH /sessions/:id/chips persists selections", async () => {
		const create = await app.inject({
			method: "POST",
			url: "/api/quick-create/sessions",
			payload: {
				workspaceId: "00000000-0000-0000-0000-aaaaaaaaaaaa",
				prompt: "Test",
				mode: "pathA",
			},
		});
		const sessionId = create.json().id;

		const res = await app.inject({
			method: "PATCH",
			url: `/api/quick-create/sessions/${sessionId}/chips`,
			payload: {
				audiences: ["genz-tiktok", "office-worker"],
				lookFeel: ["ad-style"],
				platform: "tiktok",
			},
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().chipSelectionsJson).toMatchObject({
			audiences: ["genz-tiktok", "office-worker"],
			lookFeel: ["ad-style"],
			platform: "tiktok",
		});
	});

	it("GET /workflows returns tier-filtered list", async () => {
		const res = await app.inject({
			method: "GET",
			url: "/api/quick-create/workflows?tier=standard",
		});
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.items).toBeInstanceOf(Array);
		// Sprint 1: only ad-product-vn template registered (standard tier)
		expect(body.items.length).toBeGreaterThanOrEqual(1);
		expect(body.items.every((w: { requiredTier: string }) => w.requiredTier === "standard")).toBe(true);
	});

	it("GET /workflows?tier=max returns all tiers", async () => {
		const res = await app.inject({
			method: "GET",
			url: "/api/quick-create/workflows?tier=max",
		});
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.items.length).toBeGreaterThanOrEqual(1);
	});
});

describe("Quick Create — auth boundaries", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildApp("none");
	});

	afterAll(async () => {
		await app.close();
	});

	it("POST /sessions returns 401 when no session", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/api/quick-create/sessions",
			payload: {
				workspaceId: "00000000-0000-0000-0000-aaaaaaaaaaaa",
				prompt: "Test",
				mode: "pathA",
			},
		});
		expect(res.statusCode).toBe(401);
	});

	it("GET /workflows returns 401 when no session", async () => {
		const res = await app.inject({
			method: "GET",
			url: "/api/quick-create/workflows",
		});
		expect(res.statusCode).toBe(401);
	});
});
