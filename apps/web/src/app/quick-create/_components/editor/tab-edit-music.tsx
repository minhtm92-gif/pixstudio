/**
 * Tab 3: Edit music (Sprint 4 Story 1.11).
 *
 * Layout per SCOPE.md §13:
 *   - Top: selected music card with drag handle (start point picker)
 *   - Middle: library list (FB Sound Collection + TikTok CC + YouTube AL + uploaded)
 *   - Bottom: search + premium toggle + Upload button
 *   - Auto-trim đoạn nhạc fit tổng video duration
 */

"use client";

import { useState } from "react";
import { Music, Search, Upload, Crown, Play, Pause } from "lucide-react";

interface MusicTrack {
	id: string;
	title: string;
	artist: string;
	durationSec: number;
	source: "fb" | "tiktok" | "youtube" | "uploaded";
	premium: boolean;
	r2Key?: string;
}

interface TabEditMusicProps {
	projectId: string;
	editorState: Record<string, unknown> | null;
	onUpdate: (state: Record<string, unknown>) => void;
}

// Mock library — Sprint 6 wires real /api/music endpoint backed by FB+TikTok+YT scraped pool
const MOCK_LIBRARY: MusicTrack[] = [
	{ id: "fb-001", title: "Sunny Hop", artist: "Nicolai Heidlas", durationSec: 134, source: "fb", premium: false },
	{ id: "fb-002", title: "Coffee Shop", artist: "Lemon Jelly", durationSec: 187, source: "fb", premium: false },
	{ id: "tt-001", title: "Viral Beat A", artist: "TikTok Pool", durationSec: 30, source: "tiktok", premium: false },
	{ id: "tt-002", title: "Trending Drop", artist: "TikTok Pool", durationSec: 45, source: "tiktok", premium: false },
	{ id: "yt-001", title: "Cinematic Build", artist: "YT Audio Library", durationSec: 210, source: "youtube", premium: false },
	{ id: "yt-002", title: "Epic Orchestra", artist: "YT Audio Library", durationSec: 180, source: "youtube", premium: true },
];

export function TabEditMusic({ editorState, onUpdate }: TabEditMusicProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [premiumOnly, setPremiumOnly] = useState(false);
	const [playingId, setPlayingId] = useState<string | null>(null);
	const [musicStartSec, setMusicStartSec] = useState(0);

	const audio = (editorState?.["timeline"] as { audio?: Record<string, unknown> })?.audio ?? {};
	const selectedTrackId = audio["musicTrackId"] as string | undefined;
	const selectedTrack = MOCK_LIBRARY.find((t) => t.id === selectedTrackId);

	const totalVideoDuration =
		Number((editorState?.["timeline"] as { duration?: number })?.duration ?? 30);

	const filtered = MOCK_LIBRARY.filter((t) => {
		if (premiumOnly && !t.premium) return false;
		if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase()) && !t.artist.toLowerCase().includes(searchQuery.toLowerCase())) {
			return false;
		}
		return true;
	});

	const selectTrack = (track: MusicTrack) => {
		const ts = (editorState?.["timeline"] as Record<string, unknown>) ?? {};
		const a = (ts["audio"] as Record<string, unknown>) ?? {};
		onUpdate({
			...editorState,
			timeline: {
				...ts,
				audio: {
					...a,
					musicTrackId: track.id,
					musicStartSec,
					musicSource: track.source,
				},
			},
		});
	};

	return (
		<div className="flex h-full flex-col overflow-hidden">
			{/* Selected music card */}
			{selectedTrack ? (
				<div className="border-b bg-card px-6 py-4">
					<div className="text-xs font-semibold uppercase text-muted-foreground">Selected music</div>
					<div className="mt-2 flex items-center gap-3">
						<div className="rounded-md bg-primary/10 p-3">
							<Music className="h-6 w-6 text-primary" />
						</div>
						<div className="flex-1">
							<div className="font-medium">
								{selectedTrack.title} {selectedTrack.premium && <Crown className="inline h-3 w-3 text-yellow-500" />}
							</div>
							<div className="text-xs text-muted-foreground">
								{selectedTrack.artist} · {selectedTrack.durationSec}s · {selectedTrack.source.toUpperCase()}
							</div>
						</div>
					</div>

					{/* Start point picker */}
					<div className="mt-3">
						<label className="text-xs font-medium">
							Start at: {musicStartSec.toFixed(1)}s (preview {totalVideoDuration}s total)
						</label>
						<input
							type="range"
							min="0"
							max={Math.max(0, selectedTrack.durationSec - totalVideoDuration)}
							step="0.5"
							value={musicStartSec}
							onChange={(e) => setMusicStartSec(Number(e.target.value))}
							className="mt-1 w-full"
						/>
						<div className="mt-1 text-[10px] text-muted-foreground">
							Auto-trim từ {musicStartSec.toFixed(1)}s → {(musicStartSec + totalVideoDuration).toFixed(1)}s
						</div>
					</div>
				</div>
			) : (
				<div className="border-b bg-muted/30 px-6 py-4 text-sm text-muted-foreground">
					No music selected. Pick from library below.
				</div>
			)}

			{/* Search + filters */}
			<div className="border-b bg-card px-6 py-3">
				<div className="flex items-center gap-3">
					<div className="flex flex-1 items-center gap-2 rounded-md border bg-background px-3 py-2">
						<Search className="h-4 w-4 text-muted-foreground" />
						<input
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search music..."
							className="flex-1 bg-transparent text-sm outline-none"
						/>
					</div>
					<label className="flex items-center gap-1.5 text-xs">
						<input
							type="checkbox"
							checked={premiumOnly}
							onChange={(e) => setPremiumOnly(e.target.checked)}
						/>
						<Crown className="h-3 w-3 text-yellow-500" />
						Premium only
					</label>
					<button
						className="flex items-center gap-1 rounded-md border bg-background px-3 py-2 text-xs hover:bg-muted"
						title="Upload your own music"
					>
						<Upload className="h-3.5 w-3.5" />
						Upload
					</button>
				</div>
			</div>

			{/* Library list */}
			<div className="flex-1 overflow-auto px-6 py-3">
				{filtered.length === 0 ? (
					<div className="text-sm text-muted-foreground">No matching tracks.</div>
				) : (
					<ul className="space-y-1">
						{filtered.map((track) => (
							<li
								key={track.id}
								onClick={() => selectTrack(track)}
								className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm transition-colors ${
									selectedTrackId === track.id
										? "border-primary bg-primary/10"
										: "border-border bg-card hover:border-primary/50"
								}`}
							>
								<button
									onClick={(e) => {
										e.stopPropagation();
										setPlayingId(playingId === track.id ? null : track.id);
									}}
									className="rounded-full bg-muted p-2 hover:bg-primary/20"
								>
									{playingId === track.id ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
								</button>
								<div className="flex-1">
									<div className="font-medium">
										{track.title}
										{track.premium && <Crown className="ml-1 inline h-3 w-3 text-yellow-500" />}
									</div>
									<div className="text-xs text-muted-foreground">
										{track.artist} · {track.source.toUpperCase()}
									</div>
								</div>
								<div className="text-xs text-muted-foreground">{track.durationSec}s</div>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
