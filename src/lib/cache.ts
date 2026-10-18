// Lightweight cache interface with TTL support.
// In development/test: uses in-memory Map store.
// In serverless production: optionally connects to Upstash Redis REST if configured.

type Entry = { value: unknown; expiresAt: number };
const store = new Map<string, Entry>();

function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const upstash = getUpstashConfig();
    if (upstash) {
      try {
        const res = await fetch(`${upstash.url}/get/${encodeURIComponent(key)}`, {
          headers: { Authorization: `Bearer ${upstash.token}` },
          signal: AbortSignal.timeout(2000),
        });
        if (res.ok) {
          const data = (await res.json()) as { result?: string | null };
          if (data.result !== null && data.result !== undefined) {
            try {
              return JSON.parse(data.result) as T;
            } catch {
              return data.result as unknown as T;
            }
          }
          return null;
        }
      } catch {
        // Fall back to in-memory store if network call fails
      }
    }

    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      store.delete(key);
      return null;
    }
    return entry.value as T;
  },

  async set<T>(key: string, value: T, ttlSeconds = 60): Promise<void> {
    const upstash = getUpstashConfig();
    if (upstash) {
      try {
        const payload = JSON.stringify(value);
        await fetch(`${upstash.url}/set/${encodeURIComponent(key)}?ex=${ttlSeconds}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${upstash.token}`, "Content-Type": "application/json" },
          body: payload,
          signal: AbortSignal.timeout(2000),
        });
      } catch {
        // Continue to set in-memory on error
      }
    }
    store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  },

  async del(key: string): Promise<void> {
    const upstash = getUpstashConfig();
    if (upstash) {
      try {
        await fetch(`${upstash.url}/del/${encodeURIComponent(key)}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${upstash.token}` },
          signal: AbortSignal.timeout(2000),
        });
      } catch {
        // Ignore
      }
    }
    store.delete(key);
  },

  async delByPrefix(prefix: string): Promise<void> {
    const upstash = getUpstashConfig();
    if (upstash) {
      try {
        const res = await fetch(`${upstash.url}/keys/${encodeURIComponent(prefix)}*`, {
          headers: { Authorization: `Bearer ${upstash.token}` },
          signal: AbortSignal.timeout(2000),
        });
        if (res.ok) {
          const data = (await res.json()) as { result?: string[] };
          if (Array.isArray(data.result) && data.result.length > 0) {
            for (const k of data.result) {
              await cache.del(k);
            }
          }
        }
      } catch {
        // Ignore
      }
    }
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  },

  async clear(): Promise<void> {
    store.clear();
  },
};

export function cacheKey(...parts: (string | number)[]): string {
  return parts.join(":");
}
