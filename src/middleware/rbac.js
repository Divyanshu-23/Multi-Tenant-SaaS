// src/middleware/rbac.js - Role-Based Access Control middleware
const { Member } = require('../models');

// RBAC Middleware - Check if user has required role(s)
const checkRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      const { user, organizationId } = req;

      // If no organization context, allow to proceed (some routes don't need org)
      if (!organizationId) {
        return next();
      }

      // Find member record to get user's role in this organization
      const member = await Member.findOne({
        userId: user.id,
        organizationId: organizationId,
        status: 'active',
      });

      if (!member) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You are not a member of this organization.',
        });
      }

      // Check if user's role is in the allowed roles
      if (!allowedRoles.includes(member.role)) {
        return res.status(403).json({
          success: false,
          error: `Access denied. This endpoint requires one of the following roles: ${allowedRoles.join(', ')}.`,
        });
      }

      // Add member info to request for permission checks
      req.member = member;
      next();
    } catch (error) {
      console.error('RBAC check error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error during authorization',
      });
    }
  };
};

// Permission-based middleware
const checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      const { user, organizationId, member } = req;

      // If no organization context, allow to proceed
      if (!organizationId || !member) {
        return next();
      }

      // Check if user has the required permission
      const hasPermission = member.permissions[permission];

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: `Access denied. You do not have the required permission: ${permission}`,
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error during authorization',
      });
    }
  };
};

// Owner check middleware
const checkOwner = (resourceModel, resourceIdField) => {
  return async (req, res, next) => {
    try {
      const { user, organizationId } = req;
      const resourceId = req.params[resourceIdField] || req.body[resourceIdField];

      if (!resourceId) {
        return next(); // Skip if no resource ID
      }

      const resource = await resourceModel.findById(resourceId);

      if (!resource) {
        return res.status(404).json({
          success: false,
          error: 'Resource not found',
        });
      }

      // Check if user is the owner
      if (String(resource.createdBy) === String(user.id)) {
        req.isOwner = true;
        return next();
      }

      // Also check if user is admin of the organization
      const { Member } = require('../models');
      const member = await Member.findOne({
        userId: user.id,
        organizationId: resource.organizationId,
        role: 'admin',
        status: 'active',
      });

      if (member) {
        req.isAdmin = true;
        return next();
      }

      return res.status(403).json({
        success: false,
        error: 'Access denied. You are not the owner of this resource.',
      });
    } catch (error) {
      console.error('Owner check error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error during authorization',
      });
    }
  };
};

module.exports = {
  checkRole,
  checkPermission,
  checkOwner,
};