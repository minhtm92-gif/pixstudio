"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEditor } from "@/editor/use-editor";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/ui";

const toneClassName = {
	info: "bg-accent text-muted-foreground",
	warning: "bg-caution/10 text-caution",
	error: "bg-destructive/10 text-destructive",
} as const;

export function EditorNoticeBar() {
	const editor = useEditor();
	const notices = useEditor((e) => e.notices.getNotices());

	if (notices.length === 0) {
		return null;
	}

	return (
		<div className="flex flex-col">
			{notices.map((notice) => (
				<div
					key={notice.id}
					className={cn(
						"border-b h-9 flex items-center justify-center gap-2 px-3 text-xs",
						toneClassName[notice.tone],
					)}
				>
					<span>{notice.message}</span>
					{notice.dismissible ? (
						<Button
							variant="text"
							size="icon"
							className="p-0 w-auto [&_svg]:size-3.5"
							onClick={() => editor.notices.dismiss({ id: notice.id })}
							aria-label="Dismiss"
						>
							<HugeiconsIcon icon={Cancel01Icon} />
						</Button>
					) : null}
				</div>
			))}
		</div>
	);
}
