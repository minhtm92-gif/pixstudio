/**
 * Voice library browse page — preview ElevenLabs voices.
 *
 * Wires to /api/voices (Sprint 2.5). Per Q38: 10 preview/session cap
 * client-side enforced (server has no per-session cap yet — relies on
 * global rate-limit plugin 100/min).
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Play, Pause, Filter } from "lucide-react";
import { PageShell } from "@/components/pixstudio/page-shell";
import { API_BASE, apiFetch, type PixStudioUser } from "@/lib/api-client";

interface Voice {
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

const STUB_USER: PixStudioUser = {
	name: "Demo",
	tier: "PRO",
	buildsUsed: 0,
	buildsLimit: 50,
};

const PREVIEW_CAP = 10;
const PREVIEW_TEXT_VN = "Xin chào, đây là giọng đọc thử. Cảm ơn anh đã chọn PixStudio.";
const PREVIEW_TEXT_EN = "Hello, this is a voice preview. Thanks for choosing PixStudio.";

export default function VoicesPage() {
	const [voices, setVoices] = useState<Voice[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female">("all");
	const [langFilter, setLangFilter] = useState<"all" | "vi" | "en">("all");
	const [previewCount, setPreviewCount] = useState(0);
	const [playingId, setPlayingId] = useState<string | null>(null);
	const [generatingPreview, setGeneratingPreview] = useState<string | null>(null);
	const audioRef = useRef<HTMLAudioElement | null>(null);

	useEffect(() => {
		const load = async () => {
			try {
				const data = await apiFetch<{ items: Voice[] }>(`/api/voices?pageSize=100`);
				setVoices(data.items);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load voices");
			} finally {
				setLoading(false);
			}
		};
		void load();
	}, []);

	const filtered = voices.filter((v) => {
		if (genderFilter !== "all" && v.gender !== genderFilter) return false;
		if (langFilter === "vi") return v.language?.toLowerCase().includes("vie") || v.accent?.toLowerCase().includes("viet");
		if (langFilter === "en") return v.language?.toLowerCase().includes("en") || v.accent?.toLowerCase().includes("american") || v.accent?.toLowerCase().includes("british");
		return true;
	});

	const handlePreview = async (voice: Voice) => {
		// Stop any current playback first.
		if (audioRef.current) {
			audioRef.current.pause();
			audioRef.current = null;
		}
		if (playingId === voice.voiceId) {
			setPlayingId(null);
			return;
		}

		// Use built-in preview_url if available (free, ElevenLabs-hosted sample).
		if (voice.previewUrl) {
			const audio = new Audio(voice.previewUrl);
			audio.onended = () => setPlayingId(null);
			audio.onerror = () => setPlayingId(null);
			audioRef.current = audio;
			void audio.play();
			setPlayingId(voice.voiceId);
			return;
		}

		// Custom TTS preview costs ElevenLabs credits — enforce cap.
		if (previewCount >= PREVIEW_CAP) {
			alert(`Preview limit ${PREVIEW_CAP}/session reached. Reload trang để reset.`);
			return;
		}

		setGeneratingPreview(voice.voiceId);
		try {
			const lang = voice.language?.toLowerCase().includes("vie") ? "vi" : "en";
			const text = lang === "vi" ? PREVIEW_TEXT_VN : PREVIEW_TEXT_EN;
			const res = await fetch(`${API_BASE}/api/voices/${voice.voiceId}/preview`, {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text }),
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const audio = new Audio(url);
			audio.onended = () => {
				setPlayingId(null);
				URL.revokeObjectURL(url);
			};
			audioRef.current = audio;
			void audio.play();
			setPlayingId(voice.voiceId);
			setPreviewCount(previewCount + 1);
		} catch (err) {
			alert(err instanceof Error ? err.message : "Preview failed");
		} finally {
			setGeneratingPreview(null);
		}
	};

	return (
		<PageShell user={STUB_USER}>
			<div className="px-8 pt-6">
				<div className="mb-2 font-mono text-xs text-white/50">Home / Settings / Voices</div>
				<div className="flex items-start justify-between gap-4">
					<div>
						<h1 className="flex flex-wrap items-center gap-3 font-serif text-3xl font-normal text-zinc-300">
							<Mic className="h-7 w-7 text-[#60A5FA]" />
							Voice Library
						</h1>
						<p className="mt-1.5 text-sm text-white/50">
							ElevenLabs voices · multilingual_v2 · {filtered.length} match · preview {previewCount}/{PREVIEW_CAP} used
						</p>
					</div>
				</div>
			</div>

			<div className="px-8 pt-4">
				<div className="flex flex-wrap items-center gap-2">
					<Filter className="h-4 w-4 text-white/40" />
					<select
						value={genderFilter}
						onChange={(e) => setGenderFilter(e.target.value as typeof genderFilter)}
						className="rounded-md border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-white/87"
					>
						<option value="all">All genders</option>
						<option value="female">Female</option>
						<option value="male">Male</option>
					</select>
					<select
						value={langFilter}
						onChange={(e) => setLangFilter(e.target.value as typeof langFilter)}
						className="rounded-md border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-white/87"
					>
						<option value="all">All languages</option>
						<option value="vi">Vietnamese</option>
						<option value="en">English</option>
					</select>
				</div>
			</div>

			<div className="px-8 py-6">
				{loading && <div className="text-sm text-white/50">Loading voices…</div>}
				{error && (
					<div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-4 text-sm text-orange-300">
						{error}
					</div>
				)}
				{!loading && !error && (
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{filtered.map((voice) => (
							<div
								key={voice.voiceId}
								className="rounded-xl border border-white/10 bg-zinc-900 p-4 hover:border-white/25"
							>
								<div className="mb-2 flex items-start justify-between gap-2">
									<div>
										<h3 className="text-sm font-medium text-white/87">{voice.name}</h3>
										<div className="mt-0.5 text-[10px] text-white/40">
											{voice.gender ?? "—"} · {voice.age ?? "—"} · {voice.language ?? voice.accent ?? "—"}
										</div>
									</div>
									<button
										type="button"
										onClick={() => void handlePreview(voice)}
										disabled={generatingPreview === voice.voiceId}
										className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
											playingId === voice.voiceId
												? "bg-[#3B82F6] text-white"
												: "bg-zinc-800 text-white/60 hover:bg-[#3B82F6]/20 hover:text-[#60A5FA]"
										} disabled:opacity-50`}
										aria-label={playingId === voice.voiceId ? "Pause" : "Play preview"}
									>
										{generatingPreview === voice.voiceId ? (
											<div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
										) : playingId === voice.voiceId ? (
											<Pause className="h-3.5 w-3.5" />
										) : (
											<Play className="h-3.5 w-3.5" />
										)}
									</button>
								</div>
								{voice.useCase && (
									<p className="text-[11px] leading-snug text-white/50 line-clamp-2">
										{voice.useCase}
									</p>
								)}
								<div className="mt-2 flex items-center gap-1">
									<span className="rounded border border-white/10 bg-zinc-800 px-1.5 py-0.5 font-mono text-[9px] text-white/50">
										{voice.category}
									</span>
									{voice.previewUrl ? (
										<span className="rounded border border-green-500/30 bg-green-500/10 px-1.5 py-0.5 text-[9px] text-green-300">
											free preview
										</span>
									) : (
										<span className="rounded border border-yellow-500/30 bg-yellow-500/10 px-1.5 py-0.5 text-[9px] text-yellow-300">
											custom TTS
										</span>
									)}
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</PageShell>
	);
}
