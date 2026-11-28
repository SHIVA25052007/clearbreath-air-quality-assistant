import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { createRateLimiter } from '../../utils/rateLimiter.ts';
import {
  AI_RATE_LIMIT_MAX_KEYS,
  AI_RATE_LIMIT_MAX_REQUESTS,
  AI_RATE_LIMIT_WINDOW_MS,
} from '../constants.ts';

export interface RateLimitMiddlewareOptions {
  windowMs?: number;
  maxRequests?: number;
  maxTrackedKeys?: number;
  errorPrefix?: string;
}

export function extractClientIp(req: Pick<Request, 'ip' | 'socket'>): string {
  const raw = req.ip || req.socket?.remoteAddress || 'unknown';
  return raw.startsWith('::ffff:') ? raw.slice(7) : raw;
}

export function createRateLimitMiddleware(
  options: RateLimitMiddlewareOptions = {}
): RequestHandler {
  const maxRequests = options.maxRequests ?? AI_RATE_LIMIT_MAX_REQUESTS;
  const errorPrefix = options.errorPrefix ?? 'Too many AI requests';
  const limiter = createRateLimiter({
    windowMs: options.windowMs ?? AI_RATE_LIMIT_WINDOW_MS,
    maxRequests,
    maxTrackedKeys: options.maxTrackedKeys ?? AI_RATE_LIMIT_MAX_KEYS,
  });

  return function enforceRateLimit(req: Request, res: Response, next: NextFunction): void {
    const clientKey = extractClientIp(req);
    const result = limiter.check(clientKey);
    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));
    if (!result.allowed) {
      res.setHeader('Retry-After', String(result.retryAfterSec));
      res.status(429).json({
        error: `${errorPrefix}. Please wait ${result.retryAfterSec} seconds before trying again.`,
      });
      return;
    }
    next();
  };
}

export function createAiRateLimitMiddleware(
  options: RateLimitMiddlewareOptions = {}
): RequestHandler {
  return createRateLimitMiddleware({
    errorPrefix: 'Too many AI requests',
    ...options,
  });
}
