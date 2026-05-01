/**
 * Base HTTP client với retry + timeout + structured logging.
 * Used by all vendor-specific clients (byteplus.ts, gemini.ts, elevenlabs.ts, do-inference.ts).
 */

export interface BaseClientConfig {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  /** ms; default 30000 */
  timeout?: number;
  /** retry attempts on 5xx + network errors; default 2 */
  maxRetries?: number;
  /** ms between retries (exponential); default 500 */
  retryBaseDelay?: number;
}

export class BaseClient {
  protected baseUrl: string;
  protected defaultHeaders: Record<string, string>;
  protected timeout: number;
  protected maxRetries: number;
  protected retryBaseDelay: number;

  constructor(config: BaseClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.defaultHeaders = config.defaultHeaders ?? {};
    this.timeout = config.timeout ?? 30000;
    this.maxRetries = config.maxRetries ?? 2;
    this.retryBaseDelay = config.retryBaseDelay ?? 500;
  }

  async request<T = unknown>(
    path: string,
    options: RequestInit & { traceId?: string } = {},
  ): Promise<{ data: T; status: number; latencyMs: number }> {
    const url = path.startsWith("http") ? path : `${this.baseUrl}${path}`;
    const headers = { ...this.defaultHeaders, ...((options.headers as Record<string, string>) ?? {}) };

    let lastErr: Error | null = null;
    const start = Date.now();

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), this.timeout);

      try {
        const resp = await fetch(url, { ...options, headers, signal: ac.signal });
        clearTimeout(timer);

        const latencyMs = Date.now() - start;

        // 5xx → retry; 4xx → throw immediately (auth/validation issues won't recover)
        if (resp.status >= 500 && attempt < this.maxRetries) {
          await this.sleep(this.retryBaseDelay * 2 ** attempt);
          continue;
        }

        const text = await resp.text();
        let data: T;
        try {
          data = text ? (JSON.parse(text) as T) : (null as T);
        } catch {
          data = text as unknown as T;
        }

        if (!resp.ok) {
          throw new HttpError(resp.status, `${resp.status} ${resp.statusText}: ${text.slice(0, 200)}`, data);
        }

        return { data, status: resp.status, latencyMs };
      } catch (err) {
        clearTimeout(timer);
        lastErr = err instanceof Error ? err : new Error(String(err));

        // AbortError + network errors → retry; HttpError 4xx already thrown above
        if (lastErr.name === "AbortError" && attempt < this.maxRetries) {
          await this.sleep(this.retryBaseDelay * 2 ** attempt);
          continue;
        }
        if (lastErr instanceof HttpError) throw lastErr;
        if (attempt < this.maxRetries) {
          await this.sleep(this.retryBaseDelay * 2 ** attempt);
          continue;
        }
        throw lastErr;
      }
    }

    throw lastErr ?? new Error("Unknown request failure");
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
