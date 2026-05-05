/**
 * Hero attachment enrichment — S14 (QC-4 wire).
 *
 * Per SCOPE QC-4: user attaches reference materials to Hero textarea via
 * "+ button". Phase 2 supports image (Gemini vision describe) + PDF (text
 * extract). Audio is Phase 3 Max voice clone.
 *
 * Output: a string block to append to the outline LLM prompt so the LLM
 * understands what reference material the user provided.
 */

import { GetObjectCommand, type S3Client } from "@aws-sdk/client-s3";
// pdf-parse@1.1.1 index.js runs debug code at import time
// (`if (!module.parent) readFileSync('./test/data/05-versions-space.pdf')`)
// which crashes on Bun where module.parent is null. Import the inner impl.
// @ts-expect-error — @types/pdf-parse only declares the root module
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { apiEnv } from "../env.js";

interface AttachmentRef {
	r2Key: string;
	mimeType?: string | null;
}

const GEMINI_VISION_MODEL = "gemini-2.5-flash";
const PDF_TEXT_MAX_CHARS = 4000;

/**
 * Fetch a single R2 object as Buffer + sniff MIME type from key suffix.
 */
async function fetchR2Object(
	r2: S3Client,
	bucket: string,
	r2Key: string,
): Promise<{ buf: Buffer; mime: string }> {
	const obj = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: r2Key }));
	if (!obj.Body) throw new Error(`R2 ${r2Key} no body`);
	const chunks: Uint8Array[] = [];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	for await (const chunk of obj.Body as any) chunks.push(chunk as Uint8Array);
	const buf = Buffer.concat(chunks);
	const lower = r2Key.toLowerCase();
	const mime = lower.endsWith(".pdf")
		? "application/pdf"
		: lower.endsWith(".png")
			? "image/png"
			: lower.endsWith(".webp")
				? "image/webp"
				: lower.endsWith(".mp3") || lower.endsWith(".mpeg")
					? "audio/mpeg"
					: lower.endsWith(".wav")
						? "audio/wav"
						: "image/jpeg";
	return { buf, mime };
}

/**
 * Describe an image via Gemini 2.5 Flash multimodal. Cheap + fast (vs Pro).
 * Returns a 2-3 sentence description usable in script generation context.
 */
async function describeImageWithGemini(
	imageBuf: Buffer,
	mime: string,
): Promise<string | null> {
	if (!apiEnv.GEMINI_API_KEY) return null;
	const base64 = imageBuf.toString("base64");
	const prompt = `Describe this reference image for a video script writer in 2-3 sentences. Focus on: (1) main subject/product, (2) visual style/mood, (3) any text or branding visible. Output Vietnamese only. Return raw text — no quotes, no markdown.`;
	try {
		const resp = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent?key=${apiEnv.GEMINI_API_KEY}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					contents: [
						{
							parts: [
								{ text: prompt },
								{ inlineData: { mimeType: mime, data: base64 } },
							],
						},
					],
					generationConfig: { maxOutputTokens: 200, temperature: 0.4 },
				}),
			},
		);
		if (!resp.ok) return null;
		const json = (await resp.json()) as {
			candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
		};
		return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
	} catch {
		return null;
	}
}

/**
 * Extract text from PDF via pdf-parse.
 */
async function extractPdfText(buf: Buffer): Promise<string | null> {
	try {
		const data = await pdfParse(buf);
		const text = (data.text ?? "").trim();
		if (!text) return null;
		return text.slice(0, PDF_TEXT_MAX_CHARS);
	} catch {
		return null;
	}
}

/**
 * Process all attachments in parallel and return a context block string.
 * Empty string if no attachments or all enrichments failed (don't bloat prompt).
 */
export async function enrichHeroAttachments(opts: {
	r2: S3Client | null;
	bucketName: string;
	attachments: AttachmentRef[];
}): Promise<string> {
	if (!opts.r2 || opts.attachments.length === 0) return "";
	const results = await Promise.all(
		opts.attachments.map(async (att) => {
			try {
				const { buf, mime } = await fetchR2Object(opts.r2!, opts.bucketName, att.r2Key);
				if (mime.startsWith("image/")) {
					const desc = await describeImageWithGemini(buf, mime);
					return desc ? `Reference image: ${desc}` : null;
				}
				if (mime === "application/pdf") {
					const text = await extractPdfText(buf);
					return text ? `Reference PDF excerpt:\n${text}` : null;
				}
				if (mime.startsWith("audio/")) {
					// Phase 3 voice clone — for Phase 2 just acknowledge attachment.
					return "Reference audio attached (voice tone hint, full clone Phase 3 Max tier).";
				}
				return null;
			} catch {
				return null;
			}
		}),
	);
	const valid = results.filter((r): r is string => !!r);
	if (valid.length === 0) return "";
	return `\n[REFERENCE MATERIALS — user-attached, use as inspiration]\n${valid.join("\n\n")}\n`;
}
