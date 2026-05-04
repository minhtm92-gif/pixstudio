/**
 * Admin Music Library upload page (Sprint 40).
 *
 * Catalog metadata lives in apps/api/src/data/music-tracks.ts (10 seed tracks).
 * Admin uploads MP3 file → R2 presigned PUT to expectedR2Key.
 * After upload, anh edits expectedR2Key → r2Key in static catalog file.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, Music, Upload, CheckCircle2 } from "lucide-react";
import { PageShell } from "@/components/pixstudio/page-shell";
import { apiFetch } from "@/lib/api-client";
import { useAuthUser } from "@/hooks/use-auth-user";

interface Track {
	id: string;
	title: string;
	artist: string;
	mood: string;
	genre: string;
	durationSec: number;
	source: string;
	expectedR2Key: string;
	r2Key: string | null;
}

export default function AdminMusicPage() {
	const { user } = useAuthUser();
	const [tracks, setTracks] = useState<Track[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [uploadingId, setUploadingId] = useState<string | null>(null);
	const [uploaded, setUploaded] = useState<Set<string>>(new Set());

	useEffect(() => {
		apiFetch<{ items: Track[] }>("/api/music")
			.then((data) => setTracks(data.items))
			.catch((err) => {
				const msg = err instanceof Error ? err.message : String(err);
				setError(msg.includes("401") || msg.includes("403") ? "Admin role required" : msg);
			});
	}, []);

	const handleUpload = async (track: Track, file: File) => {
		if (file.size > 10 * 1024 * 1024) {
			alert("File quá lớn (max 10MB)");
			return;
		}
		setUploadingId(track.id);
		try {
			const presign = await apiFetch<{ presignedUrl: string; r2Key: string }>(
				"/api/music/admin/upload-presign",
				{
					method: "POST",
					body: JSON.stringify({
						trackId: track.id,
						mimeType: file.type === "audio/mp3" ? "audio/mpeg" : file.type,
						sizeBytes: file.size,
					}),
				},
			);
			const putRes = await fetch(presign.presignedUrl, {
				method: "PUT",
				body: file,
				headers: { "Content-Type": file.type },
			});
			if (!putRes.ok) throw new Error(`R2 upload HTTP ${putRes.status}`);
			setUploaded((prev) => new Set([...prev, track.id]));
		} catch (err) {
			alert(err instanceof Error ? err.message : "Upload failed");
		} finally {
			setUploadingId(null);
		}
	};

	return (
		<PageShell user={user}>
			<div className="px-8 pt-6">
				<div className="mb-2 font-mono text-xs text-white/50">Home / Settings / Admin / Music</div>
				<h1 className="flex flex-wrap items-center gap-3 font-serif text-3xl font-normal text-zinc-300">
					<Music className="h-7 w-7 text-[#60A5FA]" />
					Music Library Upload
					<span className="flex items-center gap-1 rounded border border-yellow-500/50 bg-yellow-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-yellow-400">
						<Lock className="h-3 w-3" />
						Admin Only
					</span>
				</h1>
				<p className="mt-1.5 text-sm text-white/50">
					Upload MP3/WAV cho 10 tracks trong catalog · max 10MB/file · auto-PUT R2 vào expectedR2Key path
				</p>
			</div>

			<div className="px-8 py-6">
				{error && (
					<div className="mb-4 rounded-md border border-orange-500/30 bg-orange-500/10 p-3 text-sm text-orange-300">
						{error}
					</div>
				)}

				<div className="space-y-2">
					{tracks.map((track) => (
						<TrackRow
							key={track.id}
							track={track}
							hasFile={!!track.r2Key || uploaded.has(track.id)}
							isUploading={uploadingId === track.id}
							onUpload={(file) => void handleUpload(track, file)}
						/>
					))}
				</div>

				<div className="mt-6 rounded-md border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-300">
					<strong>Sau upload</strong>: anh edit{" "}
					<code className="rounded bg-zinc-900 px-1 py-0.5 font-mono">apps/api/src/data/music-tracks.ts</code>{" "}
					— thay <code>r2Key: null</code> bằng <code>r2Key: expectedR2Key</code>. Phase 2: tự động sync via DB.
				</div>
			</div>
		</PageShell>
	);
}

function TrackRow({
	track,
	hasFile,
	isUploading,
	onUpload,
}: {
	track: Track;
	hasFile: boolean;
	isUploading: boolean;
	onUpload: (file: File) => void;
}) {
	const fileRef = useRef<HTMLInputElement>(null);
	return (
		<div className="flex items-center gap-3 rounded-lg border border-white/10 bg-zinc-900 p-3">
			<div
				className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
					hasFile ? "bg-green-500/15 text-green-400" : "bg-zinc-800 text-white/40"
				}`}
			>
				{hasFile ? <CheckCircle2 className="h-4 w-4" /> : <Music className="h-4 w-4" />}
			</div>
			<div className="flex-1 min-w-0">
				<div className="text-sm font-medium text-white/87">
					{track.title}{" "}
					<span className="text-[10px] text-white/40">— {track.artist}</span>
				</div>
				<div className="text-[11px] text-white/50">
					{track.source.replace(/_/g, " ")} · {track.genre} · {track.mood} · {track.durationSec}s
				</div>
				<div className="mt-1 truncate font-mono text-[10px] text-white/30">
					{track.expectedR2Key}
				</div>
			</div>
			<input
				ref={fileRef}
				type="file"
				accept="audio/mpeg,audio/mp3,audio/wav"
				onChange={(e) => {
					const file = e.target.files?.[0];
					if (file) onUpload(file);
				}}
				className="hidden"
			/>
			<button
				type="button"
				onClick={() => fileRef.current?.click()}
				disabled={isUploading}
				className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
					hasFile
						? "border border-white/10 bg-zinc-800 text-white/70 hover:bg-zinc-700"
						: "bg-[#3B82F6] text-white hover:bg-[#3B82F6]/90"
				} disabled:opacity-50`}
			>
				<Upload className="h-3.5 w-3.5" />
				{isUploading ? "Đang upload..." : hasFile ? "Replace" : "Upload"}
			</button>
		</div>
	);
}
