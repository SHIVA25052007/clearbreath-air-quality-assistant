interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export interface RateLimiter {
  check: (key: string, now?: number) => RateLimitResult;
  size: () => number;
}

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  maxTrackedKeys?: number;
}): RateLimiter {
  const windowMs = options.windowMs;
  const maxRequests = options.maxRequests;
  const maxTrackedKeys = options.maxTrackedKeys ?? 2000;
  const buckets = new Map<string, RateLimitBucket>();

  function pruneExpired(now: number): void {
    for (const [k, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) {
        buckets.delete(k);
      }
    }
  }

  return {
    check(key: string, now = Date.now()): RateLimitResult {
      const normalizedKey = key || 'unknown';
      const existing = buckets.get(normalizedKey);

      if (!existing || existing.resetAt <= now) {
        if (buckets.size >= maxTrackedKeys) {
          pruneExpired(now);
        }
        while (buckets.size >= maxTrackedKeys) {
          const oldest = buckets.keys().next().value;
          if (oldest === undefined) break;
          buckets.delete(oldest);
        }
        buckets.set(normalizedKey, {
          count: 1,
          resetAt: now + windowMs,
        });
        return {
          allowed: true,
          remaining: Math.max(0, maxRequests - 1),
          retryAfterSec: 0,
        };
      }

      if (existing.count >= maxRequests) {
        const retryAfterMs = Math.max(1000, existing.resetAt - now);
        return {
          allowed: false,
          remaining: 0,
          retryAfterSec: Math.ceil(retryAfterMs / 1000),
        };
      }

      existing.count += 1;
      // Refresh recency
      buckets.delete(normalizedKey);
      buckets.set(normalizedKey, existing);

      return {
        allowed: true,
        remaining: Math.max(0, maxRequests - existing.count),
        retryAfterSec: 0,
      };
    },
    size(): number {
      return buckets.size;
    },
  };
}
