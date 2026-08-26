// src/middleware/rateLimiting.js - Advanced Rate Limiting with Redis
const { getRedisClient } = require('../config/redis');

// Rate limit configuration
const createRateLimiter = (options = {}) => {
  const {
    windowMs = 60000, // 1 minute default
    max = 100, // Max requests per window
    keyPrefix = 'ratelimit',
    message = 'Too many requests, please try again later.',
    headers = true,
    skipFailedRequests = false,
    skipSuccessfulRequests = false,
  } = options;

  return async (req, res, next) => {
    try {
      const redis = getRedisClient();

      // Fallback to in-memory if Redis not available
      if (!redis) {
        return simpleRateLimiter(req, res, next, options);
      }

      // Build rate limit key
      const userId = req.user?.id || req.ip;
      const orgId = req.organizationId ? `:org:${req.organizationId}` : '';
      const key = `${keyPrefix}:${userId}${orgId}:${Math.floor(Date.now() / windowMs)}`;

      // Increment counter
      const current = await redis.incr(key);

      // Set expiry on first request
      if (current === 1) {
        await redis.expire(key, Math.ceil(windowMs / 1000));
      }

      // Set rate limit headers
      if (headers) {
        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, max - current));
        res.setHeader('X-RateLimit-Reset', Math.ceil((Date.now() + windowMs) / 1000));
      }

      // Check if over limit
      if (current > max) {
        return res.status(429).json({
          success: false,
          error: message,
          retryAfter: Math.ceil(windowMs / 1000),
        });
      }

      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      // On error, allow request (fail open)
      next();
    }
  };
};

// In-memory fallback rate limiter
const simpleRateLimiter = (req, res, next, options) => {
  const { windowMs = 60000, max = 100, keyPrefix = 'ratelimit' } = options;

  const userId = req.user?.id || req.ip;
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs);

  // Simple in-memory storage (not production-ready for distributed systems)
  if (!global.rateLimitStore) {
    global.rateLimitStore = new Map();
  }

  const key = `${keyPrefix}:${userId}:${windowStart}`;
  const record = global.rateLimitStore.get(key) || { count: 0, windowStart };

  if (record.windowStart !== windowStart) {
    record.count = 0;
    record.windowStart = windowStart;
  }

  record.count++;

  res.setHeader('X-RateLimit-Limit', max);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
  res.setHeader('X-RateLimit-Reset', Math.ceil((windowStart + 1) * windowMs / 1000));

  global.rateLimitStore.set(key, record);

  if (record.count > max) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests, please try again later.',
      retryAfter: Math.ceil(windowMs / 1000),
    });
  }

  next();
};

// Specific rate limiters for different endpoints

// Authentication endpoints (stricter limits)
const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per 15 minutes
  keyPrefix: 'ratelimit:auth',
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
});

// General API endpoints
const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  keyPrefix: 'ratelimit:api',
});

// Strict endpoint rate limiter (for sensitive operations)
const strictRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  keyPrefix: 'ratelimit:strict',
  message: 'Too many requests. Please slow down.',
});

// Per-organization rate limiter
const orgRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // Higher limit for organizations
  keyPrefix: 'ratelimit:org',
  message: 'Organization rate limit exceeded. Please try again later.',
});

// Read-only endpoints (higher limits)
const readRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // 200 requests per minute
  keyPrefix: 'ratelimit:read',
});

// Write endpoints (stricter limits)
const writeRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // 50 requests per minute
  keyPrefix: 'ratelimit:write',
  message: 'Too many write requests. Please try again later.',
});

// File upload rate limiter
const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour
  keyPrefix: 'ratelimit:upload',
  message: 'Upload limit reached. Please try again later.',
});

module.exports = {
  createRateLimiter,
  authRateLimiter,
  apiRateLimiter,
  strictRateLimiter,
  orgRateLimiter,
  readRateLimiter,
  writeRateLimiter,
  uploadRateLimiter,
};