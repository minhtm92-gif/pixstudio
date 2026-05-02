/**
 * Vitest setup — global test scaffolding.
 *
 * Sprint 1: noop. Sprint 2 add:
 * - Prisma test database (Neon test branch or in-memory)
 * - Provider mocks for ai-services
 * - Fastify app factory for integration tests
 */

import { afterAll, beforeAll } from "vitest";

// Set test env defaults
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "error"; // quiet during tests
process.env.DATABASE_URL =
	process.env.TEST_DATABASE_URL ?? "postgresql://test:test@localhost:5432/pxs_test?sslmode=disable";

beforeAll(() => {
	// Phase 1 Sprint 2: prisma.$connect() against test DB + truncate tables
});

afterAll(() => {
	// Phase 1 Sprint 2: prisma.$disconnect()
});
