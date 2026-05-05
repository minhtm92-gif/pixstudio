/**
 * Template seed — Sprint S22 (T-2 SCOPE §4.5).
 *
 * 50 hand-curated templates seeded from Crossian-RAG patterns (sanitized
 * per SCOPE §6) + cultural VN bundles. Each template has a workflow ID +
 * pre-filled outline + suggested chips so anh team can clone + edit instead
 * of starting from scratch.
 *
 * Phase 1 already shipped 8 workflow templates (workflow registry). Phase 2
 * T-2 expands inventory to 50+ via this seed file. Future S30+ wires admin
 * UI to add templates without code change.
 */

export interface TemplateSeed {
	id: string;
	workflowId:
		| "ad-product-vn"
		| "ugc-review-tiktok"
		| "demo-product"
		| "short-entertainment"
		| "youtube-long-entertainment"
		| "storytelling-cinematic"
		| "tet-bundle"
		| "script-to-video"
		| "dropshipping-fb-ad";
	name: string;
	platform: "tiktok" | "fb-feed" | "fb-ad-vertical" | "youtube-long" | "youtube-shorts" | "ig-reels";
	category:
		| "product-ad"
		| "ugc-review"
		| "tutorial"
		| "trending"
		| "seasonal"
		| "entertainment";
	preview: {
		hookLine: string;
		structure: string[];
		ctaLine: string;
	};
	suggestedChips: {
		audiences: string[];
		lookFeel: string[];
	};
	durationSec: number;
	tags: string[];
}

export const TEMPLATE_SEED: TemplateSeed[] = [
	// === Product Ad templates (15) ===
	{
		id: "tpl-skincare-spf",
		workflowId: "ad-product-vn",
		name: "Skincare SPF — Hook đau lưng",
		platform: "tiktok",
		category: "product-ad",
		preview: {
			hookLine: "Da bạn đang chống lão hóa hay bỏ mặc?",
			structure: ["Hook 0-3s", "Vấn đề 3-7s", "Giải pháp 7-15s", "Demo 15-25s", "CTA 25-30s"],
			ctaLine: "Click bio để mua + ưu đãi 30% hôm nay",
		},
		suggestedChips: { audiences: ["beauty-shopper", "office-worker"], lookFeel: ["ad-style"] },
		durationSec: 30,
		tags: ["beauty", "skincare", "ad"],
	},
	{
		id: "tpl-fashion-comfort",
		workflowId: "ad-product-vn",
		name: "Quần áo co giãn senior 50+",
		platform: "tiktok",
		category: "product-ad",
		preview: {
			hookLine: "Đau lưng vì quần chật? Thử cách này",
			structure: ["Hook problem", "Demo flexibility", "Lifestyle", "Social proof", "CTA"],
			ctaLine: "Inbox để được tư vấn size",
		},
		suggestedChips: { audiences: ["senior-50plus", "pain-back"], lookFeel: ["ugc-authentic"] },
		durationSec: 35,
		tags: ["fashion", "senior", "comfort"],
	},
	{
		id: "tpl-supplement",
		workflowId: "ad-product-vn",
		name: "TPCN bổ não cho người trẻ stress",
		platform: "tiktok",
		category: "product-ad",
		preview: {
			hookLine: "Đầu óc choáng váng sau 3 ly cà phê?",
			structure: ["Hook stress", "Symptom list", "Product intro", "Testimonial", "CTA"],
			ctaLine: "Link bio - giảm 25% combo 30 ngày",
		},
		suggestedChips: { audiences: ["office-worker", "gen-z-tiktok"], lookFeel: ["ad-style"] },
		durationSec: 30,
		tags: ["supplement", "wellness"],
	},
	{
		id: "tpl-ecom-dropshipping",
		workflowId: "dropshipping-fb-ad",
		name: "Dropship — Hook curiosity",
		platform: "fb-ad-vertical",
		category: "product-ad",
		preview: {
			hookLine: "Why is everyone obsessed with this gadget?",
			structure: ["Hook curiosity", "Problem identification", "Demo", "Social proof", "CTA urgency"],
			ctaLine: "Tap link below — 50% OFF today only",
		},
		suggestedChips: { audiences: ["ecom-buyer", "gen-z-tiktok"], lookFeel: ["ad-style"] },
		durationSec: 50,
		tags: ["dropship", "fb-ad", "en"],
	},
	{
		id: "tpl-baby-mom",
		workflowId: "ad-product-vn",
		name: "Sản phẩm mẹ và bé",
		platform: "fb-feed",
		category: "product-ad",
		preview: {
			hookLine: "Mẹ bỉm sữa cứu cánh sau 3am",
			structure: ["Empathy hook", "Pain points", "Solution demo", "Reviews", "CTA"],
			ctaLine: "Inbox shop để được tư vấn miễn phí",
		},
		suggestedChips: { audiences: ["young-parents", "mom-baby"], lookFeel: ["ugc-authentic"] },
		durationSec: 45,
		tags: ["mom-baby", "empathy"],
	},
	{
		id: "tpl-pet-food",
		workflowId: "ad-product-vn",
		name: "Pet food — Tone vui nhộn",
		platform: "tiktok",
		category: "product-ad",
		preview: {
			hookLine: "Boss ăn không ngon? Test ngay",
			structure: ["Pet hook", "Problem (pet picky)", "Product demo", "Pet enjoying", "CTA"],
			ctaLine: "Đặt sample 49k - giao 24h",
		},
		suggestedChips: { audiences: ["pet-owner"], lookFeel: ["comedy", "ugc-authentic"] },
		durationSec: 25,
		tags: ["pet", "food"],
	},
	{
		id: "tpl-kitchen-gadget",
		workflowId: "demo-product",
		name: "Kitchen gadget demo",
		platform: "fb-feed",
		category: "product-ad",
		preview: {
			hookLine: "Tại sao bạn vẫn thái hành kiểu này?",
			structure: ["Pain point", "Old way demo", "New gadget demo", "Time saved", "CTA"],
			ctaLine: "Order ngay - giao 1-2 ngày",
		},
		suggestedChips: { audiences: ["young-parents", "office-worker"], lookFeel: ["ad-style"] },
		durationSec: 60,
		tags: ["kitchen", "demo"],
	},
	{
		id: "tpl-weightloss",
		workflowId: "ad-product-vn",
		name: "Giảm cân — Senior gentle",
		platform: "tiktok",
		category: "product-ad",
		preview: {
			hookLine: "50+ giảm 5kg không cần chạy bộ?",
			structure: ["Senior pain", "Solution intro", "Method demo", "Result before/after", "CTA"],
			ctaLine: "Comment 'CẦN' để được tư vấn",
		},
		suggestedChips: { audiences: ["senior-50plus", "pain-weight"], lookFeel: ["ugc-authentic"] },
		durationSec: 35,
		tags: ["weight", "senior"],
	},
	{
		id: "tpl-tech-gadget",
		workflowId: "demo-product",
		name: "Tech gadget Gen Z review",
		platform: "youtube-shorts",
		category: "product-ad",
		preview: {
			hookLine: "$30 này thay điện thoại $1000 ?",
			structure: ["Hook comparison", "Product unboxing", "Feature demo", "Use case", "CTA"],
			ctaLine: "Link affiliate trong bio",
		},
		suggestedChips: { audiences: ["tech-adopter", "gen-z-shorts"], lookFeel: ["tech-modern"] },
		durationSec: 60,
		tags: ["tech", "gadget"],
	},
	{
		id: "tpl-fitness-gear",
		workflowId: "ad-product-vn",
		name: "Fitness gear hook",
		platform: "ig-reels",
		category: "product-ad",
		preview: {
			hookLine: "Tập gym 3 tháng không lên cơ?",
			structure: ["Hook frustration", "Tool intro", "Demo workout", "Result", "CTA"],
			ctaLine: "Combo discount tại link bio",
		},
		suggestedChips: { audiences: ["fitness-enthusiast"], lookFeel: ["ad-style"] },
		durationSec: 30,
		tags: ["fitness", "gym"],
	},
	{
		id: "tpl-haircare",
		workflowId: "ad-product-vn",
		name: "Haircare anti-rụng",
		platform: "tiktok",
		category: "product-ad",
		preview: {
			hookLine: "Tóc rụng bằng nửa đầu rồi mới biết?",
			structure: ["Pain", "Cause", "Product demo", "Testimonial", "CTA"],
			ctaLine: "Đặt sample 49k giao tận nhà",
		},
		suggestedChips: { audiences: ["beauty-shopper", "young-parents"], lookFeel: ["ad-style"] },
		durationSec: 30,
		tags: ["haircare"],
	},
	{
		id: "tpl-furniture-mini",
		workflowId: "demo-product",
		name: "Đồ nội thất mini",
		platform: "fb-feed",
		category: "product-ad",
		preview: {
			hookLine: "Phòng 10m² mà chứa được hết đồ",
			structure: ["Space pain", "Product reveal", "Setup demo", "Before/after", "CTA"],
			ctaLine: "Inbox để có voucher 20%",
		},
		suggestedChips: { audiences: ["young-parents", "office-worker"], lookFeel: ["lifestyle"] },
		durationSec: 50,
		tags: ["furniture", "small-space"],
	},
	{
		id: "tpl-jewelry",
		workflowId: "storytelling-cinematic",
		name: "Trang sức cinematic story",
		platform: "ig-reels",
		category: "product-ad",
		preview: {
			hookLine: "Quà cưới 5 năm nữa anh ấy vẫn nhớ",
			structure: ["Emotional hook", "Story setup", "Product reveal", "Resolution", "CTA"],
			ctaLine: "Nhắn tin để được tư vấn",
		},
		suggestedChips: { audiences: ["gift-giver"], lookFeel: ["cinematic", "lifestyle"] },
		durationSec: 60,
		tags: ["jewelry", "gift"],
	},
	{
		id: "tpl-courses",
		workflowId: "ad-product-vn",
		name: "Khóa học online hook ROI",
		platform: "fb-ad-vertical",
		category: "product-ad",
		preview: {
			hookLine: "ROI khoá học 1.5tr → 50tr/tháng?",
			structure: ["Promise hook", "Student story", "Curriculum preview", "Bonus", "CTA"],
			ctaLine: "Sign up trước 23:59 hôm nay",
		},
		suggestedChips: { audiences: ["self-improve", "ecom-seller"], lookFeel: ["ad-style"] },
		durationSec: 45,
		tags: ["course", "online"],
	},
	{
		id: "tpl-sneakers",
		workflowId: "ad-product-vn",
		name: "Sneakers Gen Z hype",
		platform: "tiktok",
		category: "product-ad",
		preview: {
			hookLine: "Giày này được celebrity đi tuần qua",
			structure: ["Hype hook", "Product 360°", "OOTD pairing", "Limited stock", "CTA"],
			ctaLine: "Link bio - chỉ còn 3 size",
		},
		suggestedChips: { audiences: ["gen-z-tiktok"], lookFeel: ["ad-style"] },
		durationSec: 25,
		tags: ["fashion", "sneakers"],
	},

	// === UGC Review templates (10) ===
	{
		id: "tpl-ugc-skin",
		workflowId: "ugc-review-tiktok",
		name: "UGC review skincare 30 ngày",
		platform: "tiktok",
		category: "ugc-review",
		preview: {
			hookLine: "Em test serum này 30 ngày, kết quả...",
			structure: ["Talking head intro", "Day 1 close-up", "Day 30 close-up", "Verdict", "Recommend"],
			ctaLine: "Em để link shop trong bio",
		},
		suggestedChips: { audiences: ["beauty-shopper"], lookFeel: ["ugc-authentic"] },
		durationSec: 35,
		tags: ["ugc", "skincare", "test"],
	},
	{
		id: "tpl-ugc-fashion",
		workflowId: "ugc-review-tiktok",
		name: "UGC OOTD comfort try-on",
		platform: "tiktok",
		category: "ugc-review",
		preview: {
			hookLine: "Mặc thử ở nhà nguyên ngày — đáng tiền",
			structure: ["Unbox", "Try on multiple outfits", "Movement test", "Comfort verdict", "CTA"],
			ctaLine: "Code FREESHIP đính kèm",
		},
		suggestedChips: { audiences: ["senior-50plus", "office-worker"], lookFeel: ["ugc-authentic"] },
		durationSec: 40,
		tags: ["ugc", "fashion", "tryon"],
	},
	{
		id: "tpl-ugc-food-delivery",
		workflowId: "ugc-review-tiktok",
		name: "UGC food delivery review",
		platform: "tiktok",
		category: "ugc-review",
		preview: {
			hookLine: "Order món này, ngon hay dở thì...",
			structure: ["Order on screen", "Box arrival", "First bite", "Honest opinion", "CTA"],
			ctaLine: "App + code trong bio",
		},
		suggestedChips: { audiences: ["food-lover", "gen-z-tiktok"], lookFeel: ["ugc-authentic", "food-porn"] },
		durationSec: 30,
		tags: ["ugc", "food"],
	},
	{
		id: "tpl-ugc-supplement",
		workflowId: "ugc-review-tiktok",
		name: "UGC supplement before/after",
		platform: "ig-reels",
		category: "ugc-review",
		preview: {
			hookLine: "Em uống thuốc này 90 ngày — số liệu thật",
			structure: ["Before stats", "Daily routine", "Results visualized", "Honest verdict", "CTA"],
			ctaLine: "Link affiliate dưới bio",
		},
		suggestedChips: { audiences: ["pain-skin", "self-improve"], lookFeel: ["ugc-authentic"] },
		durationSec: 45,
		tags: ["ugc", "supplement"],
	},
	{
		id: "tpl-ugc-tech",
		workflowId: "ugc-review-tiktok",
		name: "UGC tech unbox + first impression",
		platform: "youtube-shorts",
		category: "ugc-review",
		preview: {
			hookLine: "Unbox cùng em — máy này đáng mua không?",
			structure: ["Unbox slow", "Setup", "First use", "Pro/con list", "Recommend score"],
			ctaLine: "Subscribe + bell",
		},
		suggestedChips: { audiences: ["tech-adopter", "gen-z-shorts"], lookFeel: ["ugc-authentic", "tech-modern"] },
		durationSec: 60,
		tags: ["ugc", "tech"],
	},
	{
		id: "tpl-ugc-pet-toy",
		workflowId: "ugc-review-tiktok",
		name: "UGC pet toy fail or win",
		platform: "tiktok",
		category: "ugc-review",
		preview: {
			hookLine: "Boss em chấm bao nhiêu cho món này?",
			structure: ["Toy unbox", "Pet first reaction", "Use throughout day", "Verdict", "CTA"],
			ctaLine: "Comment '🐾' để có code",
		},
		suggestedChips: { audiences: ["pet-owner"], lookFeel: ["ugc-authentic", "comedy"] },
		durationSec: 30,
		tags: ["ugc", "pet"],
	},
	{
		id: "tpl-ugc-baby",
		workflowId: "ugc-review-tiktok",
		name: "UGC mom-baby product hands-on",
		platform: "tiktok",
		category: "ugc-review",
		preview: {
			hookLine: "Mẹ bỉm test sản phẩm trong 1 tuần",
			structure: ["Background problem", "Product setup", "Daily use clips", "Verdict", "CTA"],
			ctaLine: "Inbox shop em + voucher",
		},
		suggestedChips: { audiences: ["young-parents", "mom-baby"], lookFeel: ["ugc-authentic"] },
		durationSec: 40,
		tags: ["ugc", "mom-baby"],
	},
	{
		id: "tpl-ugc-fitness",
		workflowId: "ugc-review-tiktok",
		name: "UGC fitness gear sweat test",
		platform: "ig-reels",
		category: "ugc-review",
		preview: {
			hookLine: "Đai bụng này 30 ngày — số đo thật",
			structure: ["Day 1 measure", "Daily routine", "Day 30 measure", "Verdict", "Affiliate"],
			ctaLine: "Code 'FIT20' giảm 20%",
		},
		suggestedChips: { audiences: ["fitness-enthusiast"], lookFeel: ["ugc-authentic"] },
		durationSec: 50,
		tags: ["ugc", "fitness"],
	},
	{
		id: "tpl-ugc-stationery",
		workflowId: "ugc-review-tiktok",
		name: "UGC student stationery",
		platform: "tiktok",
		category: "ugc-review",
		preview: {
			hookLine: "Tiết kiệm 50% chi phí học kỳ này",
			structure: ["Old vs new", "Pen test", "Notebook quality", "Total cost", "CTA"],
			ctaLine: "Link shopee bên dưới",
		},
		suggestedChips: { audiences: ["student", "gen-z-tiktok"], lookFeel: ["ugc-authentic"] },
		durationSec: 30,
		tags: ["ugc", "stationery", "student"],
	},
	{
		id: "tpl-ugc-haircare-review",
		workflowId: "ugc-review-tiktok",
		name: "UGC haircare 60-day result",
		platform: "tiktok",
		category: "ugc-review",
		preview: {
			hookLine: "Tóc ngắn → tóc dài 5cm trong 60 ngày",
			structure: ["Day 1 selfie", "Routine demo", "Mid-period checkpoint", "Day 60 reveal", "CTA"],
			ctaLine: "Link bio + bonus 10%",
		},
		suggestedChips: { audiences: ["beauty-shopper", "young-parents"], lookFeel: ["ugc-authentic"] },
		durationSec: 45,
		tags: ["ugc", "haircare", "test"],
	},

	// === Tutorial templates (10) ===
	{
		id: "tpl-tutorial-makeup",
		workflowId: "demo-product",
		name: "Tutorial makeup 3 phút",
		platform: "tiktok",
		category: "tutorial",
		preview: {
			hookLine: "3 phút makeup full mặt — clean girl 2026",
			structure: ["Clean face", "Step 1-3 base", "Step 4-6 eye/lip", "Final look", "Product list"],
			ctaLine: "Save video + tag bạn",
		},
		suggestedChips: { audiences: ["beauty-shopper", "gen-z-tiktok"], lookFeel: ["lifestyle"] },
		durationSec: 60,
		tags: ["tutorial", "makeup"],
	},
	{
		id: "tpl-tutorial-cooking",
		workflowId: "demo-product",
		name: "Tutorial nấu ăn 60s",
		platform: "tiktok",
		category: "tutorial",
		preview: {
			hookLine: "Cơm tấm sườn nướng — 60 giây hết",
			structure: ["Ingredient list", "Prep", "Cook", "Plate", "Eat reaction"],
			ctaLine: "Save + tag mom",
		},
		suggestedChips: { audiences: ["food-lover", "young-parents"], lookFeel: ["food-porn"] },
		durationSec: 60,
		tags: ["tutorial", "cooking"],
	},
	{
		id: "tpl-tutorial-tech",
		workflowId: "demo-product",
		name: "Tutorial setup phần mềm",
		platform: "youtube-long",
		category: "tutorial",
		preview: {
			hookLine: "Setup ChatGPT làm trợ lý cá nhân trong 5 phút",
			structure: ["Use case", "Account setup", "Configuration", "First query demo", "Tips"],
			ctaLine: "Like + sub for more",
		},
		suggestedChips: { audiences: ["tech-adopter", "self-improve"], lookFeel: ["tech-modern"] },
		durationSec: 300,
		tags: ["tutorial", "tech", "ai"],
	},
	{
		id: "tpl-tutorial-finance",
		workflowId: "youtube-long-entertainment",
		name: "Tutorial tài chính cá nhân",
		platform: "youtube-long",
		category: "tutorial",
		preview: {
			hookLine: "Lương 10tr — chia tiền thế nào để đủ?",
			structure: ["Problem stats", "Method 50/30/20", "Real example", "Tools", "CTA"],
			ctaLine: "Subscribe — phần 2 next week",
		},
		suggestedChips: { audiences: ["office-worker", "self-improve"], lookFeel: ["minimal"] },
		durationSec: 480,
		tags: ["tutorial", "finance"],
	},
	{
		id: "tpl-tutorial-language",
		workflowId: "demo-product",
		name: "Tutorial học IELTS hook",
		platform: "tiktok",
		category: "tutorial",
		preview: {
			hookLine: "5 câu speak dùng trong mọi part 2",
			structure: ["List 5", "Example each", "How to memorize", "Combo", "CTA"],
			ctaLine: "Save + practice",
		},
		suggestedChips: { audiences: ["student", "self-improve"], lookFeel: ["minimal"] },
		durationSec: 45,
		tags: ["tutorial", "language", "ielts"],
	},
	{
		id: "tpl-tutorial-craft",
		workflowId: "demo-product",
		name: "Tutorial DIY trang trí",
		platform: "ig-reels",
		category: "tutorial",
		preview: {
			hookLine: "DIY thùng giấy thành kệ trang trí 100k",
			structure: ["Materials needed", "Cut shapes", "Assemble", "Paint", "Final placement"],
			ctaLine: "Save + share",
		},
		suggestedChips: { audiences: ["young-parents"], lookFeel: ["lifestyle", "ugc-authentic"] },
		durationSec: 60,
		tags: ["tutorial", "diy"],
	},
	{
		id: "tpl-tutorial-photoshop",
		workflowId: "youtube-long-entertainment",
		name: "Tutorial Photoshop basic",
		platform: "youtube-long",
		category: "tutorial",
		preview: {
			hookLine: "Photoshop từ 0 — chỉnh ảnh đẹp trong 1 tuần",
			structure: ["Setup tour", "Layer concept", "Adjust tools", "Export workflow", "Practice"],
			ctaLine: "Sub + bell — series 5 phần",
		},
		suggestedChips: { audiences: ["self-improve", "tech-adopter"], lookFeel: ["minimal"] },
		durationSec: 600,
		tags: ["tutorial", "photoshop"],
	},
	{
		id: "tpl-tutorial-meal-plan",
		workflowId: "demo-product",
		name: "Tutorial meal prep tuần",
		platform: "ig-reels",
		category: "tutorial",
		preview: {
			hookLine: "1 buổi prep — cả tuần ăn sạch + giảm cân",
			structure: ["Shopping list", "Prep cooking", "Container fill", "Reheat option", "Result"],
			ctaLine: "Lưu công thức + tag bạn",
		},
		suggestedChips: { audiences: ["fitness-enthusiast", "office-worker"], lookFeel: ["food-porn"] },
		durationSec: 90,
		tags: ["tutorial", "meal-prep"],
	},
	{
		id: "tpl-tutorial-investing",
		workflowId: "youtube-long-entertainment",
		name: "Tutorial đầu tư cổ phiếu beginner",
		platform: "youtube-long",
		category: "tutorial",
		preview: {
			hookLine: "Đầu tư 1tr/tháng — 5 năm thành 100tr?",
			structure: ["Compound interest", "Stock vs ETF", "Open broker account", "First buy", "Track"],
			ctaLine: "Sub + learn more",
		},
		suggestedChips: { audiences: ["self-improve", "office-worker"], lookFeel: ["minimal"] },
		durationSec: 720,
		tags: ["tutorial", "investing"],
	},
	{
		id: "tpl-tutorial-spreadsheet",
		workflowId: "demo-product",
		name: "Tutorial Excel pivot table 5min",
		platform: "tiktok",
		category: "tutorial",
		preview: {
			hookLine: "Pivot table — bí kíp office 1 tiếng → 5 phút",
			structure: ["Problem manual", "Setup pivot", "Drag fields", "Filter + slice", "Magic result"],
			ctaLine: "Save + share đồng nghiệp",
		},
		suggestedChips: { audiences: ["office-worker"], lookFeel: ["minimal", "tech-modern"] },
		durationSec: 60,
		tags: ["tutorial", "excel"],
	},

	// === Trending templates (8) ===
	{
		id: "tpl-trend-pov",
		workflowId: "short-entertainment",
		name: "Trend POV office life",
		platform: "tiktok",
		category: "trending",
		preview: {
			hookLine: "POV: bạn vào meeting Monday morning",
			structure: ["POV setup", "Action 1", "Action 2", "Twist", "Reaction"],
			ctaLine: "Comment trải nghiệm bạn",
		},
		suggestedChips: { audiences: ["office-worker", "gen-z-tiktok"], lookFeel: ["comedy"] },
		durationSec: 15,
		tags: ["trend", "pov"],
	},
	{
		id: "tpl-trend-dance-cover",
		workflowId: "short-entertainment",
		name: "Trend dance cover",
		platform: "tiktok",
		category: "trending",
		preview: {
			hookLine: "Cover dance trend tuần này",
			structure: ["Beat drop intro", "Move 1-3", "Solo", "Group cover", "Outro"],
			ctaLine: "Tag bạn cùng cover",
		},
		suggestedChips: { audiences: ["gen-z-tiktok"], lookFeel: ["comedy", "lifestyle"] },
		durationSec: 30,
		tags: ["trend", "dance"],
	},
	{
		id: "tpl-trend-relatable",
		workflowId: "short-entertainment",
		name: "Trend relatable mom life",
		platform: "ig-reels",
		category: "trending",
		preview: {
			hookLine: "Mom life: 3 nỗi đau không ai hiểu",
			structure: ["Pain 1 demo", "Pain 2", "Pain 3", "Solution tease", "Affirmation"],
			ctaLine: "Tag mom you know",
		},
		suggestedChips: { audiences: ["young-parents", "mom-baby"], lookFeel: ["comedy", "ugc-authentic"] },
		durationSec: 30,
		tags: ["trend", "relatable", "mom"],
	},
	{
		id: "tpl-trend-this-or-that",
		workflowId: "short-entertainment",
		name: "Trend 'this or that' couple",
		platform: "tiktok",
		category: "trending",
		preview: {
			hookLine: "This or that — couple edition",
			structure: ["Q1 reveal", "Q2", "Q3", "Q4", "Final score"],
			ctaLine: "Tag SO của bạn",
		},
		suggestedChips: { audiences: ["gen-z-tiktok", "family"], lookFeel: ["comedy"] },
		durationSec: 30,
		tags: ["trend", "couple"],
	},
	{
		id: "tpl-trend-day-in-life",
		workflowId: "short-entertainment",
		name: "Trend day in life GenZ",
		platform: "tiktok",
		category: "trending",
		preview: {
			hookLine: "Một ngày của em — Gen Z 1996",
			structure: ["Wake up 6am", "Coffee shop work", "Lunch", "Workout", "End night routine"],
			ctaLine: "Subscribe vlog",
		},
		suggestedChips: { audiences: ["gen-z-tiktok", "office-worker"], lookFeel: ["lifestyle", "vlog"] },
		durationSec: 60,
		tags: ["trend", "vlog"],
	},
	{
		id: "tpl-trend-cooking-asmr",
		workflowId: "short-entertainment",
		name: "Trend cooking ASMR",
		platform: "tiktok",
		category: "trending",
		preview: {
			hookLine: "ASMR — tỏi giòn rang",
			structure: ["Close-up ingredients", "Slow chop sound", "Sizzle", "Plating", "Bite ASMR"],
			ctaLine: "Save + recipe in bio",
		},
		suggestedChips: { audiences: ["food-lover"], lookFeel: ["food-porn"] },
		durationSec: 45,
		tags: ["trend", "asmr", "cooking"],
	},
	{
		id: "tpl-trend-comparison",
		workflowId: "short-entertainment",
		name: "Trend so sánh thế hệ",
		platform: "tiktok",
		category: "trending",
		preview: {
			hookLine: "1995 vs 2025 — 5 thay đổi điên rồ",
			structure: ["Item 1 then-now", "Item 2", "Item 3", "Item 4", "Item 5"],
			ctaLine: "Comment bạn thuộc gen nào",
		},
		suggestedChips: { audiences: ["gen-z-tiktok", "office-worker"], lookFeel: ["comedy"] },
		durationSec: 30,
		tags: ["trend", "comparison"],
	},
	{
		id: "tpl-trend-q-and-a",
		workflowId: "short-entertainment",
		name: "Trend Q&A creator",
		platform: "tiktok",
		category: "trending",
		preview: {
			hookLine: "Trả lời câu hỏi từ followers",
			structure: ["Q1 + answer", "Q2", "Q3", "Q4", "Last viral Q"],
			ctaLine: "Hỏi tiếp ở comment",
		},
		suggestedChips: { audiences: ["gen-z-tiktok", "self-improve"], lookFeel: ["vlog"] },
		durationSec: 60,
		tags: ["trend", "q-and-a"],
	},

	// === Seasonal templates (5) ===
	{
		id: "tpl-tet-greeting",
		workflowId: "tet-bundle",
		name: "Tết greeting brand",
		platform: "fb-feed",
		category: "seasonal",
		preview: {
			hookLine: "Chúc mừng năm mới 2027 từ thương hiệu",
			structure: ["Brand reveal Tết décor", "Family scene", "Wishes", "Product reminder", "CTA"],
			ctaLine: "Inbox shop để được lì xì voucher",
		},
		suggestedChips: { audiences: ["family", "young-parents"], lookFeel: ["lifestyle"] },
		durationSec: 30,
		tags: ["seasonal", "tet", "greeting"],
	},
	{
		id: "tpl-tet-bundle-promo",
		workflowId: "tet-bundle",
		name: "Tết bundle promo",
		platform: "tiktok",
		category: "seasonal",
		preview: {
			hookLine: "Combo Tết tiết kiệm 30%",
			structure: ["Bundle reveal", "Item showcase", "Price comparison", "Stock tease", "CTA urgency"],
			ctaLine: "Đặt trước 30 Tết — combo có hạn",
		},
		suggestedChips: { audiences: ["family", "young-parents"], lookFeel: ["ad-style"] },
		durationSec: 30,
		tags: ["seasonal", "tet", "bundle"],
	},
	{
		id: "tpl-trungthu-mooncake",
		workflowId: "ad-product-vn",
		name: "Trung Thu mooncake premium",
		platform: "fb-ad-vertical",
		category: "seasonal",
		preview: {
			hookLine: "Trung Thu — bánh handcraft từ chef",
			structure: ["Heritage hook", "Process behind-scenes", "Box reveal", "Gift moment", "CTA"],
			ctaLine: "Đặt trước 1 tháng — giao 4 tỉnh",
		},
		suggestedChips: { audiences: ["family", "gift-giver"], lookFeel: ["cinematic", "lifestyle"] },
		durationSec: 45,
		tags: ["seasonal", "trungthu"],
	},
	{
		id: "tpl-blackfriday-flash",
		workflowId: "ad-product-vn",
		name: "Black Friday flash sale",
		platform: "fb-ad-vertical",
		category: "seasonal",
		preview: {
			hookLine: "BF — 24h khuyến mãi tới 70%",
			structure: ["Countdown banner", "Item 1", "Item 2", "Item 3", "Last hour reminder"],
			ctaLine: "Click ngay — chỉ trong 24h",
		},
		suggestedChips: { audiences: ["ecom-buyer", "gen-z-tiktok"], lookFeel: ["ad-style"] },
		durationSec: 30,
		tags: ["seasonal", "blackfriday"],
	},
	{
		id: "tpl-quockhanh-promo",
		workflowId: "ad-product-vn",
		name: "Quốc Khánh 2/9 promo",
		platform: "fb-feed",
		category: "seasonal",
		preview: {
			hookLine: "Quốc Khánh — sale 9/9 mừng đại lễ",
			structure: ["Patriotic hook", "Brand history", "Sale tease", "Item highlight", "CTA"],
			ctaLine: "Code 'QK99' — giảm 9% extra",
		},
		suggestedChips: { audiences: ["family", "office-worker"], lookFeel: ["ad-style"] },
		durationSec: 30,
		tags: ["seasonal", "quockhanh"],
	},

	// === Entertainment templates (2) ===
	{
		id: "tpl-storytelling-brand",
		workflowId: "storytelling-cinematic",
		name: "Storytelling brand origin",
		platform: "youtube-long",
		category: "entertainment",
		preview: {
			hookLine: "Câu chuyện brand — 5 năm vượt khủng hoảng",
			structure: ["Origin moment", "Crisis", "Pivotal decision", "Comeback", "Today + future"],
			ctaLine: "Subscribe + share câu chuyện",
		},
		suggestedChips: { audiences: ["self-improve", "ecom-seller"], lookFeel: ["cinematic"] },
		durationSec: 480,
		tags: ["entertainment", "storytelling"],
	},
	{
		id: "tpl-vlog-travel",
		workflowId: "youtube-long-entertainment",
		name: "Vlog travel Đà Lạt 3D2N",
		platform: "youtube-long",
		category: "entertainment",
		preview: {
			hookLine: "Đà Lạt 3 ngày 2 đêm với 3 triệu",
			structure: ["Day 1 highlights", "Day 2 cafe + viewpoint", "Day 3 souvenir", "Total cost", "Tips"],
			ctaLine: "Subscribe + ý tưởng tỉnh kế",
		},
		suggestedChips: { audiences: ["travel", "gen-z-youtube"], lookFeel: ["vlog", "lifestyle"] },
		durationSec: 600,
		tags: ["entertainment", "vlog", "travel"],
	},
];

export function findTemplateSeed(id: string): TemplateSeed | undefined {
	return TEMPLATE_SEED.find((t) => t.id === id);
}
