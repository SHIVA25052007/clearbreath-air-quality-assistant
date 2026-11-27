interface CacheRecord<T> {
  expiresAt: number;
  value: T;
}

export class BoundedTtlCache<T> {
  private readonly store = new Map<string, CacheRecord<T>>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  constructor(options: { maxEntries: number; ttlMs: number }) {
    if (!Number.isInteger(options.maxEntries) || options.maxEntries < 1) {
      throw new Error('BoundedTtlCache maxEntries must be a positive integer.');
    }
    if (!Number.isFinite(options.ttlMs) || options.ttlMs <= 0) {
      throw new Error('BoundedTtlCache ttlMs must be a positive number.');
    }
    this.maxEntries = options.maxEntries;
    this.ttlMs = options.ttlMs;
  }

  get size(): number {
    return this.store.size;
  }

  pruneExpired(now = Date.now()): number {
    let removed = 0;
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
        removed++;
      }
    }
    return removed;
  }

  get(key: string, now = Date.now()): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt <= now) {
      this.store.delete(key);
      return undefined;
    }
    // Refresh insertion order for LRU eviction
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, now = Date.now()): void {
    this.pruneExpired(now);

    if (this.store.has(key)) {
      this.store.delete(key);
    }
    while (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey === undefined) break;
      this.store.delete(oldestKey);
    }

    this.store.set(key, {
      expiresAt: now + this.ttlMs,
      value,
    });
  }
}
