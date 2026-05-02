/**
 * Auth middleware unit tests — public route bypass + req.user population.
 *
 * Sprint 1: tests preHandler logic without real better-auth (mocked).
 * Sprint 2: integration with real session cookie + Prisma test DB.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import requireAuthPlugin, { requireUser } from "../../src/plugins/require-auth.js";

describe("require-auth middleware", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = Fastify({ logger: false });
		// Mock auth plugin with stub session lookup
		app.decorate("auth", {
			api: {
				getSession: async (_opts: unknown) => ({
					user: { id: "u-test", email: "test@pxs.dev" },
					session: { id: "s-test", userId: "u-test" },
				}),
			},
		} as unknown as Parameters<typeof app.decorate>[1]);

		await app.register(requireAuthPlugin);

		app.get("/api/echo", {
			handler: async (req, reply) => {
				const user = requireUser(req, reply);
				if (!user) return;
				return { user };
			},
		});

		app.get("/health", {
			handler: async () => ({ ok: true }),
		});

		app.get("/api/auth/sign-in/email", {
			handler: async () => ({ ok: true }),
		});

		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it("bypasses public /health route — no req.user populated", async () => {
		const res = await app.inject({ method: "GET", url: "/health" });
		expect(res.statusCode).toBe(200);
	});

	it("bypasses public /api/auth/* route", async () => {
		const res = await app.inject({ method: "GET", url: "/api/auth/sign-in/email" });
		expect(res.statusCode).toBe(200);
	});

	it("populates req.user for authenticated /api/* route", async () => {
		const res = await app.inject({ method: "GET", url: "/api/echo" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toMatchObject({
			user: { id: "u-test", email: "test@pxs.dev" },
		});
	});
});

describe("requireUser helper", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = Fastify({ logger: false });
		// auth that returns NO session
		app.decorate("auth", {
			api: {
				getSession: async () => null,
			},
		} as unknown as Parameters<typeof app.decorate>[1]);

		await app.register(requireAuthPlugin);

		app.get("/api/protected", {
			handler: async (req, reply) => {
				const user = requireUser(req, reply);
				if (!user) return;
				return { user };
			},
		});

		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it("returns 401 when no user", async () => {
		const res = await app.inject({ method: "GET", url: "/api/protected" });
		expect(res.statusCode).toBe(401);
		expect(res.json()).toMatchObject({ error: "Unauthorized" });
	});
});
