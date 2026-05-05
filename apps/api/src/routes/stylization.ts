/**
 * Stylization + Voice effects routes — Sprint S30.
 *
 * PW-27 Stylization presets: ComfyUI AnimateDiff pool (Pro tier).
 * PW-26 Voice effects: ElevenLabs voice conversion (Pro tier).
 *
 *   GET  /api/stylization/presets          — list 8 presets
 *   POST /api/stylization/projects/:id     — apply preset to video segment
 *   GET  /api/voice-effects/presets        — list voice effect presets
 *   POST /api/voice-effects/projects/:id   — apply voice effect to audio
 *
 * Stylization requires GPU droplet (PW-27) — currently 501 until Phase 0
 * GPU snapshot ready. Voice effects can run via ElevenLabs API (Pro tier
 * voice conversion).
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireUser, requireWorkspaceMember } from "../plugins/require-auth.js";
import { STYLIZATION_PRESETS, findStylizationPreset } from "../data/stylization-presets.js";

interface VoiceEffectPreset {
	id: string;
	labelVi: string;
	labelEn: string;
	/** ElevenLabs voice conversion target voiceId. */
	targetVoiceId: string | null;
	/** DSP filter chain (FFmpeg). */
	dspFilterChain: string | null;
	requiredTier: "pro" | "max";
}

const VOICE_EFFECT_PRESETS: VoiceEffectPreset[] = [
	{
		id: "deep-narrator",
		labelVi: "Giọng narrator ấm",
		labelEn: "Deep narrator",
		targetVoiceId: null,
		dspFilterChain: "asetrate=44100*0.85,aresample=44100,atempo=1.18",
		requiredTier: "pro",
	},
	{
		id: "child-helium",
		labelVi: "Giọng trẻ em (helium)",
		labelEn: "Child helium",
		targetVoiceId: null,
		dspFilterChain: "asetrate=44100*1.30,aresample=44100,atempo=0.77",
		requiredTier: "pro",
	},
	{
		id: "robot-electronic",
		labelVi: "Robot điện tử",
		labelEn: "Robot electronic",
		targetVoiceId: null,
		dspFilterChain: "tremolo=f=10:d=0.7,vibrato=f=4:d=0.5,aphaser=type=t",
		requiredTier: "pro",
	},
	{
		id: "phone-low-fi",
		labelVi: "Điện thoại lo-fi",
		labelEn: "Phone lo-fi",
		targetVoiceId: null,
		dspFilterChain: "highpass=300,lowpass=3400,acrusher=level_in=8:level_out=18:bits=8:mode=log:aa=1",
		requiredTier: "pro",
	},
	{
		id: "echo-cave",
		labelVi: "Vọng hang động",
		labelEn: "Cave echo",
		targetVoiceId: null,
		dspFilterChain: "aecho=0.8:0.9:1000:0.3",
		requiredTier: "pro",
	},
	{
		id: "whisper-asmr",
		labelVi: "Thì thầm ASMR",
		labelEn: "ASMR whisper",
		targetVoiceId: null,
		dspFilterChain: "highpass=200,volume=0.6,acompressor=threshold=0.05:ratio=4:attack=200:release=1000",
		requiredTier: "pro",
	},
	{
		id: "elevenlabs-conversion",
		labelVi: "ElevenLabs Voice Conversion",
		labelEn: "ElevenLabs voice conversion",
		targetVoiceId: "21m00Tcm4TlvDq8ikWAM",
		dspFilterChain: null,
		requiredTier: "max",
	},
];

export const stylizationRoutes: FastifyPluginAsyncZod = async (app) => {
	app.get("/stylization/presets", {
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			return { items: STYLIZATION_PRESETS };
		},
	});

	app.post("/stylization/projects/:id", {
		schema: {
			params: z.object({ id: z.string().uuid() }),
			body: z.object({
				presetId: z.string(),
				segmentId: z.string().optional(),
				videoR2Key: z.string(),
			}),
		},
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const project = await app.prisma.project.findUnique({
				where: { id: req.params.id },
				select: { workspaceId: true },
			});
			if (!project) {
				reply.code(404);
				return { error: "Project not found" };
			}
			const member = await requireWorkspaceMember(app, project.workspaceId, user.id, "EDITOR");
			if (!member) {
				reply.code(403);
				return { error: "Need EDITOR or OWNER role" };
			}
			const preset = findStylizationPreset(req.body.presetId);
			if (!preset) {
				reply.code(404);
				return { error: "Stylization preset not found" };
			}
			reply.code(501);
			return {
				error: "Stylization not implemented",
				message: `Preset "${preset.labelEn}" requires ComfyUI on DO L40S GPU droplet (per SCOPE PW-27 + ADR-003). gpu-spawn.ts orchestration ready but Phase 0 GPU snapshot pending. Returning 501 until anh provisions GPU.`,
				preset,
			};
		},
	});

	app.get("/voice-effects/presets", {
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			return { items: VOICE_EFFECT_PRESETS };
		},
	});

	app.post("/voice-effects/projects/:id", {
		schema: {
			params: z.object({ id: z.string().uuid() }),
			body: z.object({
				presetId: z.string(),
				segmentId: z.string().optional(),
				audioR2Key: z.string(),
			}),
		},
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const project = await app.prisma.project.findUnique({
				where: { id: req.params.id },
				select: { workspaceId: true },
			});
			if (!project) {
				reply.code(404);
				return { error: "Project not found" };
			}
			const member = await requireWorkspaceMember(app, project.workspaceId, user.id, "EDITOR");
			if (!member) {
				reply.code(403);
				return { error: "Need EDITOR or OWNER role" };
			}
			const preset = VOICE_EFFECT_PRESETS.find((p) => p.id === req.body.presetId);
			if (!preset) {
				reply.code(404);
				return { error: "Voice effect preset not found" };
			}
			reply.code(501);
			return {
				error: "Voice effect not implemented",
				message: `Preset "${preset.labelEn}" — DSP filter chain ready (${preset.dspFilterChain ?? "voice conversion"}) but FFmpeg-on-R2 worker not wired. S31+ when stylization GPU pipeline lands.`,
				preset,
			};
		},
	});
};
