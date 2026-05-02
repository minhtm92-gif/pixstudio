/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: false,
		environment: "node",
		include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
		exclude: ["node_modules", "dist"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
			include: ["src/**/*.ts"],
			exclude: ["src/**/*.test.ts", "src/server.ts"],
			thresholds: {
				statements: 50, // Sprint 1: 50% baseline. Sprint 3: bump to 70%.
				branches: 40,
				functions: 50,
				lines: 50,
			},
		},
		setupFiles: ["./tests/setup.ts"],
	},
});
