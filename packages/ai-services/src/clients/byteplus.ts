/**
 * Byteplus HMAC-SHA256 v4 signing client — Sprint S18 (real Seedance + Seedream).
 *
 * Byteplus uses an AWS-Sig-V4-style request signing flow with their own region
 * (cn-north-1) + service (cv = computer vision for image/video). Documented at:
 * https://docs.byteplus.com/en/docs/byteplusapi/Authentication-Method
 *
 * Steps:
 *   1. Build canonical request (method + URI + querystring + headers + payload hash)
 *   2. Build string-to-sign (algorithm + date + credential scope + canonical hash)
 *   3. Derive signing key via HMAC chain (date → region → service → "request")
 *   4. Sign string-to-sign → final signature
 *   5. Inject Authorization header `BPS4-HMAC-SHA256 Credential=... SignedHeaders=... Signature=...`
 */

import { createHash, createHmac } from "node:crypto";

interface SignedRequestOptions {
	method: "GET" | "POST" | "PUT" | "DELETE";
	host: string;
	path: string;
	query?: Record<string, string>;
	body?: string | Buffer;
	region?: string;
	service?: string;
	algorithm?: string;
	additionalHeaders?: Record<string, string>;
}

const ALGORITHM_DEFAULT = "HMAC-SHA256";
const REGION_DEFAULT = "cn-north-1";
const SERVICE_DEFAULT = "cv"; // computer vision (image + video gen)

function sha256(data: string | Buffer): string {
	return createHash("sha256").update(data).digest("hex");
}

function hmac(key: string | Buffer, data: string): Buffer {
	return createHmac("sha256", key).update(data).digest();
}

function isoDate(d: Date): { stamp: string; date: string } {
	// 20060102T150405Z (ISO basic) and 20060102 (date-only)
	const y = d.getUTCFullYear();
	const m = (d.getUTCMonth() + 1).toString().padStart(2, "0");
	const day = d.getUTCDate().toString().padStart(2, "0");
	const h = d.getUTCHours().toString().padStart(2, "0");
	const min = d.getUTCMinutes().toString().padStart(2, "0");
	const sec = d.getUTCSeconds().toString().padStart(2, "0");
	return {
		stamp: `${y}${m}${day}T${h}${min}${sec}Z`,
		date: `${y}${m}${day}`,
	};
}

function canonicalQueryString(query: Record<string, string>): string {
	const keys = Object.keys(query).sort();
	return keys
		.map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k] ?? "")}`)
		.join("&");
}

function canonicalHeaders(headers: Record<string, string>): {
	canonical: string;
	signed: string;
} {
	const lower: Record<string, string> = {};
	for (const [k, v] of Object.entries(headers)) {
		lower[k.toLowerCase()] = v.trim().replace(/\s+/g, " ");
	}
	const sortedKeys = Object.keys(lower).sort();
	const canonical = sortedKeys.map((k) => `${k}:${lower[k]}\n`).join("");
	const signed = sortedKeys.join(";");
	return { canonical, signed };
}

export interface ByteplusClientOpts {
	accessKey: string;
	secretKey: string;
	host?: string;
	region?: string;
	service?: string;
}

export class ByteplusClient {
	constructor(private opts: ByteplusClientOpts) {}

	get host(): string {
		return this.opts.host ?? "open.byteplusapi.com";
	}

	/**
	 * Sign + send a request. Returns parsed JSON response.
	 */
	async request<T = unknown>(options: SignedRequestOptions): Promise<T> {
		const region = options.region ?? this.opts.region ?? REGION_DEFAULT;
		const service = options.service ?? this.opts.service ?? SERVICE_DEFAULT;
		const algorithm = options.algorithm ?? ALGORITHM_DEFAULT;
		const host = options.host ?? this.host;

		const now = new Date();
		const { stamp, date } = isoDate(now);
		const credentialScope = `${date}/${region}/${service}/request`;

		const bodyStr = typeof options.body === "string"
			? options.body
			: options.body
				? options.body.toString()
				: "";
		const payloadHash = sha256(bodyStr);

		const headers: Record<string, string> = {
			Host: host,
			"X-Date": stamp,
			"X-Content-Sha256": payloadHash,
			...(options.additionalHeaders ?? {}),
		};
		if (options.method === "POST" || options.method === "PUT") {
			headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
		}

		const queryStr = canonicalQueryString(options.query ?? {});
		const { canonical: canonicalHeaderStr, signed: signedHeaders } = canonicalHeaders(headers);

		const canonicalRequest = [
			options.method,
			options.path,
			queryStr,
			canonicalHeaderStr,
			signedHeaders,
			payloadHash,
		].join("\n");

		const stringToSign = [
			algorithm,
			stamp,
			credentialScope,
			sha256(canonicalRequest),
		].join("\n");

		// Derive signing key via HMAC chain
		const kDate = hmac(this.opts.secretKey, date);
		const kRegion = hmac(kDate, region);
		const kService = hmac(kRegion, service);
		const kSigning = hmac(kService, "request");
		const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

		const authorization = `${algorithm} Credential=${this.opts.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
		headers["Authorization"] = authorization;

		const url = `https://${host}${options.path}${queryStr ? `?${queryStr}` : ""}`;
		const resp = await fetch(url, {
			method: options.method,
			headers,
			body: bodyStr || undefined,
		});

		const text = await resp.text();
		if (!resp.ok) {
			throw new Error(`Byteplus ${options.method} ${options.path} ${resp.status}: ${text.slice(0, 500)}`);
		}
		try {
			return JSON.parse(text) as T;
		} catch {
			return text as unknown as T;
		}
	}

	/**
	 * Submit a Seedance image-to-video / text-to-video task.
	 * Returns task_id for polling.
	 */
	async submitSeedance(input: {
		mode: "i2v" | "t2v";
		prompt: string;
		imageUrl?: string;
		durationSec: 3 | 5 | 8 | 10;
		aspectRatio: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
	}): Promise<{ taskId: string; latencyMs: number }> {
		const start = Date.now();
		const body: Record<string, unknown> = {
			req_key: input.mode === "i2v" ? "img2vid" : "text2vid",
			prompt: input.prompt,
			duration: input.durationSec,
			aspect_ratio: input.aspectRatio,
		};
		if (input.mode === "i2v" && input.imageUrl) {
			body.image_urls = [input.imageUrl];
		}

		const resp = await this.request<{ data?: { task_id?: string }; code?: number; message?: string }>({
			method: "POST",
			path: "/",
			query: { Action: "CVSync2AsyncSubmitTask", Version: "2024-06-06" },
			host: this.host,
			body: JSON.stringify(body),
		});

		const taskId = resp.data?.task_id;
		if (!taskId) {
			throw new Error(`Seedance submit returned no task_id: code=${resp.code} msg=${resp.message ?? "unknown"}`);
		}
		return { taskId, latencyMs: Date.now() - start };
	}

	/**
	 * Poll Seedance task status. Returns DONE | RUNNING | FAILED.
	 */
	async pollSeedance(taskId: string): Promise<{
		status: "RUNNING" | "DONE" | "FAILED";
		videoUrl?: string;
		thumbnailUrl?: string;
		durationSec?: number;
		error?: string;
	}> {
		const resp = await this.request<{
			data?: {
				status?: string;
				resp_data?: string;
				task_id?: string;
				message?: string;
			};
			code?: number;
		}>({
			method: "POST",
			path: "/",
			query: { Action: "CVSync2AsyncGetResult", Version: "2024-06-06" },
			host: this.host,
			body: JSON.stringify({ task_id: taskId, req_key: "img2vid" }),
		});

		const status = resp.data?.status?.toUpperCase() ?? "RUNNING";
		if (status === "DONE" || status === "SUCCESS") {
			let videoUrl: string | undefined;
			let thumbnailUrl: string | undefined;
			let durationSec: number | undefined;
			try {
				const parsed = JSON.parse(resp.data?.resp_data ?? "{}");
				videoUrl = parsed.video_url ?? parsed.videoUrl;
				thumbnailUrl = parsed.cover_url ?? parsed.thumbnail_url;
				durationSec = parsed.duration ?? parsed.video_duration;
			} catch {
				// ignore parse failure
			}
			return { status: "DONE", videoUrl, thumbnailUrl, durationSec };
		}
		if (status === "FAILED" || status === "ERROR") {
			return { status: "FAILED", error: resp.data?.message ?? "unknown" };
		}
		return { status: "RUNNING" };
	}
}
