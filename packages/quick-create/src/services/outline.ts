/**
 * Outline generation service — Phase 1 Sprint 2 wire-up.
 *
 * Calls AI mesh `llm.chat` with structured prompt → parses JSON → returns Outline.
 */

import { workflowRegistry } from "../registry.js";
import type { QuickCreateSession, WorkflowTemplate } from "../types.js";

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

	/** Constructs the structured prompt for LLM. */
	private buildPrompt(input: OutlineInput, workflow: WorkflowTemplate): string {
		// Phase 1 Sprint 2: design prompt with examples per workflow.id
		// Reference: docs/quick-create/workflow-templates-form.md samplePrompts
		const sceneCount = this.estimateSceneCount(
			input.configOverrides.pace || workflow.pace,
			workflow.platform.defaultDurationSec
		);

		return `
You are a video script outline generator for PixStudio, a Vietnamese video platform.

User prompt: ${input.prompt}

Workflow: ${workflow.name} (${workflow.description})
Default language: ${input.configOverrides.language || workflow.defaultLanguage}
Pace: ${input.configOverrides.pace || workflow.pace}
Total duration: ${workflow.platform.defaultDurationSec}s
Platform: ${workflow.platform.ratio} ratio
Style hint: ${input.configOverrides.style || "default workflow style"}

Generate ${sceneCount} scenes. Each scene must have:
- script (1-3 sentences in target language, voiceable in ${this.estimateSceneDuration(workflow.platform.defaultDurationSec, sceneCount)}s)
- mediaQuery (English keywords for stock search, e.g. "businessman office laptop")
- durationSec (sum to total duration ±5%)

Also suggest:
- 1-3 audience chips (from set: senior-50plus-vn, genz-tiktok, young-parents, ...)
- 1-2 look-feel chips (from set: cinematic, vlog, ad-style, ...)
- 1 platform chip (default ${workflow.platform.ratio === "9:16" ? "tiktok" : "youtube-long"})

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
