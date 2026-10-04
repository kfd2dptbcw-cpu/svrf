import { env } from "@/lib/env";

export class HttpError extends Error {
  override name = "HttpError";
  constructor(
    message: string,
    readonly status: number | null,
    /** Seconds the upstream asked us to wait (HTTP 429 / 503 Retry-After). */
    readonly retryAfter: number | null = null,
  ) {
    super(message);
  }

  get isRateLimit() {
    return this.status === 429;
  }
}

export interface FetchJsonOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  signal?: AbortSignal;
  /** Label used in error messages, e.g. "Open-Meteo Marine". */
  label?: string;
}

/**
 * fetch() + JSON with a hard timeout, bounded exponential-backoff retries for
 * transient failures (network errors, timeouts, 5xx) and explicit handling of
 * rate limits. 4xx responses other than 408/429 are not retried — they will
 * not succeed on a second attempt.
 */
export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const label = options.label ?? new URL(url).host;
  const retries = options.retries ?? env.httpRetries;
  const timeoutMs = options.timeoutMs ?? env.httpTimeoutMs;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(backoffMs(attempt, lastError));
    try {
      const signals = [AbortSignal.timeout(timeoutMs), options.signal].filter((s): s is AbortSignal => Boolean(s));
      const response = await fetch(url, {
        headers: { Accept: "application/json", ...options.headers },
        signal: AbortSignal.any(signals),
      });

      if (!response.ok) {
        const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
        const body = await response.text().catch(() => "");
        const error = new HttpError(
          `${label} responded ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
          response.status,
          retryAfter,
        );
        if (!isRetryableStatus(response.status)) throw error;
        // Don't sit in a request waiting out a long rate-limit window.
        if (retryAfter !== null && retryAfter > 30) throw error;
        lastError = error;
        continue;
      }
      return (await response.json()) as T;
    } catch (error) {
      if (options.signal?.aborted) throw error;
      if (error instanceof HttpError && !isRetryableStatus(error.status ?? 0)) throw error;
      if (error instanceof HttpError && error.retryAfter !== null && error.retryAfter > 30) throw error;
      lastError = normaliseError(error, label, timeoutMs);
    }
  }
  throw lastError instanceof Error ? lastError : new HttpError(`${label} request failed`, null);
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function backoffMs(attempt: number, lastError: unknown): number {
  if (lastError instanceof HttpError && lastError.retryAfter !== null) return lastError.retryAfter * 1000;
  return Math.min(500 * 2 ** (attempt - 1), 4000) + Math.floor(Math.random() * 250);
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds);
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

function normaliseError(error: unknown, label: string, timeoutMs: number): Error {
  if (error instanceof HttpError) return error;
  if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return new HttpError(`${label} timed out after ${timeoutMs}ms`, null);
  }
  return new HttpError(`${label} is unreachable: ${error instanceof Error ? error.message : String(error)}`, null);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
