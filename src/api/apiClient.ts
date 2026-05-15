const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const BACKOFF_BASE_MS = [500, 2_000, 5_000];
const RETRY_AFTER_CAP_MS = 60_000;

export type ApiClientOptions = {
  timeoutMs?: number;
  maxRetries?: number;
};

export class ApiClient {
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(readonly baseUrl: string = "", options: ApiClientOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  async get(endpoint: string, params?: URLSearchParams, headers?: Headers, body?: unknown) {
    return this.makeRequest("GET", endpoint, params, headers, body);
  }

  private async makeRequest(
    method: string,
    endpoint: string,
    params?: URLSearchParams,
    headers?: Headers,
    body?: unknown,
  ): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}${params ? `?${params}` : ""}`;
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(url, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        if (!RETRYABLE_STATUS.has(response.status) || attempt === this.maxRetries) {
          return response;
        }

        const delayMs = computeDelayMs(attempt, response.headers.get("retry-after"));
        console.warn(
          `Request to ${url} returned ${response.status}; retry ${attempt + 1}/${this.maxRetries} in ${delayMs}ms`,
        );
        await sleep(delayMs);
      } catch (error) {
        lastError = error;
        if (attempt === this.maxRetries) {
          throw error;
        }
        const delayMs = computeDelayMs(attempt, null);
        console.warn(
          `Request to ${url} failed (${describeError(error)}); retry ${attempt + 1}/${this.maxRetries} in ${delayMs}ms`,
        );
        await sleep(delayMs);
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError ?? new Error(`Request to ${url} failed after ${this.maxRetries} retries`);
  }
}

function computeDelayMs(attempt: number, retryAfterHeader: string | null): number {
  if (retryAfterHeader) {
    const seconds = Number.parseInt(retryAfterHeader, 10);
    if (!Number.isNaN(seconds) && seconds > 0) {
      return Math.min(seconds * 1_000, RETRY_AFTER_CAP_MS);
    }
  }
  const base = BACKOFF_BASE_MS[Math.min(attempt, BACKOFF_BASE_MS.length - 1)] ?? 5_000;
  return Math.floor(Math.random() * base);
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.name === "AbortError" ? "timeout" : error.message;
  }
  return String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
