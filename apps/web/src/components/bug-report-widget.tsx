/**
 * BugReportWidget — Sprint 8 floating bug report button + modal.
 *
 * Per Q57: Editor team submits bugs in-app during internal alpha.
 * Captures page URL + user agent automatically.
 *
 * Mount in root layout (apps/web/src/app/layout.tsx).
 */

"use client";

import { useRef, useState } from "react";
import { Bug, X, AlertTriangle, AlertCircle, Info, CheckCircle2, ImagePlus } from "lucide-react";
import { useBugReport, type BugSeverity } from "../hooks/use-bug-report";

const SEVERITY_OPTIONS: Array<{
	value: BugSeverity;
	label: string;
	description: string;
	icon: React.ReactNode;
	color: string;
}> = [
	{
		value: "P0",
		label: "P0 Critical",
		description: "Crash / data loss / security",
		icon: <AlertTriangle className="h-4 w-4" />,
		color: "text-red-600 border-red-200 bg-red-50",
	},
	{
		value: "P1",
		label: "P1 Major",
		description: "Major feature broken",
		icon: <AlertCircle className="h-4 w-4" />,
		color: "text-orange-600 border-orange-200 bg-orange-50",
	},
	{
		value: "P2",
		label: "P2 Minor",
		description: "Minor UX issue",
		icon: <Info className="h-4 w-4" />,
		color: "text-blue-600 border-blue-200 bg-blue-50",
	},
	{
		value: "P3",
		label: "P3 Polish",
		description: "Nice-to-have polish",
		icon: <Info className="h-4 w-4" />,
		color: "text-gray-600 border-gray-200 bg-gray-50",
	},
];

export function BugReportWidget() {
	const [open, setOpen] = useState(false);
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [severity, setSeverity] = useState<BugSeverity>("P2");
	const [screenshot, setScreenshot] = useState<File | null>(null);
	const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const { submit, reset, state, error, bugId } = useBugReport();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!title.trim() || !description.trim()) return;
		await submit({
			title: title.trim(),
			description: description.trim(),
			severity,
			...(screenshot ? { screenshot } : {}),
		});
	};

	const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		if (file.size > 2 * 1024 * 1024) {
			alert("Screenshot quá lớn (max 2MB)");
			return;
		}
		setScreenshot(file);
		const reader = new FileReader();
		reader.onload = (ev) => setScreenshotPreview(ev.target?.result as string);
		reader.readAsDataURL(file);
	};

	const removeScreenshot = () => {
		setScreenshot(null);
		setScreenshotPreview(null);
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	const close = () => {
		setOpen(false);
		setTimeout(() => {
			setTitle("");
			setDescription("");
			setSeverity("P2");
			removeScreenshot();
			reset();
		}, 300);
	};

	if (!open) {
		return (
			<button
				onClick={() => setOpen(true)}
				className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg transition-transform hover:scale-110 hover:bg-orange-600"
				aria-label="Report a bug"
				title="Report a bug"
			>
				<Bug className="h-5 w-5" />
			</button>
		);
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div className="w-full max-w-lg overflow-hidden rounded-lg bg-card shadow-2xl">
				{/* Header */}
				<div className="flex items-center justify-between border-b bg-orange-50 px-6 py-4">
					<div className="flex items-center gap-2">
						<Bug className="h-5 w-5 text-orange-600" />
						<h2 className="text-base font-semibold">Report a bug</h2>
					</div>
					<button onClick={close} className="rounded-md p-1 hover:bg-muted">
						<X className="h-5 w-5" />
					</button>
				</div>

				{state === "success" ? (
					<div className="px-6 py-8 text-center">
						<CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-600" />
						<h3 className="text-lg font-semibold">Bug reported, cảm ơn anh!</h3>
						<p className="mt-2 text-sm text-muted-foreground">
							Bug ID: {bugId?.slice(0, 8)}
						</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Em sẽ triage trong dashboard.
						</p>
						<button
							onClick={close}
							className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
						>
							Close
						</button>
					</div>
				) : (
					<form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
						{/* Severity */}
						<div>
							<label className="mb-2 block text-xs font-medium uppercase text-muted-foreground">
								Severity
							</label>
							<div className="grid grid-cols-2 gap-2">
								{SEVERITY_OPTIONS.map((opt) => (
									<button
										key={opt.value}
										type="button"
										onClick={() => setSeverity(opt.value)}
										className={`flex items-start gap-2 rounded-md border px-3 py-2 text-left text-xs transition-colors ${
											severity === opt.value
												? opt.color
												: "border-border bg-muted/50 hover:bg-muted"
										}`}
									>
										{opt.icon}
										<div>
											<div className="font-medium">{opt.label}</div>
											<div className="text-[10px] text-muted-foreground">
												{opt.description}
											</div>
										</div>
									</button>
								))}
							</div>
						</div>

						{/* Title */}
						<div>
							<label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">
								Title*
							</label>
							<input
								type="text"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="Brief one-line description"
								className="w-full rounded-md border bg-background px-3 py-2 text-sm"
								maxLength={200}
								required
							/>
						</div>

						{/* Description */}
						<div>
							<label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">
								What happened?*
							</label>
							<textarea
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="Steps to reproduce, expected vs actual behavior..."
								className="w-full rounded-md border bg-background px-3 py-2 text-sm"
								rows={5}
								maxLength={5000}
								required
							/>
							<div className="mt-1 text-[10px] text-muted-foreground">
								{description.length} / 5000 chars
							</div>
						</div>

						{/* Screenshot upload */}
						<div>
							<label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">
								Screenshot (optional, max 2MB)
							</label>
							{screenshotPreview ? (
								<div className="relative inline-block">
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img
										src={screenshotPreview}
										alt="Screenshot preview"
										className="max-h-32 rounded-md border"
									/>
									<button
										type="button"
										onClick={removeScreenshot}
										className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
										aria-label="Remove screenshot"
									>
										<X className="h-3 w-3" />
									</button>
								</div>
							) : (
								<button
									type="button"
									onClick={() => fileInputRef.current?.click()}
									className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50"
								>
									<ImagePlus className="h-4 w-4" />
									Add screenshot
								</button>
							)}
							<input
								ref={fileInputRef}
								type="file"
								accept="image/png,image/jpeg,image/webp"
								onChange={handleScreenshotChange}
								className="hidden"
							/>
						</div>

						{/* Auto-captured info */}
						<div className="rounded-md bg-muted/30 px-3 py-2 text-[10px] text-muted-foreground">
							<div>📍 Auto-captured: page URL + user agent</div>
							{typeof window !== "undefined" && (
								<div className="mt-0.5 truncate font-mono">
									{window.location.pathname}
								</div>
							)}
						</div>

						{state === "error" && error && (
							<div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
								{error}
							</div>
						)}

						{/* Actions */}
						<div className="flex justify-end gap-2 border-t pt-3">
							<button
								type="button"
								onClick={close}
								className="rounded-md px-4 py-2 text-sm hover:bg-muted"
							>
								Cancel
							</button>
							<button
								type="submit"
								disabled={state === "submitting" || !title.trim() || !description.trim()}
								className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
							>
								{state === "submitting" ? "Submitting..." : "Submit bug"}
							</button>
						</div>
					</form>
				)}
			</div>
		</div>
	);
}
