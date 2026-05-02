/**
 * Health route integration tests.
 *
 * Sprint 1 baseline: smoke test endpoint shape + status.
 * Sprint 2 add: dependency probes (Prisma + R2 + AI mesh) tests.
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { healthRoutes } from "../../src/routes/health.js";

describe("GET /health", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = Fastify({ logger: false });
		await app.register(healthRoutes, { prefix: "/health" });
		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it("returns 200 with service metadata", async () => {
		const res = await app.inject({ method: "GET", url: "/health" });
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body).toMatchObject({
			status: "ok",
			service: "pixstudio-api",
			version: expect.any(String),
			uptime: expect.any(Number),
			timestamp: expect.any(String),
		});
		// timestamp is valid ISO 8601
		expect(() => new Date(body.timestamp)).not.toThrow();
	});

	it("uptime increases between calls", async () => {
		const r1 = await app.inject({ method: "GET", url: "/health" });
		await new Promise((r) => setTimeout(r, 50));
		const r2 = await app.inject({ method: "GET", url: "/health" });
		expect(r2.json().uptime).toBeGreaterThanOrEqual(r1.json().uptime);
	});
});

describe("GET /health/ready", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = Fastify({ logger: false });
		await app.register(healthRoutes, { prefix: "/health" });
		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it("returns checks object", async () => {
		const res = await app.inject({ method: "GET", url: "/health/ready" });
		expect(res.statusCode).toBeGreaterThanOrEqual(200);
		expect(res.statusCode).toBeLessThan(600);
		const body = res.json();
		expect(body).toHaveProperty("ready");
		expect(body).toHaveProperty("checks");
		expect(typeof body.ready).toBe("boolean");
		expect(typeof body.checks).toBe("object");
	});
});
