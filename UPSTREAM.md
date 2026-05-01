# Upstream — OpenCut Sync Workflow

PixStudio = soft-fork of [`OpenCut-app/OpenCut`](https://github.com/OpenCut-app/OpenCut) MIT.

> **Default verb:** *extend*. Don't rewrite OpenCut core (compositor, timeline, keyframe). Build wedge in `packages/ai-services` + `packages/collab` + `packages/brand`. Contribute non-conflicting fixes upstream.

## 1. Pinned commit

PixStudio pins to OpenCut commit:

```
PINNED_COMMIT=<TBD-Day-1-after-fork>
PINNED_VERSION=<vX.Y.Z>
PINNED_DATE=2026-05-14
```

> Update this section every rebase — record commit hash + date + reason.

## 2. Rebase cadence

| Cadence | Action |
|---------|--------|
| **Phase 0-1 (5/14-6/30)** | **Pin only** — no rebase. Avoid mid-MVP churn |
| **Phase 2-3 (7/1-10/12)** | **Weekly Friday** — rebase to `main` HEAD; resolve conflict; smoke test 30min |
| **Phase 4+ (10/13+)** | **Bi-weekly** — slower cadence post-launch hardening |
| **Adhoc** | Critical security/CVE patches — apply ngay regardless of cadence |

## 3. Rebase workflow

```bash
# Setup remote upstream (1-time)
git remote add upstream https://github.com/OpenCut-app/OpenCut.git

# Weekly rebase
git fetch upstream
git checkout main
git rebase upstream/main         # resolve conflicts manually nếu có
bun install                       # re-resolve deps if package.json changed
bun typecheck && bun test         # ensure smoke pass
git push origin main --force-with-lease

# Update UPSTREAM.md PINNED_COMMIT + DATE + reason
git add UPSTREAM.md && git commit -m "chore(upstream): rebase to <commit-short> $(date +%Y-%m-%d)"
git push origin main
```

## 4. Conflict resolution priority

Khi rebase conflict:

| Conflict trong | Strategy |
|----------------|----------|
| `apps/web/` UI components | Prefer **OpenCut upstream** version, re-apply PixStudio branding diff in same commit |
| `apps/web/src/styles/` Stitches tokens | **PixStudio override** — anh's brand tokens (PXL blue gradient + Inter+Lora) wins |
| `packages/compositor/` Rust core | Prefer **OpenCut upstream** — don't touch core |
| `packages/ai-services/` | **PixStudio only** — no upstream conflict possible (added directory) |
| `packages/collab/` | **PixStudio only** — no upstream conflict possible |
| `packages/brand/` | **PixStudio only** — no upstream conflict possible |
| `apps/desktop/` (GPUI) | Prefer **OpenCut upstream** — desktop core kế thừa |
| `package.json` deps | Merge — prefer upstream versions, add PixStudio-only deps |
| `bun.lockb` | Regen: `rm bun.lockb && bun install` |
| `apps/web/src/app/api/` | Merge case-by-case — PixStudio adds `/api/ai/*`, `/api/admin/*`, `/api/auth/desktop-*` (won't conflict if upstream adds different paths) |

## 5. Contribute back

Khi em find + fix bug trong OpenCut core (compositor, timeline, keyframe), open PR upstream:

1. Branch off **upstream main** (not PixStudio fork)
2. Apply fix only — no PixStudio branding/code mixed
3. Open PR `OpenCut-app/OpenCut`, link issue if exists
4. Merge upstream → next PixStudio rebase auto-pulls fix
5. Goodwill: Maze Winther + community appreciate, less drift over time

## 6. Forking philosophy (don't deviate)

**DO:**
- Add new directories (`packages/ai-services`, `packages/brand`, etc.)
- Override styles via Stitches token (single file override)
- Wrap OpenCut UI components with PixStudio variants (e.g., `PixStudioPreview` wraps `OpenCutPreview`)
- Add new API routes under `apps/web/src/app/api/{ai,admin,workspace}` — non-conflicting paths

**DON'T:**
- Modify `packages/compositor/` Rust core (rebase nightmare)
- Rewrite OpenCut timeline / keyframe (engine = upstream's domain)
- Diverge `package.json` runtime — keep Bun + Next.js 16 + React 19 versions matching upstream

## 7. Drift check

Monthly check `git log upstream/main --since="30 days ago" --oneline | wc -l`:
- < 50 commits → drift OK
- 50-150 → schedule rebase week
- > 150 → escalate (upstream may be refactoring; em surface to anh)

## 8. Emergency

Nếu OpenCut upstream dies (single-maintainer risk per CTO-TECH-STACK §1.1):
- Last-known-good commit pinned ở §1
- PixStudio continues independently — accept maintainership burden
- Or: switch fallback Tauri 2.0 cho desktop (per §1.8)

---

**Status:** Scaffold pre-Day 1. Anh paste vào `minhtm92-gif/pixstudio` repo sau fork; em update §1 PINNED_COMMIT khi anh fork.
