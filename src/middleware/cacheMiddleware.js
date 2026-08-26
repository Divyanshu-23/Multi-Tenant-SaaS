// src/middleware/cacheMiddleware.js - Caching middleware for routes
const {
  cacheProperties,
  cacheProperty,
  cacheTasks,
  cacheStats,
  invalidateProperties,
  invalidateTask,
  invalidateStats,
} = require('../utils/cache');

// Cache property list response
const cachePropertiesMiddleware = (duration = 900) => {
  return async (req, res, next) => {
    if (req.method !== 'GET') return next();

    const { organizationId } = req;
    if (!organizationId) return next();

    const filters = {
      status: req.query.status,
      propertyType: req.query.propertyType,
      listingType: req.query.listingType,
      city: req.query.city,
    };
    const page = req.query.page || 1;

    try {
      const cached = await cacheProperties.get(organizationId, filters, page);

      if (cached) {
        return res.json(cached);
      }

      // Store original json function
      const originalJson = res.json.bind(res);

      // Override to cache response
      res.json = (data) => {
        if (res.statusCode === 200) {
          cacheProperties.set(organizationId, filters, page, data);
        }
        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
};

// Cache single property response
const cachePropertyMiddleware = (duration = 1800) => {
  return async (req, res, next) => {
    if (req.method !== 'GET') return next();

    const { id } = req.params;
    if (!id) return next();

    try {
      const cached = await cacheProperty.get(id);

      if (cached) {
        return res.json(cached);
      }

      const originalJson = res.json.bind(res);

      res.json = (data) => {
        if (res.statusCode === 200) {
          cacheProperty.set(id, data);
        }
        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
};

// Cache task list response
const cacheTasksMiddleware = (duration = 600) => {
  return async (req, res, next) => {
    if (req.method !== 'GET') return next();

    const { organizationId } = req;
    if (!organizationId) return next();

    const filters = {
      status: req.query.status,
      priority: req.query.priority,
      taskType: req.query.taskType,
      assignee: req.query.assignee,
    };
    const page = req.query.page || 1;

    try {
      const cached = await cacheTasks.get(organizationId, filters, page);

      if (cached) {
        return res.json(cached);
      }

      const originalJson = res.json.bind(res);

      res.json = (data) => {
        if (res.statusCode === 200) {
          cacheTasks.set(organizationId, filters, page, data);
        }
        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
};

// Invalidate cache after mutations
const invalidateOnMutation = (model) => {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = (data) => {
      if (res.statusCode >= 200 && res.statusCode < 300 && data.success) {
        try {
          switch (model) {
            case 'property':
              if (req.organizationId) {
                cacheProperties.invalidate(req.organizationId);
              }
              if (req.params.id) {
                cacheProperty.invalidate(req.params.id);
              }
              break;
            case 'task':
              if (req.organizationId) {
                cacheTasks.invalidate(req.organizationId);
              }
              break;
            case 'stats':
              if (req.organizationId) {
                cacheStats.invalidate(req.organizationId, 'overview');
              }
              break;
          }
        } catch (error) {
          console.error('Cache invalidation error:', error);
        }
      }
      return originalJson(data);
    };

    next();
  };
};

module.exports = {
  cachePropertiesMiddleware,
  cachePropertyMiddleware,
  cacheTasksMiddleware,
  invalidateOnMutation,
};