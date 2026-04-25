export type EditorNoticeTone = "info" | "warning" | "error";

export type EditorNoticeInput = {
	id: string;
	tone: EditorNoticeTone;
	message: string;
	dismissible?: boolean;
};

export type EditorNotice = EditorNoticeInput & {
	scope: string;
};

export class EditorNoticesManager {
	private noticesByScope = new Map<string, EditorNotice[]>();
	private dismissedIds = new Set<string>();
	private listeners = new Set<() => void>();
	private cachedNotices: EditorNotice[] = [];
	private cacheValid = false;

	setScopeNotices({
		scope,
		notices,
	}: {
		scope: string;
		notices: EditorNoticeInput[];
	}): void {
		const nextNotices = notices.map((notice) => ({
			...notice,
			id: `${scope}:${notice.id}`,
			scope,
		}));
		const previousNotices = this.noticesByScope.get(scope) ?? [];
		if (areNoticeListsEqual(previousNotices, nextNotices)) {
			return;
		}
		if (nextNotices.length === 0) {
			this.noticesByScope.delete(scope);
		} else {
			this.noticesByScope.set(scope, nextNotices);
		}
		this.pruneStaleDismissals();
		this.invalidateCache();
		this.notify();
	}

	clearScope(scope: string): void {
		if (!this.noticesByScope.has(scope)) {
			return;
		}
		this.noticesByScope.delete(scope);
		this.pruneStaleDismissals();
		this.invalidateCache();
		this.notify();
	}

	dismiss({ id }: { id: string }): void {
		if (this.dismissedIds.has(id)) {
			return;
		}
		this.dismissedIds.add(id);
		this.invalidateCache();
		this.notify();
	}

	getNotices(): EditorNotice[] {
		if (!this.cacheValid) {
			this.cachedNotices = [...this.noticesByScope.values()]
				.flat()
				.filter((notice) => !this.dismissedIds.has(notice.id));
			this.cacheValid = true;
		}
		return this.cachedNotices;
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private invalidateCache(): void {
		this.cacheValid = false;
	}

	private pruneStaleDismissals(): void {
		if (this.dismissedIds.size === 0) {
			return;
		}
		const liveIds = new Set<string>();
		for (const notices of this.noticesByScope.values()) {
			for (const notice of notices) {
				liveIds.add(notice.id);
			}
		}
		for (const id of this.dismissedIds) {
			if (!liveIds.has(id)) {
				this.dismissedIds.delete(id);
			}
		}
	}

	private notify(): void {
		this.listeners.forEach((listener) => {
			listener();
		});
	}
}

function areNoticeListsEqual(
	left: EditorNotice[],
	right: EditorNotice[],
): boolean {
	if (left.length !== right.length) {
		return false;
	}
	return left.every((notice, index) => {
		const other = right[index];
		return (
			notice.id === other?.id &&
			notice.scope === other.scope &&
			notice.tone === other.tone &&
			notice.message === other.message &&
			notice.dismissible === other.dismissible
		);
	});
}
