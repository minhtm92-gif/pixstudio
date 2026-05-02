/**
 * Onboarding routes — Sprint 3 Story 3.4.
 *
 * Helps Editor team migrate from CapCut. Auto-creates:
 * - Default workspace `Personal` if user has none
 * - 1 sample project pre-loaded with example editor state (UC1 UGC review template)
 * - Welcome tour state tracked per user (skip-able)
 *
 * Endpoints:
 * - POST /api/onboarding/setup — idempotent, runs after first login
 * - GET  /api/onboarding/status — returns onboarding completion + tour step
 * - PATCH /api/onboarding/tour-step — update tour progress (skip / next / completed)
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireUser } from "../plugins/require-auth.js";

const TourStepSchema = z.enum([
	"welcome",
	"hero-view",
	"workflow-pick",
	"config-modal",
	"outline-chips",
	"build-progress",
	"editor-tabs",
	"completed",
	"skipped",
]);

// Sample project editor state — UC1 UGC review template scaffold (3 scenes, 30s).
const SAMPLE_EDITOR_STATE = {
	version: "1.0",
	timeline: {
		duration: 30,
		ratio: "9:16",
		scenes: [
			{
				id: "scene-1",
				order: 1,
				durationSec: 8,
				script:
					"Em vừa thử serum vitamin C của hãng X, em tả lại trải nghiệm da em sau 7 ngày",
				mediaQuery: "young woman skincare close-up",
				transitions: { in: "fade", out: "cut" },
			},
			{
				id: "scene-2",
				order: 2,
				durationSec: 14,
				script: "Da em đẹp lên hẳn, các vết thâm mờ dần. Em show trước/sau cho mọi người xem",
				mediaQuery: "before after skin transformation",
				transitions: { in: "cut", out: "cut" },
			},
			{
				id: "scene-3",
				order: 3,
				durationSec: 8,
				script: "Recommend 4.5 sao. Link mua trong bio của em",
				mediaQuery: "product bottle hand holding",
				transitions: { in: "cut", out: "fade" },
			},
		],
		audio: {
			voicePresetId: null, // resolved at runtime
			musicTrackId: null, // user picks
		},
	},
	settings: {
		watermarkOn: true,
		subtitleStyle: "Bebas Neue",
	},
};

export const onboardingRoutes: FastifyPluginAsyncZod = async (app) => {
	// === POST /api/onboarding/setup ===
	app.post("/setup", {
		schema: {
			body: z.object({}).optional(),
		},
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;

			// Check existing workspaces
			const existingMembership = await app.prisma.workspaceMember.findFirst({
				where: { userId: user.id },
				include: { workspace: true },
			});

			let workspaceId: string;
			let workspaceCreated = false;

			if (existingMembership) {
				workspaceId = existingMembership.workspaceId;
			} else {
				// Create default Personal workspace
				const ws = await app.prisma.workspace.create({
					data: {
						name: `${user.email.split("@")[0]}'s workspace`,
						slug: `personal-${user.id.slice(0, 8)}`,
						ownerId: user.id,
						region: "VN_SG",
						billingTier: "STANDARD",
					},
				});
				await app.prisma.workspaceMember.create({
					data: {
						workspaceId: ws.id,
						userId: user.id,
						role: "OWNER",
					},
				});
				workspaceId = ws.id;
				workspaceCreated = true;
			}

			// Check existing sample project
			const existingSample = await app.prisma.project.findFirst({
				where: {
					workspaceId,
					name: "Welcome — Sample UGC Review",
				},
			});

			let sampleProjectId: string;
			let sampleCreated = false;

			if (existingSample) {
				sampleProjectId = existingSample.id;
			} else {
				const sample = await app.prisma.project.create({
					data: {
						workspaceId,
						name: "Welcome — Sample UGC Review",
						description:
							"Đây là project mẫu cho UC1 UGC review. Anh/chị xem để hiểu flow, có thể edit hoặc xóa khi sẵn sàng.",
						editorStateJson: SAMPLE_EDITOR_STATE as never,
						editorStateVersion: 1,
					},
				});
				sampleProjectId = sample.id;
				sampleCreated = true;
			}

			return {
				workspaceId,
				workspaceCreated,
				sampleProjectId,
				sampleCreated,
				nextStep: "welcome",
			};
		},
	});

	// === GET /api/onboarding/status ===
	app.get("/status", {
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;

			const memberships = await app.prisma.workspaceMember.findMany({
				where: { userId: user.id },
				include: { workspace: true },
			});

			const projectCount = await app.prisma.project.count({
				where: {
					workspace: {
						members: { some: { userId: user.id } },
					},
				},
			});

			// Count Quick Create sessions completed (build done)
			const completedBuilds = await app.prisma.quickCreateSession.count({
				where: {
					userId: user.id,
					buildStatus: "COMPLETED" as never,
				},
			});

			return {
				userId: user.id,
				email: user.email,
				workspaceCount: memberships.length,
				projectCount,
				completedBuilds,
				onboardingComplete: completedBuilds >= 1, // first successful build = onboarding done
				nextStep: completedBuilds >= 1 ? "completed" : "build-first-video",
			};
		},
	});

	// === PATCH /api/onboarding/tour-step ===
	// Lightweight client-side state — not persisted server-side v1 (use localStorage).
	// This endpoint exists for future server-side analytics; v1 just echoes back.
	app.patch("/tour-step", {
		schema: {
			body: z.object({
				step: TourStepSchema,
			}),
		},
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;

			req.log.info(
				{ userId: user.id, step: req.body.step },
				"onboarding tour step",
			);

			return {
				step: req.body.step,
				userId: user.id,
				timestamp: new Date().toISOString(),
			};
		},
	});
};
