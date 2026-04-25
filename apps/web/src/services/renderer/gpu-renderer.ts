import {
	applyEffectPasses,
	applyMaskFeather as applyMaskFeatherWasm,
	GpuInitKind,
	initializeGpu,
} from "opencut-wasm";
import type { EffectPass, EffectUniformValue } from "@/effects/types";

export type GpuRendererInitializationResult =
	| { kind: "ready" }
	| { kind: "software-fallback-adapter" }
	| { kind: "webgl-fallback" }
	| { kind: "unavailable"; message: string };

type GpuInitDiscriminator = Exclude<
	GpuRendererInitializationResult,
	{ kind: "unavailable" }
>["kind"];

let gpuAvailable = false;
let initPromise: Promise<GpuRendererInitializationResult> | null = null;

export function initializeGpuRenderer(): Promise<GpuRendererInitializationResult> {
	if (!initPromise) {
		initPromise = initializeGpu()
			.then((kind): GpuRendererInitializationResult => {
				gpuAvailable = true;
				return { kind: gpuInitKindToDiscriminator(kind) };
			})
			.catch((error: unknown): GpuRendererInitializationResult => {
				gpuAvailable = false;
				const message = error instanceof Error ? error.message : String(error);
				console.warn(`GPU renderer unavailable: ${message}`);
				return { kind: "unavailable", message };
			});
	}
	return initPromise;
}

function gpuInitKindToDiscriminator(kind: GpuInitKind): GpuInitDiscriminator {
	switch (kind) {
		case GpuInitKind.Ready:
			return "ready";
		case GpuInitKind.SoftwareFallbackAdapter:
			return "software-fallback-adapter";
		case GpuInitKind.WebglFallback:
			return "webgl-fallback";
	}
	const unhandled: never = kind;
	throw new Error(`Unhandled GpuInitKind: ${unhandled}`);
}

export const gpuRenderer = {
	applyEffect({
		source,
		width,
		height,
		passes,
	}: {
		source: CanvasImageSource;
		width: number;
		height: number;
		passes: EffectPass[];
	}): CanvasImageSource {
		if (passes.length === 0 || !gpuAvailable) {
			return source;
		}

		const sourceCanvas = ensureOffscreenCanvas({
			source,
			width,
			height,
			label: "effect source",
		});
		return applyEffectPasses({
			source: sourceCanvas,
			width,
			height,
			passes: serializeEffectPasses(passes),
		});
	},

	applyMaskFeather({
		maskCanvas,
		width,
		height,
		feather,
	}: {
		maskCanvas: CanvasImageSource;
		width: number;
		height: number;
		feather: number;
	}): CanvasImageSource {
		if (!gpuAvailable) {
			return maskCanvas;
		}

		const sourceCanvas = ensureOffscreenCanvas({
			source: maskCanvas,
			width,
			height,
			label: "mask source",
		});
		return applyMaskFeatherWasm({
			mask: sourceCanvas,
			width,
			height,
			feather,
		});
	},
};

function ensureOffscreenCanvas({
	source,
	width,
	height,
	label,
}: {
	source: CanvasImageSource;
	width: number;
	height: number;
	label: string;
}): OffscreenCanvas {
	if (source instanceof OffscreenCanvas) {
		return source;
	}

	if (typeof OffscreenCanvas === "undefined") {
		throw new Error(`OffscreenCanvas is required for the GPU ${label}`);
	}

	const canvas = new OffscreenCanvas(width, height);
	const context = canvas.getContext("2d");
	if (!context) {
		throw new Error(`Failed to get 2d context for the GPU ${label}`);
	}
	context.clearRect(0, 0, width, height);
	context.drawImage(source, 0, 0, width, height);
	return canvas;
}

function serializeEffectPasses(passes: EffectPass[]) {
	return passes.map((pass) => ({
		shader: pass.shader,
		uniforms: Object.entries(pass.uniforms).map(([name, value]) => ({
			name,
			value: normalizeUniformValue(value),
		})),
	}));
}

function normalizeUniformValue(value: EffectUniformValue): number[] {
	return typeof value === "number" ? [value] : value;
}
