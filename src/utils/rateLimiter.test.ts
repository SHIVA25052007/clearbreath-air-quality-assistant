import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from './rateLimiter';

test('createRateLimiter enforces maxRequests per window and resets after expiry', () => {
  const limiter = createRateLimiter({ windowMs: 10_000, maxRequests: 2, maxTrackedKeys: 5 });

  const first = limiter.check('1.2.3.4', 1000);
  assert.equal(first.allowed, true);
  assert.equal(first.remaining, 1);

  const second = limiter.check('1.2.3.4', 2000);
  assert.equal(second.allowed, true);
  assert.equal(second.remaining, 0);

  const third = limiter.check('1.2.3.4', 3000);
  assert.equal(third.allowed, false);
  assert.equal(third.retryAfterSec, 8);

  // Separate client IP is unaffected
  assert.equal(limiter.check('5.6.7.8', 3000).allowed, true);

  // After window expires, bucket resets
  const afterWindow = limiter.check('1.2.3.4', 11_000);
  assert.equal(afterWindow.allowed, true);
  assert.equal(afterWindow.remaining, 1);
});

test('createRateLimiter bounds tracked keys to maxTrackedKeys', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 5, maxTrackedKeys: 3 });
  limiter.check('ip-1', 1000);
  limiter.check('ip-2', 1000);
  limiter.check('ip-3', 1000);
  limiter.check('ip-4', 1000);

  assert.equal(limiter.size(), 3);
});
