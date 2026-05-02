/**
 * GPU spawn service — Sprint 5 Story 2.8.
 *
 * Spawns a DigitalOcean GPU droplet from snapshot ID 226870948 (anh chốt Q48).
 * Snapshot has Whisper-large-v3 + Demucs htdemucs_ft + SAM 2 + Real-ESRGAN +
 * RIFE + ComfyUI binary + Chromaprint + PySceneDetect pre-installed.
 *
 * Usage:
 *   const droplet = await spawnGpuFromSnapshot({ region: "tor1" });
 *   // ... run pipeline via SSH ...
 *   await destroyGpu(droplet.id);
 *
 * COST WARNING: ~$0.40/hr for L40S/RTX 6000 Ada. ALWAYS destroy after job.
 */

const DO_API_BASE = "https://api.digitalocean.com/v2";
const SNAPSHOT_ID = process.env["PIXSTUDIO_GPU_SNAPSHOT_ID_TOR1"] ?? "226870948";

export interface GpuDroplet {
	id: number;
	ipAddress: string | null;
	status: "new" | "active" | "off" | "archive";
	region: string;
	memoryMb: number;
	createdAt: string;
}

export interface SpawnGpuOptions {
	region?: "tor1" | "nyc1" | "ams3" | "sfo3";
	size?: "gpu-l40sx1-48gb" | "gpu-rtx6000ada-48gb"; // both supported by snapshot
	sshKeyFingerprints?: string[]; // overrides DO_SSH_KEY_FINGERPRINT env
}

interface DoApiOptions {
	timeout?: number;
}

async function doApiRequest<T>(
	path: string,
	options: { method?: string; body?: unknown } & DoApiOptions = {},
): Promise<T> {
	const token = process.env["DO_API_TOKEN"];
	if (!token) throw new Error("DO_API_TOKEN env var not set");
	const res = await fetch(`${DO_API_BASE}${path}`, {
		method: options.method ?? "GET",
		headers: {
			"Authorization": `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: options.body ? JSON.stringify(options.body) : undefined,
		signal: options.timeout ? AbortSignal.timeout(options.timeout) : undefined,
	});
	if (!res.ok) {
		const errBody = await res.text();
		throw new Error(`DO API ${res.status}: ${errBody}`);
	}
	return (await res.json()) as T;
}

/**
 * Spawn GPU droplet from PixStudio Path B snapshot.
 * Returns droplet ID + IP (after polling status=active).
 *
 * Time-to-active: ~60-90s for L40S in tor1 region.
 */
export async function spawnGpuFromSnapshot(opts: SpawnGpuOptions = {}): Promise<GpuDroplet> {
	const { region = "tor1", size = "gpu-l40sx1-48gb" } = opts;
	const sshKeys =
		opts.sshKeyFingerprints ??
		(process.env["DO_SSH_KEY_FINGERPRINT"]
			? [process.env["DO_SSH_KEY_FINGERPRINT"]]
			: []);

	if (sshKeys.length === 0) {
		throw new Error("No SSH key fingerprint provided — anh share via DO_SSH_KEY_FINGERPRINT env");
	}

	const createRes = await doApiRequest<{ droplet: { id: number; status: string; region: { slug: string }; memory: number; created_at: string } }>(
		"/droplets",
		{
			method: "POST",
			body: {
				name: `pixstudio-gpu-${Date.now()}`,
				region,
				size,
				image: Number(SNAPSHOT_ID),
				ssh_keys: sshKeys,
				backups: false,
				monitoring: true,
				tags: ["pixstudio", "gpu", "path-b"],
			},
		},
	);

	const dropletId = createRes.droplet.id;

	// Poll status until active or timeout
	const start = Date.now();
	const TIMEOUT_MS = 180_000; // 3min max wait
	const POLL_INTERVAL_MS = 5_000;
	let droplet = createRes.droplet;
	while (droplet.status !== "active") {
		if (Date.now() - start > TIMEOUT_MS) {
			throw new Error(`GPU droplet ${dropletId} did not reach active state within 3min`);
		}
		await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
		const status = await doApiRequest<{ droplet: typeof droplet & { networks: { v4: { ip_address: string; type: string }[] } } }>(
			`/droplets/${dropletId}`,
		);
		droplet = status.droplet as never;
	}

	const fullDroplet = await doApiRequest<{ droplet: { id: number; status: string; region: { slug: string }; memory: number; created_at: string; networks: { v4: { ip_address: string; type: string }[] } } }>(
		`/droplets/${dropletId}`,
	);
	const publicIp =
		fullDroplet.droplet.networks.v4.find((n) => n.type === "public")?.ip_address ?? null;

	return {
		id: fullDroplet.droplet.id,
		ipAddress: publicIp,
		status: fullDroplet.droplet.status as never,
		region: fullDroplet.droplet.region.slug,
		memoryMb: fullDroplet.droplet.memory,
		createdAt: fullDroplet.droplet.created_at,
	};
}

/**
 * Destroy GPU droplet — STOP BILLING immediately.
 * Always call in finally block of pipeline.
 */
export async function destroyGpu(dropletId: number): Promise<void> {
	await doApiRequest(`/droplets/${dropletId}`, { method: "DELETE" });
}

/**
 * List currently running PixStudio GPU droplets (for admin dashboard / cleanup).
 */
export async function listActiveGpuDroplets(): Promise<GpuDroplet[]> {
	const res = await doApiRequest<{ droplets: { id: number; status: string; region: { slug: string }; memory: number; created_at: string; networks: { v4: { ip_address: string; type: string }[] } }[] }>(
		"/droplets?tag_name=pixstudio",
	);
	return res.droplets.map((d) => ({
		id: d.id,
		ipAddress: d.networks.v4.find((n) => n.type === "public")?.ip_address ?? null,
		status: d.status as never,
		region: d.region.slug,
		memoryMb: d.memory,
		createdAt: d.created_at,
	}));
}
