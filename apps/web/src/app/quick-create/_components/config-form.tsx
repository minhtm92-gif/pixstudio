"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { apiFetch } from "@/lib/api-client";

type Pace = "slow" | "medium" | "fast";
type Language = "vi" | "en";
type MusicSource = "library" | "uploaded";

interface ConfigFormProps {
	workflowId: string;
	sessionId?: string | undefined;
}

interface ConfigState {
	pace: Pace;
	topic: string;
	musicPrompt: string;
	language: Language;
	style: string;

	// Setting 1: Voice + narrator
	voiceGender: "male" | "female";
	voiceId: string;
	narratorRole: string;
	addNarrator: boolean;

	// Setting 2: Subtitle
	subtitleEnabled: boolean;
	subtitleFont: string;

	// Setting 3: Watermark
	watermarkText: string;

	// Setting 4: Stock vendor
	stockVendors: string[];

	// Setting 5: Music source
	musicSource: MusicSource;
}

const DEFAULT_CONFIG: ConfigState = {
	pace: "fast",
	topic: "",
	musicPrompt: "",
	language: "vi",
	style: "",
	voiceGender: "female",
	voiceId: "default",
	narratorRole: "Người dẫn chương trình",
	addNarrator: false,
	subtitleEnabled: true,
	subtitleFont: "Bebas Neue",
	watermarkText: "PXL-",
	stockVendors: ["iStock", "Envato", "Shutterstock"],
	musicSource: "library",
};

export function ConfigForm({ workflowId, sessionId }: ConfigFormProps) {
	const router = useRouter();
	const [config, setConfig] = useState<ConfigState>(DEFAULT_CONFIG);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		if (!sessionId) {
			setError(
				"Thiếu sessionId. Anh quay lại Workflows view để tạo session mới.",
			);
			return;
		}
		setSubmitting(true);
		try {
			await apiFetch(`/api/quick-create/sessions/${sessionId}/config`, {
				method: "PATCH",
				body: JSON.stringify({
					workflowId,
					configOverrides: config,
				}),
			});
			router.push(
				`/quick-create/workflows/${workflowId}/outline?sessionId=${sessionId}`,
			);
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Network error";
			setError(msg);
			setSubmitting(false);
		}
	};

	const update = <K extends keyof ConfigState>(key: K, value: ConfigState[K]) =>
		setConfig((prev) => ({ ...prev, [key]: value }));

	return (
		<form onSubmit={handleSubmit} className="space-y-8">
			{/* Header */}
			<div className="space-y-1">
				<h1 className="font-bold text-3xl tracking-tight">
					Configure: <span className="text-primary">{workflowId}</span>
				</h1>
				<p className="text-muted-foreground">
					Tùy chỉnh settings cho workflow này. Defaults auto-filled — anh override
					gì cần thay.
				</p>
			</div>

			{/* Universal fields */}
			<div className="space-y-4 rounded-lg border bg-card p-6">
				<h2 className="font-semibold text-lg">Workflow universals</h2>

				<div className="space-y-2">
					<Label htmlFor="pace">Pace (tốc độ cảnh)</Label>
					<Select
						value={config.pace}
						onValueChange={(v: Pace) => update("pace", v)}
					>
						<SelectTrigger id="pace">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="slow">Slow (8s/scene avg)</SelectItem>
							<SelectItem value="medium">Medium (5s/scene avg)</SelectItem>
							<SelectItem value="fast">Fast (3s/scene avg)</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div className="space-y-2">
					<Label htmlFor="topic">Chủ đề (topic)</Label>
					<Textarea
						id="topic"
						value={config.topic}
						onChange={(e) => update("topic", e.target.value)}
						placeholder="Ví dụ: serum chống nắng SPF 50+ cho da dầu mụn"
						className="min-h-[80px]"
						maxLength={500}
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor="musicPrompt">Make the background music (tùy chọn)</Label>
					<Textarea
						id="musicPrompt"
						value={config.musicPrompt}
						onChange={(e) => update("musicPrompt", e.target.value)}
						placeholder="Mood: upbeat pop · Tempo: 120 BPM · Genre: trap-lite"
						className="min-h-[60px]"
					/>
				</div>

				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="language">Language</Label>
						<Select
							value={config.language}
							onValueChange={(v: Language) => update("language", v)}
						>
							<SelectTrigger id="language">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="vi">Tiếng Việt</SelectItem>
								<SelectItem value="en">English</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				<div className="space-y-2">
					<Label htmlFor="style">Style (tone of voice / visual mood)</Label>
					<Textarea
						id="style"
						value={config.style}
						onChange={(e) => update("style", e.target.value)}
						placeholder="Ví dụ: cinematic · trẻ trung · viral hooks"
						className="min-h-[60px]"
					/>
				</div>
			</div>

			{/* Setting 1: Voice */}
			<div className="space-y-4 rounded-lg border bg-card p-6">
				<h2 className="font-semibold text-lg">1. Voice + Narrator</h2>

				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="voiceGender">Gender</Label>
						<RadioGroup
							value={config.voiceGender}
							onValueChange={(v: "male" | "female") => update("voiceGender", v)}
							className="flex gap-4"
						>
							<div className="flex items-center gap-2">
								<RadioGroupItem value="female" id="female" />
								<Label htmlFor="female" className="cursor-pointer">
									Nữ
								</Label>
							</div>
							<div className="flex items-center gap-2">
								<RadioGroupItem value="male" id="male" />
								<Label htmlFor="male" className="cursor-pointer">
									Nam
								</Label>
							</div>
						</RadioGroup>
					</div>

					<div className="space-y-2">
						<Label htmlFor="voiceId">Voice (preview Sprint 2)</Label>
						<Select
							value={config.voiceId}
							onValueChange={(v) => update("voiceId", v)}
						>
							<SelectTrigger id="voiceId">
								<SelectValue placeholder="Chọn voice..." />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="default">Default (workflow tune)</SelectItem>
								<SelectItem value="vn-young-female-pop">
									VN Young Female Pop
								</SelectItem>
								<SelectItem value="vn-senior-male-narrator">
									VN Senior Male Narrator
								</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				<div className="space-y-2">
					<Label htmlFor="narratorRole">Role / persona</Label>
					<Input
						id="narratorRole"
						value={config.narratorRole}
						onChange={(e) => update("narratorRole", e.target.value)}
						placeholder="Người dẫn chương trình / Beauty influencer / etc."
					/>
				</div>

				<button
					type="button"
					className="text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
					onClick={() => update("addNarrator", !config.addNarrator)}
				>
					+ Thêm narrator (multi-voice — Sprint 2)
				</button>
			</div>

			{/* Setting 2: Subtitle */}
			<div className="space-y-4 rounded-lg border bg-card p-6">
				<h2 className="font-semibold text-lg">2. Subtitle preferences</h2>

				<div className="flex items-center gap-2">
					<input
						type="checkbox"
						id="subtitleEnabled"
						checked={config.subtitleEnabled}
						onChange={(e) => update("subtitleEnabled", e.target.checked)}
						className="h-4 w-4"
					/>
					<Label htmlFor="subtitleEnabled" className="cursor-pointer">
						Enable subtitle (recommend ON cho mobile audience)
					</Label>
				</div>

				{config.subtitleEnabled && (
					<div className="space-y-2">
						<Label htmlFor="subtitleFont">Font</Label>
						<Select
							value={config.subtitleFont}
							onValueChange={(v) => update("subtitleFont", v)}
						>
							<SelectTrigger id="subtitleFont">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="Bebas Neue">Bebas Neue (bold)</SelectItem>
								<SelectItem value="Inter">Inter (clean)</SelectItem>
								<SelectItem value="Montserrat">Montserrat (modern)</SelectItem>
								<SelectItem value="Pacifico">Pacifico (decorative)</SelectItem>
								<SelectItem value="Noto Sans VN">Noto Sans VN (Vietnamese)</SelectItem>
							</SelectContent>
						</Select>
					</div>
				)}
			</div>

			{/* Setting 3: Watermark */}
			<div className="space-y-4 rounded-lg border bg-card p-6">
				<h2 className="font-semibold text-lg">3. Watermark</h2>
				<div className="space-y-2">
					<Label htmlFor="watermarkText">Watermark text (Pro+ removable)</Label>
					<Input
						id="watermarkText"
						value={config.watermarkText}
						onChange={(e) => update("watermarkText", e.target.value)}
						maxLength={20}
						placeholder="PXL-12345"
					/>
					<p className="text-muted-foreground text-xs">
						Default: PXL-{"<5-char user ID>"}. Pro+ tier có thể remove watermark.
					</p>
				</div>
			</div>

			{/* Setting 4: Stock vendors */}
			<div className="space-y-4 rounded-lg border bg-card p-6">
				<h2 className="font-semibold text-lg">4. Stock vendor pool</h2>
				<p className="text-muted-foreground text-sm">
					Em ưu tiên search theo thứ tự this list. Admin pool — anh không cần
					configure account riêng.
				</p>
				<div className="grid grid-cols-3 gap-2">
					{["iStock", "Envato", "Shutterstock"].map((vendor) => (
						<label
							key={vendor}
							className="flex items-center gap-2 rounded-md border p-3"
						>
							<input
								type="checkbox"
								checked={config.stockVendors.includes(vendor)}
								onChange={(e) =>
									update(
										"stockVendors",
										e.target.checked
											? [...config.stockVendors, vendor]
											: config.stockVendors.filter((v) => v !== vendor),
									)
								}
								className="h-4 w-4"
							/>
							<span className="text-sm">{vendor}</span>
						</label>
					))}
				</div>
			</div>

			{/* Setting 5: Music source */}
			<div className="space-y-4 rounded-lg border bg-card p-6">
				<h2 className="font-semibold text-lg">5. Music source</h2>
				<RadioGroup
					value={config.musicSource}
					onValueChange={(v: MusicSource) => update("musicSource", v)}
					className="space-y-2"
				>
					<div className="flex items-start gap-2 rounded-md border p-3">
						<RadioGroupItem value="library" id="lib" className="mt-1" />
						<div>
							<Label htmlFor="lib" className="cursor-pointer font-medium">
								Library (FREE)
							</Label>
							<p className="text-muted-foreground text-xs">
								FB Sound Collection · TikTok Creative Center · YouTube Audio Library
							</p>
						</div>
					</div>
					<div className="flex items-start gap-2 rounded-md border p-3">
						<RadioGroupItem value="uploaded" id="up" className="mt-1" />
						<div>
							<Label htmlFor="up" className="cursor-pointer font-medium">
								Uploaded (Pro+ tier)
							</Label>
							<p className="text-muted-foreground text-xs">
								Anh upload track riêng (responsibility for license)
							</p>
						</div>
					</div>
				</RadioGroup>
			</div>

			{/* CTA */}
			{error && (
				<div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					<AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
					<span>{error}</span>
				</div>
			)}
			<div className="flex justify-end gap-2">
				<Button
					type="button"
					variant="outline"
					onClick={() => router.back()}
					disabled={submitting}
				>
					Quay lại
				</Button>
				<Button type="submit" disabled={submitting || !sessionId} className="px-8">
					{submitting ? "Đang lưu config..." : "Generate Outline →"}
				</Button>
			</div>
		</form>
	);
}
