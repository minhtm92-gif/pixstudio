"use client";

import { Button } from "../ui/button";
import { useRef, useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import Link from "next/link";
import { RenameProjectDialog } from "@/project/components/rename-project-dialog";
import { DeleteProjectDialog } from "@/project/components/delete-project-dialog";
import { useRouter } from "next/navigation";
import { FaDiscord } from "react-icons/fa6";
import { ExportButton } from "./export-button";
import { FeedbackPopover } from "@/feedback/components/feedback-popover";
import { ThemeToggle } from "../theme-toggle";
import { DEFAULT_LOGO_URL } from "@/site/brand";
import { SOCIAL_LINKS } from "@/site/social";
import { toast } from "sonner";
import { useEditor } from "@/editor/use-editor";
import { CommandIcon, Logout05Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ShortcutsDialog } from "@/actions/components/shortcuts-dialog";
import { invokeAction } from "@/actions";
import Image from "next/image";
import { cn } from "@/utils/ui";
import {
	Sparkles,
	Undo2,
	Redo2,
	Save,
	Scissors,
	Wand2,
	ImageOff,
	Maximize2,
} from "lucide-react";

export function EditorHeader() {
	return (
		<header className="bg-background flex h-[3.4rem] items-center justify-between gap-3 px-3 pt-0.5">
			<div className="flex items-center gap-1 shrink-0">
				<ProjectDropdown />
				<EditableProjectName />
			</div>
			<ToolbarRow />
			<nav className="flex items-center gap-2 shrink-0">
				<FeedbackPopover />
				<ExportButton />
				<ThemeToggle />
			</nav>
		</header>
	);
}

/**
 * SCOPE §3.1 top toolbar:
 * [Save] [Undo] [Redo] | [Cut] [Trim] [Speed] [Mask]
 *   | [Caption AI] [BG remove] [Upscale 4K]
 *   | [✨ AI Generate ▾] | [Comments] [Versions ▾]
 *   | [Presence avatars]
 */
function ToolbarRow() {
	const editor = useEditor();
	const router = useRouter();

	const handleSave = async () => {
		try {
			await editor.project.saveCurrentProject();
			toast.success("Saved");
		} catch (err) {
			toast.error("Save failed", {
				description: err instanceof Error ? err.message : "Try again",
			});
		}
	};

	const handleUndo = () => editor.command.undo();
	const handleRedo = () => editor.command.redo();
	const handleSplit = () => invokeAction("split", undefined, "mouseclick");

	return (
		<div className="flex flex-1 items-center justify-center gap-1 overflow-x-auto">
			{/* History group */}
			<ToolbarBtn label="Save" icon={Save} onClick={() => void handleSave()} />
			<ToolbarBtn label="Undo (Ctrl+Z)" icon={Undo2} onClick={handleUndo} />
			<ToolbarBtn label="Redo (Ctrl+Shift+Z)" icon={Redo2} onClick={handleRedo} />

			<Divider />

			{/* Edit tools group */}
			<ToolbarBtn label="Split (S)" icon={Scissors} onClick={handleSplit} />

			<Divider />

			{/* AI tools group */}
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						className="h-8 gap-1.5 px-2 text-xs font-medium text-foreground/80 hover:text-foreground"
					>
						<Wand2 className="h-3.5 w-3.5 text-primary" />
						<span>AI tools</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="center" className="z-100 w-52">
					<DropdownMenuItem
						onClick={() => toast.info("Caption AI · ElevenLabs Scribe — Phase 2 (PW-14)")}
						icon={<Sparkles className="h-4 w-4" />}
					>
						Caption AI
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={() => toast.info("BG remove · SAM 2 — Phase 2 (PW-23)")}
						icon={<ImageOff className="h-4 w-4" />}
					>
						BG remove
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={() => toast.info("Upscale 4K · Real-ESRGAN — Phase 2 Max (PW-22)")}
						icon={<Maximize2 className="h-4 w-4" />}
					>
						Upscale 4K
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						className="h-8 gap-1.5 px-2 text-xs font-medium text-foreground/80 hover:text-foreground"
					>
						<Sparkles className="h-3.5 w-3.5 text-primary" />
						<span>AI Generate</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="center" className="z-100 w-52">
					<DropdownMenuItem onClick={() => router.push("/quick-create/workflows")}>
						Quick Create wizard
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={() => toast.info("Image gen · Nano Banana — Phase 2")}
					>
						Image (Nano Banana)
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={() => toast.info("Video gen · Seedance 2.0 — Phase 2 Pro")}
					>
						Video (Seedance 2.0)
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={() => toast.info("Voice gen · ElevenLabs — Phase 2 Pro")}
					>
						Voice (ElevenLabs)
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

function ToolbarBtn({
	label,
	icon: Icon,
	onClick,
}: {
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	onClick: () => void;
}) {
	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={onClick}
			className="h-8 w-8 text-muted-foreground hover:text-foreground"
			aria-label={label}
			title={label}
		>
			<Icon className="h-4 w-4" />
		</Button>
	);
}

function Divider() {
	return <div className="mx-1 h-5 w-px bg-border" />;
}

function ProjectDropdown() {
	const [openDialog, setOpenDialog] = useState<
		"delete" | "rename" | "shortcuts" | null
	>(null);
	const [isExiting, setIsExiting] = useState(false);
	const router = useRouter();
	const editor = useEditor();
	const activeProject = useEditor((e) => e.project.getActive());

	const handleExit = async () => {
		if (isExiting) return;
		setIsExiting(true);

		try {
			await editor.project.prepareExit();
			editor.project.closeProject();
		} catch (error) {
			console.error("Failed to prepare project exit:", error);
		} finally {
			editor.project.closeProject();
			router.push("/projects");
		}
	};

	const handleSaveProjectName = async (newName: string) => {
		if (
			activeProject &&
			newName.trim() &&
			newName !== activeProject.metadata.name
		) {
			try {
				await editor.project.renameProject({
					id: activeProject.metadata.id,
					name: newName.trim(),
				});
			} catch (error) {
				toast.error("Failed to rename project", {
					description:
						error instanceof Error ? error.message : "Please try again",
				});
			} finally {
				setOpenDialog(null);
			}
		}
	};

	const handleDeleteProject = async () => {
		if (activeProject) {
			try {
				await editor.project.deleteProjects({
					ids: [activeProject.metadata.id],
				});
				router.push("/projects");
			} catch (error) {
				toast.error("Failed to delete project", {
					description:
						error instanceof Error ? error.message : "Please try again",
				});
			} finally {
				setOpenDialog(null);
			}
		}
	};

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="icon" className="p-1 rounded-sm size-8">
						<Image
							src={DEFAULT_LOGO_URL}
							alt="Project thumbnail"
							width={32}
							height={32}
							className="invert dark:invert-0 size-5"
						/>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="z-100 w-44">
					<DropdownMenuItem
						onClick={handleExit}
						disabled={isExiting}
						icon={<HugeiconsIcon icon={Logout05Icon} />}
					>
						Exit project
					</DropdownMenuItem>

					<DropdownMenuItem
						onClick={() => setOpenDialog("shortcuts")}
						icon={<HugeiconsIcon icon={CommandIcon} />}
					>
						Shortcuts
					</DropdownMenuItem>

					<DropdownMenuSeparator />

					<DropdownMenuItem asChild icon={<FaDiscord className="size-4!" />}>
						<Link
							href={SOCIAL_LINKS.discord}
							target="_blank"
							rel="noopener noreferrer"
						>
							Discord
						</Link>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<RenameProjectDialog
				isOpen={openDialog === "rename"}
				onOpenChange={(isOpen) => setOpenDialog(isOpen ? "rename" : null)}
				onConfirm={(newName) => handleSaveProjectName(newName)}
				projectName={activeProject?.metadata.name || ""}
			/>
			<DeleteProjectDialog
				isOpen={openDialog === "delete"}
				onOpenChange={(isOpen) => setOpenDialog(isOpen ? "delete" : null)}
				onConfirm={handleDeleteProject}
				projectNames={[activeProject?.metadata.name || ""]}
			/>
			<ShortcutsDialog
				isOpen={openDialog === "shortcuts"}
				onOpenChange={(isOpen) => setOpenDialog(isOpen ? "shortcuts" : null)}
			/>
		</>
	);
}

function EditableProjectName() {
	const editor = useEditor();
	const activeProject = useEditor((e) => e.project.getActive());
	const [isEditing, setIsEditing] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const originalNameRef = useRef("");

	const projectName = activeProject?.metadata.name || "";

	const startEditing = () => {
		if (isEditing) return;
		originalNameRef.current = projectName;
		setIsEditing(true);

		requestAnimationFrame(() => {
			inputRef.current?.select();
		});
	};

	const saveEdit = async () => {
		if (!inputRef.current || !activeProject) return;
		const newName = inputRef.current.value.trim();
		setIsEditing(false);

		if (!newName) {
			inputRef.current.value = originalNameRef.current;
			return;
		}

		if (newName !== originalNameRef.current) {
			try {
				await editor.project.renameProject({
					id: activeProject.metadata.id,
					name: newName,
				});
			} catch (error) {
				toast.error("Failed to rename project", {
					description:
						error instanceof Error ? error.message : "Please try again",
				});
			}
		}
	};

	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "Enter") {
			event.preventDefault();
			inputRef.current?.blur();
		} else if (event.key === "Escape") {
			event.preventDefault();
			if (inputRef.current) {
				inputRef.current.value = originalNameRef.current;
				inputRef.current.setSelectionRange(0, 0);
			}
			setIsEditing(false);
			inputRef.current?.blur();
		}
	};

	return (
		<input
			ref={inputRef}
			type="text"
			defaultValue={projectName}
			readOnly={!isEditing}
			onClick={startEditing}
			onBlur={saveEdit}
			onKeyDown={handleKeyDown}
			style={{ fieldSizing: "content" }}
			className={cn(
				"text-[0.9rem] h-8 px-2 py-1 rounded-sm bg-transparent outline-none cursor-pointer hover:bg-accent hover:text-accent-foreground",
				isEditing && "ring-1 ring-ring cursor-text hover:bg-transparent",
			)}
		/>
	);
}
