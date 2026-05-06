# PixStudio Cheat Sheet (1-page)

> Print A4 / pin Discord. Pair với `workflow-translation-guide.md` cho ngữ cảnh đầy đủ.

## Top 20 shortcuts

| | Phím | | Phím |
|---|---|---|---|
| Save (auto, không cần) | — | Razor tool | `C` |
| Undo / Redo | `Ctrl+Z` / `Ctrl+Shift+Z` | Selection tool | `V` |
| Split clip | `Ctrl+B` hoặc `S` | Mute clip | `M` |
| Play / pause | `Space` | Add keyframe | `K` |
| Zoom in / out | `Ctrl+=` / `Ctrl+-` | Skip 5s back / fwd | `Shift+J` / `Shift+L` |
| Frame back / fwd | `←` / `→` | Go to start / end | `Home` / `End` |
| Delete clip | `Delete` | Duplicate clip | `Ctrl+D` |
| Group / ungroup | `Ctrl+G` / `Ctrl+Shift+G` | Lock track | `L` |
| Toggle full preview | `F` | Open Comments panel | `Ctrl+/` |

## 5 automation features ship-quick

| Feature | Click path | Tier | Cost / video |
|---|---|---|---|
| Caption auto-VN (8 presets) | Toolbar → ✨ AI tools → Caption AI → pick preset | Standard | ~$0.02/min audio |
| BG remove (SAM 2 server) | Right-click clip → Remove background | Pro | ~$0.05/clip |
| Multi-aspect export (1 click → 6 platforms) | Quick Create → Multi-aspect repurpose | Pro | $0 (CPU FFmpeg) |
| Translate caption + re-voice | Editor "Edit script" → Translate → EN/VI + Voice over | Pro | ~$0.18/1000 chars |
| Smart trim silence | Right-click audio track → Smart trim (>0.5s gaps) | Standard | $0 |

## Quick Create wizard (15 giây script-to-video)

1. Hero textarea: gõ ý tưởng — tối đa 25K chars
2. Pick workflow (8 templates VN-tuned + 3 Max plugins)
3. Config modal: voice / language / subtitle / watermark / stock pool / music source
4. Generate Outline → review chips Audience / Look&Feel / Platform
5. Build → progress bar 5 stage (~3-5 phút)
6. Editor 3-tab open: Edit media / Edit script / Edit music

## Path B reverse engineer (NEW — investor demo flow)

1. Hero → toggle "Từ video tham khảo"
2. Paste YouTube/TikTok/Reel/Vimeo URL **OR** drag-drop MP4 (≤500MB)
3. Backend tách: scenes + transcript + visual analysis + music profile
4. Editor opens với scenes + script đã extracted
5. Click **Translate → EN** (hoặc VI) trong Edit script tab → re-language
6. Click **Voice over** → ElevenLabs Multilingual v2 generate giọng mới
7. Replace cảnh qua Asset Studio stock pool nếu cần
8. Export với platform preset chip (TikTok 9:16, Reel, etc)

**Limits per video:** Standard 5min · Pro 15min · Max 30min. Monthly cap: D32 5/30/120 min.

## Export presets

| Platform | Preset | W×H | Bitrate | Note |
|---|---|---|---|---|
| TikTok | TikTok 9:16 30s | 1080×1920 | 6Mbps | Max 60s |
| Instagram Reel | IG Reel 9:16 90s | 1080×1920 | 5Mbps | Max 90s |
| YouTube Shorts | YT Shorts 9:16 60s | 1080×1920 | 5Mbps | Max 60s |
| Facebook Reel | FB Reel 4:5 60s | 1080×1350 | 5Mbps | Vertical 4:5 |
| YouTube long | YT 1080p | 1920×1080 | 8Mbps | Max 10min default |
| X / Twitter | X 1:1 140s | 1080×1080 | 5Mbps | Max 2:20 |

Aspect ratio theo project canvas — đổi ratio dùng Multi-aspect repurpose.

## Helpdesk

- Bug: click floating Bug widget → em log + triage
- Question: Discord `#pixstudio-helpdesk` — em reply trong 30 phút giờ làm việc
- Feature request: Discord `#pixstudio-feedback` — weekly review

## Gotchas

- Project tự auto-save 30 giây 1 lần — không có `Ctrl+S`
- Path B URL `r2://` prefix = manual upload; `https://` = yt-dlp download
- Cultural seasonal chip chỉ hiện khi tháng hiện tại match (Tết Dec-Feb / Trung Thu Aug-Sep / Quốc Khánh 8-9 / BF Nov)
- Voice over re-gen overwrites entire voice track (không per-segment v1)
- Scene < 5s tự merge vào cảnh trước (UX guard cho long videos)
