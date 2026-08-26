// src/utils/cache.js - Redis caching utilities with automatic invalidation
const { getRedisClient } = require('../config/redis');

const DEFAULT_TTL = 3600; // 1 hour in seconds

// Get cache key with optional prefixes
const getKey = (...parts) => parts.join(':');

// Cache wrapper function
const cacheWrapper = async (key, callback, ttl = DEFAULT_TTL) => {
  try {
    const redis = getRedisClient();

    if (!redis) {
      // Redis not available, execute callback directly
      return await callback();
    }

    // Try to get from cache
    const cached = await redis.get(key);

    if (cached) {
      console.debug(`[CACHE HIT] ${key}`);
      return JSON.parse(cached);
    }

    // Cache miss, execute callback
    console.debug(`[CACHE MISS] ${key}`);
    const result = await callback();

    // Store in cache
    if (result !== undefined) {
      await redis.setEx(key, ttl, JSON.stringify(result));
    }

    return result;
  } catch (error) {
    console.error('Cache error:', error);
    // On cache error, execute callback without caching
    return await callback();
  }
};

// Invalidate cache by key pattern
const invalidatePattern = async (pattern) => {
  try {
    const redis = getRedisClient();

    if (!redis) return;

    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(keys);
      console.debug(`[CACHE INVALIDATED] ${keys.length} keys matching "${pattern}"`);
    }
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
};

// Invalidate specific keys
const invalidate = async (...keys) => {
  try {
    const redis = getRedisClient();

    if (!redis) return;

    const validKeys = keys.filter(Boolean);
    if (validKeys.length > 0) {
      await redis.del(validKeys);
      console.debug(`[CACHE INVALIDATED] ${validKeys.join(', ')}`);
    }
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
};

// Cache organization data
const cacheOrg = {
  get: (orgId) => cacheWrapper(getKey('org', orgId), null),

  set: async (orgId, data) => {
    const redis = getRedisClient();
    if (redis) {
      await redis.setEx(getKey('org', orgId), 1800, JSON.stringify(data)); // 30 min
    }
  },

  invalidate: (orgId) => invalidate(getKey('org', orgId)),
};

// Cache property list with filters
const cacheProperties = {
  get: (orgId, filters, page) => {
    const filterKey = Object.entries(filters).sort().map(([k, v]) => `${k}:${v}`).join('|');
    return cacheWrapper(getKey('properties', orgId, filterKey, page), null);
  },

  set: async (orgId, filters, page, data) => {
    const redis = getRedisClient();
    const filterKey = Object.entries(filters).sort().map(([k, v]) => `${k}:${v}`).join('|');

    if (redis) {
      await redis.setEx(getKey('properties', orgId, filterKey, page), 900, JSON.stringify(data)); // 15 min
    }
  },

  invalidate: (orgId) => invalidatePattern(getKey('properties', orgId, '*')),
};

// Cache single property
const cacheProperty = {
  get: (propertyId) => cacheWrapper(getKey('property', propertyId), null),

  set: async (propertyId, data) => {
    const redis = getRedisClient();
    if (redis) {
      await redis.setEx(getKey('property', propertyId), 1800, JSON.stringify(data)); // 30 min
    }
  },

  invalidate: (propertyId) => invalidate(getKey('property', propertyId)),
};

// Cache task list with filters
const cacheTasks = {
  get: (orgId, filters, page) => {
    const filterKey = Object.entries(filters).sort().map(([k, v]) => `${k}:${v}`).join('|');
    return cacheWrapper(getKey('tasks', orgId, filterKey, page), null);
  },

  set: async (orgId, filters, page, data) => {
    const redis = getRedisClient();
    const filterKey = Object.entries(filters).sort().map(([k, v]) => `${k}:${v}`).join('|');

    if (redis) {
      await redis.setEx(getKey('tasks', orgId, filterKey, page), 600, JSON.stringify(data)); // 10 min
    }
  },

  invalidate: (orgId) => invalidatePattern(getKey('tasks', orgId, '*')),
};

// Cache user session/token info
const cacheUser = {
  get: (userId) => cacheWrapper(getKey('user', userId), null),

  set: async (userId, data) => {
    const redis = getRedisClient();
    if (redis) {
      await redis.setEx(getKey('user', userId), 3600, JSON.stringify(data)); // 1 hour
    }
  },

  invalidate: (userId) => invalidate(getKey('user', userId)),
};

// Cache statistics
const cacheStats = {
  get: (orgId, type) => cacheWrapper(getKey('stats', orgId, type), null),

  set: async (orgId, type, data) => {
    const redis = getRedisClient();
    if (redis) {
      await redis.setEx(getKey('stats', orgId, type), 300, JSON.stringify(data)); // 5 min
    }
  },

  invalidate: (orgId, type) => invalidate(getKey('stats', orgId, type)),
};

module.exports = {
  cacheWrapper,
  invalidate,
  invalidatePattern,
  cacheOrg,
  cacheProperties,
  cacheProperty,
  cacheTasks,
  cacheUser,
  cacheStats,
  DEFAULT_TTL,
};