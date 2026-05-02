"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X, Lightbulb, Bell, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BuildProgressProps {
	workflowId: string;
	sessionId: string;
}

interface Stage {
	id: string;
	label: string;
	weight: number; // % contribution to total
	status: "pending" | "running" | "done" | "failed";
}

const STAGES: Omit<Stage, "status">[] = [
	{ id: "generating-script", label: "Generating script", weight: 10 },
	{ id: "synthesizing-voice", label: "Synthesizing voice (ElevenLabs)", weight: 25 },
	{ id: "matching-stock", label: "Matching stock media", weight: 20 },
	{ id: "composing-scenes", label: "Composing scenes", weight: 20 },
	{ id: "rendering-preview", label: "Rendering preview", weight: 25 },
];

const TIPS = [
	"💡 Anh có thể edit script + media trong Editor view sau khi build xong",
	"💡 Voice gen incremental — change 1 scene chỉ regen scene đó (save quota)",
	"💡 Click 'Notify when ready' để nhận email khi build complete",
	"💡 Stock library auto-credit license per asset, anh không phải manual",
];

export function BuildProgress({ workflowId, sessionId }: BuildProgressProps) {
	const router = useRouter();
	const [stages, setStages] = useState<Stage[]>(
		STAGES.map((s) => ({ ...s, status: "pending" as const })),
	);
	const [progress, setProgress] = useState(0);
	const [elapsed, setElapsed] = useState(0);
	const [notify, setNotify] = useState(false);
	const [tipIdx, setTipIdx] = useState(0);
	const [done, setDone] = useState(false);
	const [errored, setErrored] = useState(false);

	useEffect(() => {
		// TODO Sprint 2.5: connect WebSocket /api/quick-create/sessions/:id/build/stream
		// For now: simulate stages every 1.5s
		let cumProgress = 0;
		let stageIdx = 0;
		const interval = setInterval(() => {
			if (stageIdx >= STAGES.length) {
				clearInterval(interval);
				setDone(true);
				return;
			}
			const stage = STAGES[stageIdx];
			if (!stage) return;
			cumProgress += stage.weight;
			setStages((prev) =>
				prev.map((s, i) => {
					if (i < stageIdx) return { ...s, status: "done" };
					if (i === stageIdx) return { ...s, status: "done" };
					if (i === stageIdx + 1) return { ...s, status: "running" };
					return s;
				}),
			);
			setProgress(Math.min(100, cumProgress));
			stageIdx++;
		}, 1500);

		// Initialize first stage as running
		setStages((prev) => prev.map((s, i) => (i === 0 ? { ...s, status: "running" } : s)));

		const elapsedTimer = setInterval(() => setElapsed((e) => e + 1), 1000);
		const tipTimer = setInterval(() => setTipIdx((t) => (t + 1) % TIPS.length), 5000);

		return () => {
			clearInterval(interval);
			clearInterval(elapsedTimer);
			clearInterval(tipTimer);
		};
	}, [sessionId]);

	useEffect(() => {
		if (done) {
			// Auto-redirect to editor after 1s
			const t = setTimeout(() => {
				router.push(`/editor/${sessionId}`);
			}, 1500);
			return () => clearTimeout(t);
		}
	}, [done, router, sessionId]);

	const currentStage = stages.find((s) => s.status === "running");
	const totalWeight = STAGES.reduce((s, st) => s + st.weight, 0);
	const eta = currentStage
		? Math.round(((totalWeight - progress) / totalWeight) * 30) // rough 30s total
		: 0;

	const handleCancel = () => {
		// TODO Sprint 2.5: DELETE /api/quick-create/sessions/:id/build (only allowed pre-stage 3)
		router.push(`/quick-create/workflows/${workflowId}/outline?sessionId=${sessionId}`);
	};

	return (
		<div className="space-y-6 rounded-xl border bg-card p-8 shadow-sm">
			{/* Top icons row 5 (per SCOPE.md §13) */}
			<div className="flex items-center justify-between border-b pb-4">
				<button
					type="button"
					onClick={handleCancel}
					className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
					title="Cancel build"
					disabled={done}
				>
					<X className="h-5 w-5" />
				</button>
				<div className="flex items-center gap-1 text-emerald-500">
					<Check className="h-5 w-5" />
					<span className="font-medium text-sm">
						{done ? "Complete" : currentStage ? "Running" : "Queued"}
					</span>
				</div>
				<div className="flex items-center gap-2 text-muted-foreground text-sm">
					<Lightbulb className="h-4 w-4" />
					<span className="hidden md:inline">{TIPS[tipIdx]}</span>
				</div>
				<button
					type="button"
					className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
					title="More options"
				>
					<MoreVertical className="h-5 w-5" />
				</button>
			</div>

			{/* Spinner + status */}
			<div className="space-y-3 text-center">
				{!done && !errored && (
					<Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
				)}
				{done && (
					<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
						<Check className="h-6 w-6" />
					</div>
				)}
				<h2 className="font-semibold text-xl">
					{done
						? "✅ Build complete — opening editor..."
						: errored
							? "❌ Build failed"
							: `Building your video...`}
				</h2>
				{!done && (
					<p className="text-muted-foreground text-sm">
						{currentStage?.label ?? "Queued"} · ETA ~{eta}s · elapsed {elapsed}s
					</p>
				)}
			</div>

			{/* Progress bar */}
			<div className="space-y-1">
				<div className="h-2 overflow-hidden rounded-full bg-muted">
					<div
						className="h-full bg-primary transition-all duration-500 ease-out"
						style={{ width: `${progress}%` }}
					/>
				</div>
				<p className="text-right text-muted-foreground text-xs">{progress}%</p>
			</div>

			{/* Stage list */}
			<div className="space-y-2">
				{stages.map((stage) => (
					<div
						key={stage.id}
						className={`flex items-center gap-3 rounded-md border p-3 ${
							stage.status === "running"
								? "border-primary bg-primary/5"
								: "bg-card"
						}`}
					>
						<div className="flex h-6 w-6 flex-shrink-0 items-center justify-center">
							{stage.status === "done" && (
								<Check className="h-5 w-5 text-emerald-500" />
							)}
							{stage.status === "running" && (
								<Loader2 className="h-4 w-4 animate-spin text-primary" />
							)}
							{stage.status === "pending" && (
								<div className="h-2 w-2 rounded-full bg-muted" />
							)}
							{stage.status === "failed" && <X className="h-5 w-5 text-destructive" />}
						</div>
						<span
							className={`flex-1 text-sm ${
								stage.status === "pending" ? "text-muted-foreground" : "font-medium"
							}`}
						>
							{stage.label}
						</span>
						<span className="text-muted-foreground text-xs">{stage.weight}%</span>
					</div>
				))}
			</div>

			{/* Notify checkbox */}
			<label className="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					checked={notify}
					onChange={(e) => setNotify(e.target.checked)}
					className="h-4 w-4"
					disabled={done}
				/>
				<Bell className="h-4 w-4" />
				Notify khi ready (push notification + email)
			</label>

			{!done && (
				<div className="flex justify-center">
					<Button type="button" variant="ghost" onClick={handleCancel}>
						Cancel build
					</Button>
				</div>
			)}

			<p className="text-center text-muted-foreground text-xs">
				Sprint 2 mock pipeline · Real WebSocket subscribe + BullMQ workers Sprint 2.5
			</p>
		</div>
	);
}
