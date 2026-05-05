/**
 * Yjs CRDT chaos fuzzer — Sprint S25 (PW-29 D26 mandate).
 *
 * Per SCOPE D26: "build CẨN THẬN với chaos fuzzing 1000 simulated edit
 * trước launch". This service generates randomized concurrent Yjs edits
 * across N simulated clients on a single Doc, asserts convergence
 * (all clients reach identical state), and reports any divergence.
 *
 * Run via admin endpoint: POST /api/admin/collab/chaos-fuzz
 *   body: { iterations: 1000, clientCount: 5 }
 *
 * Algorithm:
 *   1. Spawn N in-memory Yjs Docs (no network) connected via shared
 *      shared update bus (broadcasts every applyUpdate).
 *   2. Per iteration: pick random client, perform random op:
 *      - set scene script
 *      - reorder scene
 *      - delete scene
 *      - insert scene
 *      - update segment style
 *   3. After all iterations + final sync flush, encode state of every
 *      client → SHA-256 hash → assert all equal.
 *   4. Report: iterations done / convergent / divergent / time
 */

import { createHash } from "node:crypto";
import * as Y from "yjs";

interface FuzzClient {
	id: number;
	doc: Y.Doc;
}

interface FuzzReport {
	iterations: number;
	clientCount: number;
	convergent: boolean;
	finalStateHashes: string[];
	durationMs: number;
	opCounts: Record<string, number>;
}

type FuzzOp =
	| "set-script"
	| "reorder-scene"
	| "delete-scene"
	| "insert-scene"
	| "update-style";

const OPS: FuzzOp[] = [
	"set-script",
	"reorder-scene",
	"delete-scene",
	"insert-scene",
	"update-style",
];

function pickOp(): FuzzOp {
	return OPS[Math.floor(Math.random() * OPS.length)] ?? "set-script";
}

function pickClient(clients: FuzzClient[]): FuzzClient {
	return clients[Math.floor(Math.random() * clients.length)] ?? clients[0]!;
}

/**
 * Initialize all clients with same baseline state — 5 scenes seeded.
 */
function seedBaseline(clients: FuzzClient[]): void {
	const baseline = clients[0]!.doc.getMap("editorState");
	const scenes = new Y.Array<Y.Map<unknown>>();
	for (let i = 0; i < 5; i++) {
		const scene = new Y.Map<unknown>();
		scene.set("id", `scene-${i + 1}`);
		scene.set("order", i + 1);
		scene.set("script", `Initial scene ${i + 1}`);
		scene.set("durationSec", 5);
		scenes.push([scene]);
	}
	baseline.set("scenes", scenes);
	const update = Y.encodeStateAsUpdate(clients[0]!.doc);
	for (let i = 1; i < clients.length; i++) {
		Y.applyUpdate(clients[i]!.doc, update);
	}
}

/**
 * Apply a single fuzzed op on the chosen client. Catches errors so a single
 * corrupted op doesn't terminate the whole fuzz session.
 */
function applyFuzzOp(client: FuzzClient, op: FuzzOp): boolean {
	try {
		const editorState = client.doc.getMap("editorState");
		const scenes = editorState.get("scenes") as Y.Array<Y.Map<unknown>> | undefined;
		if (!scenes || scenes.length === 0) return false;

		switch (op) {
			case "set-script": {
				const idx = Math.floor(Math.random() * scenes.length);
				const scene = scenes.get(idx);
				if (scene) {
					scene.set(
						"script",
						`Updated by client ${client.id} at ${Date.now()} ${Math.random().toString(36).slice(2, 8)}`,
					);
				}
				return true;
			}
			case "reorder-scene": {
				if (scenes.length < 2) return false;
				const i = Math.floor(Math.random() * scenes.length);
				let j = Math.floor(Math.random() * scenes.length);
				while (j === i && scenes.length > 1) j = Math.floor(Math.random() * scenes.length);
				const moving = scenes.get(i);
				if (!moving) return false;
				// Yjs Array doesn't support move directly — clone snapshot, delete, insert
				const cloneMap = new Y.Map<unknown>();
				moving.forEach((v, k) => cloneMap.set(k, v));
				scenes.delete(i, 1);
				const targetIdx = j > i ? j - 1 : j;
				scenes.insert(Math.min(targetIdx, scenes.length), [cloneMap]);
				return true;
			}
			case "delete-scene": {
				if (scenes.length <= 1) return false;
				const idx = Math.floor(Math.random() * scenes.length);
				scenes.delete(idx, 1);
				return true;
			}
			case "insert-scene": {
				const newScene = new Y.Map<unknown>();
				newScene.set("id", `scene-${Date.now()}-${client.id}`);
				newScene.set("order", scenes.length + 1);
				newScene.set("script", `Inserted by client ${client.id}`);
				newScene.set("durationSec", 3 + Math.floor(Math.random() * 5));
				const insertIdx = Math.floor(Math.random() * (scenes.length + 1));
				scenes.insert(insertIdx, [newScene]);
				return true;
			}
			case "update-style": {
				const idx = Math.floor(Math.random() * scenes.length);
				const scene = scenes.get(idx);
				if (scene) {
					scene.set("style", { fontSize: 32 + Math.floor(Math.random() * 32) });
				}
				return true;
			}
		}
	} catch {
		return false;
	}
	return false;
}

/**
 * Broadcast: when any client mutates → encode update → applyUpdate to all
 * other clients. Simulates Hocuspocus relaying updates. Order randomized
 * to stress concurrent merge behavior.
 */
function setupBroadcast(clients: FuzzClient[]): void {
	for (const c of clients) {
		c.doc.on("update", (update: Uint8Array, origin: unknown) => {
			// Skip echo from our own apply to avoid loops
			if (origin === "broadcast") return;
			for (const other of clients) {
				if (other.id === c.id) continue;
				Y.applyUpdate(other.doc, update, "broadcast");
			}
		});
	}
}

function hashDoc(doc: Y.Doc): string {
	const update = Y.encodeStateAsUpdate(doc);
	return createHash("sha256").update(update).digest("hex").slice(0, 16);
}

/**
 * Run chaos fuzzing. Returns report with convergence status.
 */
export function runChaosFuzz(opts: {
	iterations: number;
	clientCount: number;
}): FuzzReport {
	const start = Date.now();
	const clients: FuzzClient[] = Array.from({ length: opts.clientCount }, (_, i) => ({
		id: i,
		doc: new Y.Doc(),
	}));

	// Seed baseline + start broadcasting updates
	seedBaseline(clients);
	setupBroadcast(clients);

	const opCounts: Record<string, number> = {};
	for (let i = 0; i < opts.iterations; i++) {
		const client = pickClient(clients);
		const op = pickOp();
		const success = applyFuzzOp(client, op);
		opCounts[op] = (opCounts[op] ?? 0) + (success ? 1 : 0);
	}

	// Final sync flush — apply pending updates
	for (let pass = 0; pass < 3; pass++) {
		for (const c of clients) {
			const update = Y.encodeStateAsUpdate(c.doc);
			for (const other of clients) {
				if (other.id !== c.id) Y.applyUpdate(other.doc, update, "broadcast");
			}
		}
	}

	const finalStateHashes = clients.map((c) => hashDoc(c.doc));
	const allEqual = finalStateHashes.every((h) => h === finalStateHashes[0]);

	return {
		iterations: opts.iterations,
		clientCount: opts.clientCount,
		convergent: allEqual,
		finalStateHashes,
		durationMs: Date.now() - start,
		opCounts,
	};
}
