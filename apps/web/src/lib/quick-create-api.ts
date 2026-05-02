/**
 * Quick Create API client — wraps fetch + bearer token + error handling.
 *
 * Sprint 2: simple fetch wrapper. Sprint 3: SWR/React Query for cache + refetch.
 */

const API_BASE =
	process.env.NEXT_PUBLIC_API_URL ?? "https://api.studio.pixelxlab.com";

class ApiError extends Error {
	constructor(public status: number, message: string, public body?: unknown) {
		super(message);
		this.name = "ApiError";
	}
}

async function apiFetch<T>(
	path: string,
	options: RequestInit = {},
	token?: string,
): Promise<T> {
	const headers = new Headers(options.headers);
	headers.set("Content-Type", "application/json");
	if (token) headers.set("Authorization", `Bearer ${token}`);

	const resp = await fetch(`${API_BASE}${path}`, {
		...options,
		headers,
		credentials: "include",
	});

	let body: unknown;
	const text = await resp.text();
	try {
		body = text ? JSON.parse(text) : null;
	} catch {
		body = text;
	}

	if (!resp.ok) {
		throw new ApiError(
			resp.status,
			(body as { error?: string; message?: string })?.message ??
				(body as { error?: string })?.error ??
				`${resp.status} ${resp.statusText}`,
			body,
		);
	}
	return body as T;
}

// ─── Types (mirror apps/api/src/routes/quick-create.ts schemas) ────

export interface QuickCreateSession {
	id: string;
	userId: string;
	workspaceId: string;
	workflowId: string | null;
	prompt: string;
	mode: "PATH_A" | "PATH_B";
	configOverrides: Record<string, unknown>;
	outlineJson: Outline | null;
	chipSelectionsJson: ChipSelections | null;
	buildStatus: string;
	buildProgress: number;
	createdAt: string;
	updatedAt: string;
}

export interface Outline {
	title: string;
	scenes: Scene[];
	suggestedChips: ChipSelections;
}

export interface Scene {
	id: string;
	order: number;
	script: string;
	mediaQuery: string;
	durationSec: number;
}

export interface ChipSelections {
	audiences: string[];
	lookFeel: string[];
	platform: string;
}

export interface WorkflowSummary {
	id: string;
	name: string;
	nameEn: string;
	description: string;
	thumbnail: string;
	pace: "slow" | "medium" | "fast";
	defaultLanguage: "vi" | "en";
	ratio: string;
	defaultDurationSec: number;
	requiredTier: "standard" | "pro" | "max";
}

// ─── API methods ─────────────────────────────────────────────────────

export const quickCreateApi = {
	async createSession(
		token: string,
		body: { workspaceId: string; prompt: string; mode: "pathA" | "pathB" },
	) {
		return apiFetch<QuickCreateSession>(
			"/api/quick-create/sessions",
			{ method: "POST", body: JSON.stringify(body) },
			token,
		);
	},

	async getSession(token: string, sessionId: string) {
		return apiFetch<QuickCreateSession>(
			`/api/quick-create/sessions/${sessionId}`,
			{},
			token,
		);
	},

	async updateConfig(
		token: string,
		sessionId: string,
		body: { workflowId: string; configOverrides: Record<string, unknown> },
	) {
		return apiFetch<QuickCreateSession>(
			`/api/quick-create/sessions/${sessionId}/config`,
			{ method: "PATCH", body: JSON.stringify(body) },
			token,
		);
	},

	async generateOutline(
		token: string,
		sessionId: string,
		live = false,
	) {
		return apiFetch<{
			outline: Outline;
			session: QuickCreateSession;
			meta: { mode: "live" | "mock"; costUsd: number; durationMs: number };
		}>(
			`/api/quick-create/sessions/${sessionId}/outline${live ? "?live=1" : ""}`,
			{ method: "POST" },
			token,
		);
	},

	async updateChips(token: string, sessionId: string, body: ChipSelections) {
		return apiFetch<QuickCreateSession>(
			`/api/quick-create/sessions/${sessionId}/chips`,
			{ method: "PATCH", body: JSON.stringify(body) },
			token,
		);
	},

	async startBuild(token: string, sessionId: string) {
		return apiFetch<{
			sessionId: string;
			buildJobId: string;
			status: string;
			progress: number;
			streamUrl: string;
		}>(
			`/api/quick-create/sessions/${sessionId}/build`,
			{ method: "POST" },
			token,
		);
	},

	async getBuildStatus(token: string, sessionId: string) {
		return apiFetch<{
			sessionId: string;
			status: string;
			progress: number;
		}>(
			`/api/quick-create/sessions/${sessionId}/build`,
			{},
			token,
		);
	},

	async cancelBuild(token: string, sessionId: string) {
		return apiFetch<{ sessionId: string; status: string }>(
			`/api/quick-create/sessions/${sessionId}/build`,
			{ method: "DELETE" },
			token,
		);
	},

	async listWorkflows(token: string, tier: "standard" | "pro" | "max" = "standard") {
		return apiFetch<{ items: WorkflowSummary[] }>(
			`/api/quick-create/workflows?tier=${tier}`,
			{},
			token,
		);
	},

	subscribeBuildStream(
		sessionId: string,
		onMessage: (event: BuildStreamEvent) => void,
		onError?: (err: Event) => void,
	): WebSocket | null {
		if (typeof window === "undefined") return null;
		const wsUrl = API_BASE.replace(/^https?/, "wss") +
			`/api/quick-create/sessions/${sessionId}/build/stream`;
		const ws = new WebSocket(wsUrl);
		ws.onmessage = (e) => {
			try {
				onMessage(JSON.parse(e.data));
			} catch (err) {
				console.error("[quick-create] WS parse error", err);
			}
		};
		if (onError) ws.onerror = onError;
		return ws;
	},
};

export type BuildStreamEvent =
	| { type: "status-change"; sessionId: string; status: string; progress: number }
	| { type: "completed"; sessionId: string; status: string }
	| { type: "error"; message: string };

export { ApiError };
