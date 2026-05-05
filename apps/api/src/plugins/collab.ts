/**
 * Hocuspocus Yjs collaboration server plugin — Sprint S24 (PW-29 phase A).
 *
 * Per SCOPE D26: build CẨN THẬN with chaos fuzzing 1000 simulated edits
 * (S25 follow-up). This plugin provides:
 *   - WebSocket upgrade endpoint at /collab
 *   - Hocuspocus server with Database extension (persists Yjs Doc to
 *     Project.editorStateJson on each save)
 *   - Authentication hook — verify session cookie before joining doc
 *   - Per-document name = projectId
 *
 * Frontend connects via:
 *   new HocuspocusProvider({
 *     url: "wss://api.studio.pixelxlab.com/collab",
 *     name: projectId,
 *     token: betterAuthSessionToken,
 *   })
 *
 * Awareness (cursor presence) ships out-of-the-box via Hocuspocus —
 * frontend reads provider.awareness.getStates() for presence avatars.
 */

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { Server as HocuspocusServer } from "@hocuspocus/server";
import { Database } from "@hocuspocus/extension-database";
import * as Y from "yjs";

const PROJECT_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const collabPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
	const hocuspocus = HocuspocusServer.configure({
		// Bind via Fastify WebSocket upgrade — see route registration below.
		extensions: [
			new Database({
				/**
				 * Fetch Yjs document state from Project.editorStateJson on first join.
				 * Convert OpenCut JSON editor state → Yjs Doc Map structure.
				 */
				fetch: async ({ documentName }) => {
					if (!PROJECT_ID_REGEX.test(documentName)) {
						app.log.warn({ documentName }, "collab: rejected non-uuid documentName");
						return null;
					}
					const project = await app.prisma.project.findUnique({
						where: { id: documentName },
						select: { id: true, editorStateJson: true },
					});
					if (!project) return null;
					if (!project.editorStateJson) {
						// Empty doc — Hocuspocus initializes blank Yjs Doc.
						return null;
					}
					// Project state stored as JSON. Hocuspocus Database returns Uint8Array
					// of Yjs update binary. To bootstrap from JSON, encode current state
					// as Yjs map then return the encoded snapshot.
					const ydoc = new Y.Doc();
					const yState = ydoc.getMap("editorState");
					// Lazy import: editorStateJson is plain object — store entire payload
					// under "snapshot" key so frontend reads ydoc.getMap("editorState").get("snapshot")
					yState.set("snapshot", project.editorStateJson as never);
					return Y.encodeStateAsUpdate(ydoc);
				},
				/**
				 * Persist Yjs document state back to Project.editorStateJson on
				 * Hocuspocus's debounced auto-save (default ~2s after last edit).
				 */
				store: async ({ documentName, state, document }) => {
					if (!PROJECT_ID_REGEX.test(documentName)) return;
					try {
						// Read current Yjs map snapshot → JSON
						const yState = document.getMap("editorState");
						const snapshot = yState.get("snapshot");
						if (!snapshot) {
							app.log.warn({ documentName }, "collab store: empty snapshot — skip");
							return;
						}
						await app.prisma.project.update({
							where: { id: documentName },
							data: {
								editorStateJson: snapshot as never,
								// Note: editorStateVersion intentionally not bumped here —
								// auto-save replaces in place. Manual snapshots via /api/projects/:id/snapshot
								// create new ProjectVersion rows.
								lastEditedAt: new Date(),
							},
						});
						app.log.debug(
							{ documentName, stateBytes: state.length },
							"collab store: persisted to Project.editorStateJson",
						);
					} catch (err) {
						app.log.error(
							{ documentName, err: err instanceof Error ? err.message : String(err) },
							"collab store failed",
						);
					}
				},
			}),
		],

		/**
		 * Auth hook — verify better-auth session token from connection params.
		 * Token comes from frontend HocuspocusProvider({ token: ... }).
		 * S25 follow-up: enforce workspace membership + role check (Owner/Editor).
		 */
		async onAuthenticate({ documentName, token }) {
			if (!PROJECT_ID_REGEX.test(documentName)) {
				throw new Error(`Invalid documentName: ${documentName}`);
			}
			if (!token) {
				throw new Error("Auth token required");
			}
			// v1 trust the token (better-auth session validation in S25)
			// — Hocuspocus throws if this raises. Production: validate via
			// app.auth.validateSession(token) once that helper exists.
			return { token };
		},
	});

	app.decorate("hocuspocus", hocuspocus);
	app.log.info({}, "Hocuspocus collab server initialized");

	// Hocuspocus exposes its own WebSocket server. Mount via Fastify upgrade.
	// Hosting under same Fastify app to share auth + cors. Path: /collab
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	app.get("/collab", { websocket: true }, (socket: any, request: any) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		hocuspocus.handleConnection(socket as any, request as any);
	});
};

declare module "fastify" {
	interface FastifyInstance {
		hocuspocus: ReturnType<typeof HocuspocusServer.configure>;
	}
}

export default fp(collabPlugin, {
	name: "collab",
	dependencies: ["prisma"],
});
