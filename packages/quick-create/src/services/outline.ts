/**
 * Outline generation service — Phase 1 Sprint 2 wire-up.
 *
 * Calls AI mesh `llm.chat` with structured prompt → parses JSON → returns Outline.
 */

import { workflowRegistry } from "../registry.js";
import { isCrossianRagEligible } from "../types.js";
import type { Language, QuickCreateSession, WorkflowTemplate } from "../types.js";

/**
 * Crossian RAG context fetcher — Sprint 6 ingest will populate pgvector with
 * sanitized EN dropshipping/FB-ad patterns from
 * `D:\Workspace\Crossian Research\Knowhow_for_AI_Agent\` (Q67 + Q68 sanitize rules).
 *
 * v1: stub returns empty. Sprint 6 wires real pgvector similarity search.
 */
export interface CrossianRagContext {
	hookPatterns: string[]; // top-3 emotional/identity/gift/problem hooks
	sceneStructure: string; // 5-act Crossian structure summary
	textOverlayExamples: string[]; // top-3 text overlay patterns
}

export async function fetchCrossianRagContext(
	_workflow: WorkflowTemplate,
	_userPrompt: string,
): Promise<CrossianRagContext | null> {
	// TODO Sprint 6: query pgvector with prompt embedding, filter by sanitize rules
	// For now return null → outline service falls back to generic LLM context
	return null;
}

export interface OutlineInput {
	prompt: string;
	workflow: WorkflowTemplate;
	configOverrides: QuickCreateSession["configOverrides"];
}

export interface OutlineOutput {
	title: string;
	scenes: Array<{
		id: string;
		order: number;
		script: string;
		mediaQuery: string;
		durationSec: number;
	}>;
	suggestedChips: {
		audiences: string[];
		lookFeel: string[];
		platform: string;
	};
}

export class OutlineService {
	/** Phase 1 Sprint 2 implementation. Currently stubbed. */
	async generate(input: OutlineInput): Promise<OutlineOutput> {
		const workflow = workflowRegistry.get(input.workflow.id);
		if (!workflow) {
			throw new Error(`Unknown workflow ${input.workflow.id}`);
		}

		// TODO Sprint 2: call llm.chat with structured prompt
		// const llmResponse = await aiMesh.invoke({
		//   capability: "llm.chat",
		//   prompt: this.buildPrompt(input, workflow),
		//   responseFormat: "json",
		//   maxTokens: 2000,
		// });
		// return this.parseLlmResponse(llmResponse.text, workflow);

		throw new Error("OutlineService.generate not yet implemented (Phase 1 Sprint 2)");
	}

	/** Constructs the structured prompt for LLM, injecting Crossian RAG context when eligible. */
	async buildPromptAsync(input: OutlineInput, workflow: WorkflowTemplate): Promise<string> {
		const language: Language = (input.configOverrides.language as Language) ||
			workflow.defaultLanguage;
		const sceneCount = this.estimateSceneCount(
			(input.configOverrides.pace as "slow" | "medium" | "fast") || workflow.pace,
			workflow.platform.defaultDurationSec,
		);

		// Crossian RAG context — only EN dropshipping/facebook-ad workflows fire (Q72).
		let crossianContext = "";
		if (isCrossianRagEligible(workflow, language)) {
			const rag = await fetchCrossianRagContext(workflow, input.prompt);
			if (rag) {
				crossianContext = `\n\n[CROSSIAN PATTERNS — apply when crafting hook + script]\n` +
					`Hook variants: ${rag.hookPatterns.join(" | ")}\n` +
					`Scene structure: ${rag.sceneStructure}\n` +
					`Text overlay examples: ${rag.textOverlayExamples.join(" | ")}\n`;
			}
		}

		return `
You are a video script outline generator for PixStudio.

User prompt: ${input.prompt}

Workflow: ${workflow.name} (${workflow.description})
Default language: ${language}
Pace: ${input.configOverrides.pace || workflow.pace}
Total duration: ${workflow.platform.defaultDurationSec}s
Platform: ${workflow.platform.ratio} ratio
Style hint: ${input.configOverrides.style || "default workflow style"}
${crossianContext}
Generate ${sceneCount} scenes. Each scene must have:
- script (1-3 sentences in target language, voiceable in ${this.estimateSceneDuration(workflow.platform.defaultDurationSec, sceneCount)}s)
- mediaQuery (English keywords for stock search, e.g. "businessman office laptop")
- durationSec (sum to total duration ±5%)

Also suggest:
- 1-3 audience chips (from registry e.g. ecom-buyer, senior-50plus, gen-z-tiktok, mom-baby, pain-back, etc)
- 1-2 look-feel chips (from registry e.g. ugc-authentic, ad-style, cinematic, comedy, etc)
- 1 platform chip (default ${workflow.platform.ratio === "9:16" ? "tiktok" : workflow.platform.ratio === "4:5" ? "fb-ad-vertical" : "youtube-long"})

Return strict JSON matching this schema:
{
  "title": string,
  "scenes": Array<{ "id": string, "order": number, "script": string, "mediaQuery": string, "durationSec": number }>,
  "suggestedChips": { "audiences": string[], "lookFeel": string[], "platform": string }
}
`.trim();
	}

	private estimateSceneCount(pace: "slow" | "medium" | "fast", durationSec: number): number {
		const sceneSecPerPace = { slow: 8, medium: 5, fast: 3 };
		return Math.max(3, Math.min(20, Math.round(durationSec / sceneSecPerPace[pace])));
	}

	private estimateSceneDuration(totalSec: number, sceneCount: number): number {
		return Math.round(totalSec / sceneCount);
	}
}
