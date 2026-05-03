/**
 * Voice picker modal — opened from Narrator button per SCOPE §13 View 6.
 *
 * Lists ElevenLabs voices via /api/voices, filterable by language + gender,
 * with preview audio. Selection returns voiceId + name to caller.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Play, Pause, AlertCircle, Search } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api-client";

interface VoiceCard {
	voiceId: string;
	name: string;
	previewUrl: string | null;
	category: string;
	gender: string | null;
	age: string | null;
	useCase: string | null;
	language: string | null;
	accent: string | null;
}

interface VoicePickerDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentVoiceId?: string;
	onSelect: (voice: { voiceId: string; name: string }) => void;
}

type LangFilter = "all" | "vi" | "en";
type GenderFilter = "all" | "male" | "female";

export function VoicePickerDialog({
	open,
	onOpenChange,
	currentVoiceId,
	onSelect,
}: VoicePickerDialogProps) {
	const [voices, setVoices] = useState<VoiceCard[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [lang, setLang] = useState<LangFilter>("all");
	const [gender, setGender] = useState<GenderFilter>("all");
	const [playingId, setPlayingId] = useState<string | null>(null);
	const [selectedId, setSelectedId] = useState<string>(currentVoiceId ?? "");
	const audioRef = useRef<HTMLAudioElement | null>(null);

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		(async () => {
			setLoading(true);
			setError(null);
			try {
				const params = new URLSearchParams({ pageSize: "50" });
				if (lang !== "all") params.set("lang", lang);
				if (gender !== "all") params.set("gender", gender);
				const res = await apiFetch<{ items: VoiceCard[] }>(`/api/voices?${params}`);
				if (!cancelled) setVoices(res.items);
			} catch (err) {
				if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load voices");
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [open, lang, gender]);

	useEffect(() => {
		if (!open) {
			audioRef.current?.pause();
			setPlayingId(null);
		}
	}, [open]);

	const togglePreview = (voice: VoiceCard) => {
		if (!voice.previewUrl) return;
		if (playingId === voice.voiceId) {
			audioRef.current?.pause();
			setPlayingId(null);
			return;
		}
		audioRef.current?.pause();
		const audio = new Audio(voice.previewUrl);
		audioRef.current = audio;
		setPlayingId(voice.voiceId);
		audio.onended = () => setPlayingId(null);
		audio.onerror = () => setPlayingId(null);
		void audio.play();
	};

	const filtered = search.trim()
		? voices.filter((v) =>
				v.name.toLowerCase().includes(search.toLowerCase()) ||
				(v.useCase ?? "").toLowerCase().includes(search.toLowerCase()),
			)
		: voices;

	const handleConfirm = () => {
		const picked = voices.find((v) => v.voiceId === selectedId);
		if (picked) onSelect({ voiceId: picked.voiceId, name: picked.name });
		audioRef.current?.pause();
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden">
				<DialogHeader>
					<DialogTitle>Pick narrator voice</DialogTitle>
					<DialogDescription>
						ElevenLabs marketplace · Vietnamese + English · click row to preview
					</DialogDescription>
				</DialogHeader>

				{/* Filters */}
				<div className="flex flex-wrap gap-2 border-b pb-3">
					<div className="relative flex-1">
						<Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search voice name…"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="pl-8"
						/>
					</div>
					<select
						value={lang}
						onChange={(e) => setLang(e.target.value as LangFilter)}
						className="rounded-md border bg-background px-3 py-1.5 text-sm"
					>
						<option value="all">All languages</option>
						<option value="vi">Vietnamese</option>
						<option value="en">English</option>
					</select>
					<select
						value={gender}
						onChange={(e) => setGender(e.target.value as GenderFilter)}
						className="rounded-md border bg-background px-3 py-1.5 text-sm"
					>
						<option value="all">All genders</option>
						<option value="female">Female</option>
						<option value="male">Male</option>
					</select>
				</div>

				{/* Voice list */}
				<div className="-mx-2 max-h-[50vh] overflow-y-auto px-2">
					{loading && (
						<div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
							<Loader2 className="h-6 w-6 animate-spin" />
							<span className="text-sm">Loading voices…</span>
						</div>
					)}
					{error && !loading && (
						<div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
							<AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
							<span>{error}</span>
						</div>
					)}
					{!loading && !error && filtered.length === 0 && (
						<div className="py-12 text-center text-sm text-muted-foreground">
							No voices match these filters.
						</div>
					)}
					{!loading && !error && filtered.length > 0 && (
						<ul className="space-y-1.5">
							{filtered.map((v) => (
								<li
									key={v.voiceId}
									className={`flex items-center gap-3 rounded-md border bg-card px-3 py-2 cursor-pointer transition-colors ${
										selectedId === v.voiceId
											? "border-primary bg-primary/5"
											: "hover:border-primary/50"
									}`}
									onClick={() => setSelectedId(v.voiceId)}
								>
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											togglePreview(v);
										}}
										disabled={!v.previewUrl}
										className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30"
									>
										{playingId === v.voiceId ? (
											<Pause className="h-3.5 w-3.5" />
										) : (
											<Play className="h-3.5 w-3.5" />
										)}
									</button>
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<span className="truncate font-medium text-sm">{v.name}</span>
											{v.gender && (
												<Badge variant="secondary" className="text-[10px]">
													{v.gender}
												</Badge>
											)}
											{v.language && (
												<Badge variant="outline" className="text-[10px]">
													{v.language}
												</Badge>
											)}
										</div>
										{v.useCase && (
											<p className="truncate text-xs text-muted-foreground">{v.useCase}</p>
										)}
									</div>
									<Mic
										className={`h-4 w-4 shrink-0 ${
											selectedId === v.voiceId ? "text-primary" : "text-muted-foreground"
										}`}
									/>
								</li>
							))}
						</ul>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleConfirm} disabled={!selectedId}>
						Use this voice
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
