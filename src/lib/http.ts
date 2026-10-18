/** Small fetch wrapper for server-side provider calls: timeout + typed failures. Never used by the UI. */
export type ProviderErrorKind = "timeout" | "rate_limited" | "http" | "network" | "invalid_response" | "not_found";

export class ProviderError extends Error {
  constructor(public kind: ProviderErrorKind, message: string, public status?: number) {
    super(message);
    this.name = "ProviderError";
  }
}

export function envInt(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export async function fetchJson(
  url: string,
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch; headers?: Record<string, string> } = {}
): Promise<unknown> {
  const timeoutMs = opts.timeoutMs ?? envInt("PROVIDER_TIMEOUT_MS", 8000);
  const f = opts.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await f(url, { signal: ctrl.signal, headers: { Accept: "application/json", ...opts.headers } });
    if (res.status === 429) throw new ProviderError("rate_limited", "Provider rate limit reached", 429);
    if (res.status === 404) throw new ProviderError("not_found", "Not found", 404);
    if (!res.ok) throw new ProviderError("http", `Provider returned HTTP ${res.status}`, res.status);
    try {
      return await res.json();
    } catch {
      throw new ProviderError("invalid_response", "Provider returned invalid JSON");
    }
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    if (err instanceof Error && err.name === "AbortError") throw new ProviderError("timeout", `Provider timed out after ${timeoutMs}ms`);
    throw new ProviderError("network", err instanceof Error ? err.message : "Network error");
  } finally {
    clearTimeout(timer);
  }
}

export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new ProviderError("timeout", `${label} timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/** Runs `fn` over `items` with at most `limit` in flight; preserves order. */
export async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}
