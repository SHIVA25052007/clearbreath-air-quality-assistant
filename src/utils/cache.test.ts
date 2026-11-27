import test from 'node:test';
import assert from 'node:assert/strict';
import { BoundedTtlCache } from './cache';

test('BoundedTtlCache removes expired entries on get and pruneExpired', () => {
  const cache = new BoundedTtlCache<string>({ maxEntries: 5, ttlMs: 1000 });
  cache.set('delhi', 'value-1', 1000);
  cache.set('lahore', 'value-2', 1500);

  assert.equal(cache.get('delhi', 1500), 'value-1');
  assert.equal(cache.get('delhi', 2000), undefined);
  assert.equal(cache.size, 1);

  assert.equal(cache.pruneExpired(2500), 1);
  assert.equal(cache.size, 0);
});

test('BoundedTtlCache enforces maxEntries using LRU eviction', () => {
  const cache = new BoundedTtlCache<number>({ maxEntries: 2, ttlMs: 10_000 });
  cache.set('a', 1, 100);
  cache.set('b', 2, 100);
  // Access 'a' so 'b' becomes least recently used
  assert.equal(cache.get('a', 200), 1);

  cache.set('c', 3, 300);
  assert.equal(cache.size, 2);
  assert.equal(cache.get('b', 300), undefined);
  assert.equal(cache.get('a', 300), 1);
  assert.equal(cache.get('c', 300), 3);
});
