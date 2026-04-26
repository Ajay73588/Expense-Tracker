// Lightweight in-memory cache with TTL. Mirrors the Redis interface used by services.
// TODO (production): swap this for a real Redis client (ioredis) via REDIS_URL.

type Entry = { value: unknown; expiresAt: number };
const store = new Map<string, Entry>();

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      store.delete(key);
      return null;
    }
    return entry.value as T;
  },

  async set<T>(key: string, value: T, ttlSeconds = 60): Promise<void> {
    store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  },

  async del(key: string): Promise<void> {
    store.delete(key);
  },

  async delByPrefix(prefix: string): Promise<void> {
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
