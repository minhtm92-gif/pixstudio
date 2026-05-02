# Quick Create — Chip Selector Content Form

*View 4 outline review chips per SCOPE.md §13. Anh fill 3 tables: Audiences, Look&Feel, Platforms.*

> **Reference image**: `docs/references/scope-01-images/image1.png` shows InVideo chip selector pattern.
>
> **How to use**: Edit each table — add/remove rows. Em load vào `packages/workflows/chips.ts` registry. UI render multi-select chips, user pick max 3 per category.

---

## 1. Audiences (target segments)

User picks 1-3 audience chips per project. Quick Create LLM uses these to tune script tone/vocab.

| ID | Display VN | Display EN | Tone hint cho LLM | Active |
|---|---|---|---|---|
| senior-50plus-vn | Senior 50+ VN | Senior 50+ Vietnam | Trầm, rõ ràng, tránh slang | yes |
| genz-tiktok | Gen Z TikTok | Gen Z TikTok | Trendy, viral hooks, slang OK | yes |
| young-parents | Young parents | Young parents | Warm, family-focused | yes |
| office-worker | Office worker 25-40 | Office worker 25-40 | Professional, time-saving | yes |
| <TBD> | <TBD> | <TBD> | <TBD> | yes |

**Anh fill thêm 15-25 segments based on Crossian + đối tác research:**

| ID (slug) | Display VN | Display EN | Tone hint | Active |
|---|---|---|---|---|
| <TBD> | | | | |
| <TBD> | | | | |
| <TBD> | | | | |
| <TBD> | | | | |
| <TBD> | | | | |
| <TBD> | | | | |
| <TBD> | | | | |
| <TBD> | | | | |
| <TBD> | | | | |
| <TBD> | | | | |
| <TBD> | | | | |
| <TBD> | | | | |
| <TBD> | | | | |
| <TBD> | | | | |
| <TBD> | | | | |

### Suggestion (anh start from this list, customize):

- **Demographic**: senior 50+ VN, senior 50+ EN, gen Z VN, gen Z EN, millennial 25-40, parents young (kid 0-5), parents kid (kid 6-12), parents teen, students college, students high school
- **Profession**: office worker, freelancer, doctor, teacher, sales, ecom seller, dropshipper, content creator, livestreamer, real estate agent
- **Interest**: fitness enthusiast, cooking enthusiast, travel lover, beauty enthusiast, fashion lover, gamer, tech early adopter, finance investor, parenting first-time mom, eldercare
- **Situation**: weight loss journey, post-pregnancy, retiree, expat in VN, urban Hanoi, urban HCM, rural

→ Recommend final list 25-30 chips, anh chốt.

---

## 2. Look & Feel (visual style)

User picks 1-2 look chips. Affects color palette, transition style, music genre defaults.

| ID | Display VN | Display EN | Color palette | Transition style | Music genre | Active |
|---|---|---|---|---|---|---|
| cinematic | Cinematic | Cinematic | Teal-Orange | Smooth fade | Orchestral / Cinematic | yes |
| vlog | Vlog daily | Vlog daily | Natural | Cuts + zoom | Lo-fi / Indie | yes |
| ad-style | Ads thương mại | Commercial Ad | Bright | Fast cuts | Energetic pop | yes |
| documentary | Documentary | Documentary | Muted | Slow fade | Ambient | yes |
| <TBD> | <TBD> | <TBD> | <TBD> | <TBD> | <TBD> | yes |

**Anh fill thêm 8-15 styles:**

| ID | Display VN | Display EN | Color palette | Transition | Music | Active |
|---|---|---|---|---|---|---|
| <TBD> | | | | | | |
| <TBD> | | | | | | |
| <TBD> | | | | | | |
| <TBD> | | | | | | |
| <TBD> | | | | | | |
| <TBD> | | | | | | |
| <TBD> | | | | | | |
| <TBD> | | | | | | |

### Suggestion list:

- cinematic, vlog daily, ad commercial, documentary, animation 2D, animation 3D, retro-vhs, minimalist white, dark moody, kawaii pastel, neon cyberpunk, vintage film, infographic motion graphics, sketch-style, paper cut-out

---

## 3. Platforms (output ratio + duration constraints)

User picks 1 platform. Defines aspect ratio + max duration + watermark policy.

| ID | Display VN | Display EN | Ratio | Max duration | Format export | Active |
|---|---|---|---|---|---|---|
| tiktok | TikTok | TikTok | 9:16 | 60s (3min Pro+) | mp4 H.264 | yes |
| youtube-shorts | YouTube Shorts | YouTube Shorts | 9:16 | 60s | mp4 H.264 | yes |
| ig-reels | Instagram Reels | Instagram Reels | 9:16 | 90s | mp4 H.264 | yes |
| ig-feed | Instagram Feed | Instagram Feed | 1:1 | 60s | mp4 H.264 | yes |
| ig-story | Instagram Story | Instagram Story | 9:16 | 15s/clip | mp4 H.264 | yes |
| fb-feed | Facebook Feed | Facebook Feed | 1:1 hoặc 4:5 | 240s | mp4 H.264 | yes |
| fb-reels | Facebook Reels | Facebook Reels | 9:16 | 90s | mp4 H.264 | yes |
| youtube-long | YouTube long | YouTube long-form | 16:9 | 900s (15min) | mp4 H.264 | yes |
| linkedin-feed | LinkedIn Feed | LinkedIn Feed | 16:9 hoặc 1:1 | 600s | mp4 H.264 | yes |
| twitter-x | Twitter/X | X (Twitter) | 16:9 | 140s | mp4 H.264 | yes |
| <TBD> | <TBD> | <TBD> | <TBD> | <TBD> | <TBD> | <TBD> |

**Anh confirm hoặc add:**

| ID | Display | Ratio | Max dur | Notes |
|---|---|---|---|---|
| <TBD> | | | | |
| <TBD> | | | | |

### Edge cases anh chốt

- **TikTok 3-10 min** (longer mode, Pro+ tier): em hỗ trợ?
- **Vimeo / Snapchat / Pinterest / Telegram**: priority cho VN market?
- **WhatsApp Status**: 30s, 9:16. Cần?
- **Zalo Story**: 30s, 9:16, VN-specific. Add?

---

## Final implementation note

Em sẽ build chip selector component với:
- Multi-select max constraint per category
- Search filter (>20 chips/category cần search)
- Bilingual label (VN default, EN toggle)
- Tone hints không hiển thị user (chỉ feed LLM)

Anh ping khi fill xong, em wire `packages/workflows/chips.ts` registry.
