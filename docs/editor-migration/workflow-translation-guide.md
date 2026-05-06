# Workflow Translation Guide — CapCut → PixStudio

> **Audience:** Pixel editor team (anh Tùng + 4 marketers). 1-page reference for "I used to do X in CapCut — how do I do it in PixStudio?"
>
> Pair with `docs/editor-migration-playbook.md` for the bigger 4-week migration plan.

---

## TL;DR — common 80%

| You used to… (CapCut) | In PixStudio | Time saved |
|---|---|---|
| Export to TikTok 9:16 | Export popover → "TikTok 9:16" preset chip | ~3 clicks → 1 |
| Re-cut for IG Reel | Re-export via Multi-aspect repurpose endpoint | 6× → 1 click |
| Auto-caption Vietnamese | Caption AI toolbar (ElevenLabs Scribe) | parity, better VN tone |
| Remove background | BG remove dropdown (SAM 2 server) | parity |
| Trim silence | Smart trim (transcript-driven) | 4 manual cuts → 1 click |
| Save `.draft` to Drive | Cloud auto-save (every 30s) | no manual save |
| Share `.draft` with teammate | Invite by email — collab live (Phase 3 Yjs) | async → realtime |
| Beat sync music | Drop music → "Beat sync" button | parity |
| Find stock footage | Asset Studio → Stock tab (admin pool) | per-account scrambling → 1 search |

---

## File / project handling

### "Mở .draft file đã lưu trên Drive"
PixStudio không có file `.draft`. Project tự động save lên cloud mỗi 30 giây (không cần `Ctrl+S`). Mở lại từ **Projects list** trên dashboard.

**Đặc biệt:** nếu cần share project ngoài team (đối tác external editor), dùng "Export project package" → ZIP với JSON + assets, đối tác import vào PixStudio của họ.

### "Tạo project mới"
- **Quick path (15 giây script):** Quick Create wizard (Hero → Workflow → Build) → tự động generate đầy đủ cảnh + voice + nhạc.
- **Full editor:** New project → Pro Workspace (giống CapCut Editor).

### "Backup project"
Tự động — Postgres backup nightly. Anh có thể tải xuống bản sao gần nhất từ Settings → Backups (admin only).

---

## Edit timeline

### Cut clip
- **Phím tắt:** `Ctrl+B` (giống CapCut). Mới: `S` cũng được.
- **Razor tool:** click đầu/cuối clip, drag handle.

### Trim trống / im lặng
- CapCut: thủ công cut từng đoạn.
- PixStudio: **Smart Trim** → đọc transcript → tự cắt đoạn `>0.5s` không có voice. 1 click cho cả timeline.

### Speed change
- Right-click clip → "Speed" (giống CapCut). Range 0.5×-4× (Standard) / 0.25×-8× (Pro/Max).
- Ramp speed (variable speed): kéo handle keyframe trên speed track.

### Keyframe
- Add keyframe: `K` shortcut. CapCut dùng diamond icon — em có cùng UI.
- Bezier easing: right-click keyframe → "Easing" → pick curve.

### Transition
- Drag transition từ Asset → Transitions tab vào ranh giới 2 clip.
- **Mới:** Kling AI transition (Max tier) — generative cinematic transition giữa 2 cảnh.

---

## AI / automation tools

### Caption tự động (Vietnamese)
1. Click **Caption AI** trên toolbar (Wand icon).
2. Pick preset từ 8 VN-tuned styles: TikTok bold / Minimal / Karaoke / Cinematic / UGC / News / Tết / Noto Sans VN.
3. ElevenLabs Scribe transcribe → segments tự sync với audio track.

**So với CapCut:** PixStudio dùng ElevenLabs Scribe (better VN tone) + 8 preset, click 1 lần áp dụng cả timeline.

### BG remove
- Right-click clip → "Remove background" → SAM 2 server (best edge quality, hair detection tốt hơn CapCut).
- Preview real-time qua RVM browser (1080p ≤ 100ms).

### Upscale 4K
- Right-click clip → "Upscale 4K" (Max tier, Real-ESRGAN trên GPU server).
- 1080p → 4K mất ~2 phút cho clip 30s.

### Translate caption / re-voice (NEW — Path B re-language)
1. Editor "Edit script" tab → **Translate → EN** hoặc **Translate → VI**.
2. DO Inference LLM dịch giữ nguyên timestamps.
3. Click **Voice over** → ElevenLabs Multilingual v2 generate giọng mới.
4. New voice track tự động swap.

---

## Export

### TikTok 9:16
1. Click **Export** button.
2. Pick **TikTok 9:16** preset chip → format/quality auto-set.
3. Click "Export" → MP4 tải xuống.

### Multi-aspect (1 click → 6 platform variants)
- Quick Create flow → "Multi-aspect repurpose" feature (Phase 2).
- Project 16:9 → output: 9:16 + 1:1 + 4:5 + 16:9 + Square + Vertical full HD.
- Render parallel ~30s tổng cho clip 60s.

### Custom format
Format/Quality sections mở sau Platform preset — pick MP4/WebM, low/medium/high/very_high.

---

## Music

### Beat sync
- Drop music vào audio track → click **Beat sync** → cuts auto-align với beat.
- Detection algorithm: PySceneDetect + audio onset.

### Music library
- Tab Asset → Music → 4 source: PixStudio internal / FB Sound Collection (free for FB ads) / TikTok Creative Center / Uploaded.
- Search bằng mood (upbeat / chill / cinematic / epic / ...) hoặc bpm.

### Cultural seasonal music
- Trang Quick Create workflow picker hiển thị "Đang mùa" chip khi tháng hiện tại match Tết / Trung Thu / Quốc Khánh / Black Friday.
- Pick chip → workflow tune sẵn music + caption preset + color palette + stock tag matching mùa.

---

## Shortcuts cheat-sheet

| Phím | CapCut | PixStudio |
|---|---|---|
| Save | `Ctrl+S` | Auto (no shortcut needed) |
| Undo / Redo | `Ctrl+Z` / `Ctrl+Shift+Z` | same |
| Split clip | `Ctrl+B` | `Ctrl+B` hoặc `S` |
| Play/pause | `Space` | same |
| Add keyframe | Diamond icon | `K` |
| Zoom timeline | `+` `-` | `Ctrl+=` `Ctrl+-` |
| Skip 5s back | `Shift+J` | same |
| Skip 5s forward | `Shift+L` | same |
| Razor tool | `C` | same |
| Selection tool | `V` | same |
| Mute clip | `M` | same |

---

## Friction items — currently slower hoặc khác

| Pain | Workaround | Roadmap |
|---|---|---|
| Template library nhỏ (50 templates v1 vs CapCut 1000+) | Use Quick Create wizard tự generate | T-2 mở rộng 200 templates Phase 2 |
| Generative transitions (Kling) chậm hơn CapCut transitions | Phòng generated assets pre-cache hoặc dùng CapCut-like transitions có sẵn | RIFE interpolation Phase 2 |
| Project share .draft với external (non-PixStudio user) | Export project package ZIP → share file | Phase 3 collab cho external invite link |
| Mobile preview app | Chưa có | Phase 4 (PXL Desktop App tích hợp) |

---

## Helpdesk / question flow

- **Question urgent** (block production): post Discord `#pixstudio-helpdesk` — em (Claude) reply trong 30 phút giờ làm việc.
- **Bug**: click Bug widget (floating button) — em log + triage.
- **Feature request**: anh log vào `#pixstudio-feedback` Discord, em weekly review + ship.

---

## Shortcuts để check khi quên

- 5 tutorial videos (record bởi em qua dogfood PixStudio chính nó): `docs/editor-migration/tutorials/` (TODO Phase 1 deliverable).
- Cheat sheet 1-page PDF: `docs/editor-migration/cheat-sheet.pdf` (TODO Phase 1 deliverable).
- Slack helpdesk (workspace `pixelxlab-creative`): em monitor live.
