// src/routes/adminRoutes.js - Admin Dashboard & System Management API
const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { User, Organization, Member, Property, Task, AuditLog } = require('../models');
const { auth, orgContext } = require('../middleware/auth');
const { checkRole } = require('../middleware/rbac');
const { getAllQueuesStatus } = require('../config/queue');
const { connectRedis, redisClient } = require('../config/redis');
const connectDB = require('../config/db');

const router = express.Router();

// Apply auth to all routes
router.use(auth);

// Admin-only routes
router.use(checkRole('admin'));

// @route   GET /api/admin/dashboard - Admin dashboard overview
// @desc    Get system overview statistics
// @access  Private (Admin only)
router.get('/dashboard', async (req, res) => {
  try {
    // Get aggregate statistics
    const [
      totalUsers,
      totalOrganizations,
      totalProperties,
      totalTasks,
      activeUsersToday,
      newUsersThisWeek,
    ] = await Promise.all([
      User.countDocuments(),
      Organization.countDocuments(),
      Property.countDocuments(),
      Task.countDocuments(),
      User.countDocuments({
        lastActivityAt: { $gte: new Date(Date.now() - 86400000) },
      }),
      User.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 7 * 86400000) },
      }),
    ]);

    // Get task status distribution
    const taskStatusCounts = await Task.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Get property status distribution
    const propertyStatusCounts = await Property.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Get organization size distribution
    const orgSizeDistribution = await Member.aggregate([
      { $group: { _id: '$organizationId', memberCount: { $sum: 1 } } },
      { $group: { _id: '$memberCount', orgsWithSize: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      overview: {
        totalUsers,
        totalOrganizations,
        totalProperties,
        totalTasks,
        activeUsersToday,
        newUsersThisWeek,
      },
      distributions: {
        tasksByStatus: taskStatusCounts,
        propertiesByStatus: propertyStatusCounts,
        organizationsBySize: orgSizeDistribution,
      },
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ success: false, error: 'Server error fetching dashboard' });
  }
});

// @route   GET /api/admin/health - System health check
// @desc    Check all system dependencies health
// @access  Private (Admin only)
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date(),
      services: {},
    };

    // Check MongoDB
    try {
      await connectDB();
      health.services.mongodb = { status: 'healthy', latency: 'OK' };
    } catch (error) {
      health.services.mongodb = { status: 'unhealthy', error: error.message };
      health.status = 'degraded';
    }

    // Check Redis
    try {
      const start = Date.now();
      await redisClient.ping();
      health.services.redis = {
        status: 'healthy',
        latency: `${Date.now() - start}ms`,
      };
    } catch (error) {
      health.services.redis = { status: 'unhealthy', error: error.message };
      health.status = 'degraded';
    }

    // Check queues
    try {
      const queueStatuses = await getAllQueuesStatus();
      health.services.queues = {
        status: 'healthy',
        queues: queueStatuses,
      };
    } catch (error) {
      health.services.queues = { status: 'unhealthy', error: error.message };
      health.status = 'degraded';
    }

    // Check memory usage
    const memUsage = process.memoryUsage();
    health.services.memory = {
      status: 'healthy',
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
    };

    // Check uptime
    health.services.uptime = {
      status: 'healthy',
      seconds: Math.round(process.uptime()),
      formatted: `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`,
    };

    res.json({ success: true, health });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ success: false, error: 'Server error checking health' });
  }
});

// @route   GET /api/admin/users - List all users
// @desc    Get paginated list of all users
// @access  Private (Admin only)
router.get('/users', [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('search').optional().trim(),
  query('status').optional().isIn(['active', 'inactive', 'suspended']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (req.query.search) {
      filter.$or = [
        { firstName: { $regex: req.query.search, $options: 'i' } },
        { lastName: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
      ];
    }
    if (req.query.status === 'active') {
      filter.isActive = true;
    } else if (req.query.status === 'inactive') {
      filter.isActive = false;
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    res.json({
      success: true,
      count: users.length,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
      users,
    });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ success: false, error: 'Server error listing users' });
  }
});

// @route   GET /api/admin/users/:id - Get user details
// @desc    Get detailed user information
// @access  Private (Admin only)
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Get user's organizations
    const memberships = await Member.find({ userId: user._id })
      .populate('organizationId', 'name status');

    // Get user activity stats
    const recentActivity = await AuditLog.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(10);

    // Get property and task counts
    const [propertyCount, taskCount] = await Promise.all([
      Property.countDocuments({ createdBy: user._id }),
      Task.countDocuments({ creator: user._id }),
    ]);

    res.json({
      success: true,
      user: {
        ...user.toObject(),
        memberships,
        stats: {
          properties: propertyCount,
          tasks: taskCount,
        },
        recentActivity,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, error: 'Server error fetching user' });
  }
});

// @route   PUT /api/admin/users/:id - Update user
// @desc    Update user details (admin override)
// @access  Private (Admin only)
router.put('/users/:id', [
  body('firstName').optional().trim().isLength({ min: 1, max: 50 }),
  body('lastName').optional().trim().isLength({ min: 1, max: 50 }),
  body('email').optional().isEmail(),
  body('isActive').optional().isBoolean(),
  body('role').optional().isIn(['user', 'admin']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      user,
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, error: 'Server error updating user' });
  }
});

// @route   DELETE /api/admin/users/:id - Delete user
// @desc    Soft delete user (deactivate)
// @access  Private (Admin only)
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Soft delete - just deactivate
    user.isActive = false;
    user.isDeleted = true;
    user.deletedAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'User deactivated successfully',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, error: 'Server error deleting user' });
  }
});

// @route   GET /api/admin/organizations - List all organizations
// @desc    Get paginated list of all organizations
// @access  Private (Admin only)
router.get('/organizations', [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('search').optional().trim(),
  query('status').optional().isIn(['active', 'suspended', 'trial', 'paid']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (req.query.search) {
      filter.name = { $regex: req.query.search, $options: 'i' };
    }
    if (req.query.status) {
      filter.status = req.query.status;
    }

    // Get organizations with member counts
    const [organizations, total] = await Promise.all([
      Organization.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Organization.countDocuments(filter),
    ]);

    // Add member counts
    const orgsWithMembers = await Promise.all(
      organizations.map(async (org) => {
        const memberCount = await Member.countDocuments({ organizationId: org._id });
        return {
          ...org.toObject(),
          memberCount,
        };
      })
    );

    res.json({
      success: true,
      count: organizations.length,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
      organizations: orgsWithMembers,
    });
  } catch (error) {
    console.error('List organizations error:', error);
    res.status(500).json({ success: false, error: 'Server error listing organizations' });
  }
});

// @route   PUT /api/admin/organizations/:id - Update organization
// @desc    Update organization details (admin override)
// @access  Private (Admin only)
router.put('/organizations/:id', [
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
  body('status').optional().isIn(['active', 'suspended', 'trial', 'paid']),
  body('settings.maxMembers').optional().isInt({ min: 1 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const org = await Organization.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!org) {
      return res.status(404).json({ success: false, error: 'Organization not found' });
    }

    res.json({
      success: true,
      message: 'Organization updated successfully',
      organization: org,
    });
  } catch (error) {
    console.error('Update organization error:', error);
    res.status(500).json({ success: false, error: 'Server error updating organization' });
  }
});

// @route   GET /api/admin/analytics - Platform analytics
// @desc    Get comprehensive platform usage analytics
// @access  Private (Admin only)
router.get('/analytics', [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
], async (req, res) => {
  try {
    const startDate = req.query.startDate
      ? new Date(req.query.startDate)
      : new Date(Date.now() - 30 * 86400000);
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();

    // User growth
    const userGrowth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Organization growth
    const orgGrowth = await Organization.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Property creation by day
    const propertyCreation = await Property.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Task completion by day
    const taskCompletion = await Task.aggregate([
      {
        $match: {
          status: 'completed',
          updatedAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Top organizations by properties
    const topOrgsByProperties = await Property.aggregate([
      {
        $group: {
          _id: '$organizationId',
          propertyCount: { $sum: 1 },
        },
      },
      { $sort: { propertyCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'organizations',
          localField: '_id',
          foreignField: '_id',
          as: 'org',
        },
      },
      { $unwind: '$org' },
      {
        $project: {
          name: '$org.name',
          propertyCount: 1,
        },
      },
    ]);

    res.json({
      success: true,
      analytics: {
        period: {
          start: startDate,
          end: endDate,
        },
        userGrowth,
        orgGrowth,
        propertyCreation,
        taskCompletion,
        topOrgsByProperties,
      },
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ success: false, error: 'Server error fetching analytics' });
  }
});

// @route   GET /api/admin/audit-logs - System audit logs
// @desc    Get audit trail for admin actions
// @access  Private (Admin only)
router.get('/audit-logs', [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('userId').optional(),
  query('action').optional(),
], async (req, res) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 50;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.action) filter.action = { $regex: req.query.action, $options: 'i' };

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('userId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      count: logs.length,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
      logs,
    });
  } catch (error) {
    console.error('Audit logs error:', error);
    res.status(500).json({ success: false, error: 'Server error fetching audit logs' });
  }
});

// @route   GET /api/admin/settings - Get system settings
// @desc    Get current system configuration
// @access  Private (Admin only)
router.get('/settings', async (req, res) => {
  try {
    res.json({
      success: true,
      settings: {
        // Environment
        nodeEnv: process.env.NODE_ENV,
        port: process.env.PORT,

        // Rate Limiting
        authRateLimit: process.env.AUTH_RATE_LIMIT || 10,
        apiRateLimit: process.env.API_RATE_LIMIT || 100,

        // Features
        enableEmailNotifications: process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'false',
        enableRealTime: process.env.ENABLE_REALTIME !== 'false',

        // Limits
        maxUploadSize: process.env.MAX_UPLOAD_SIZE || '5mb',
        maxPropertiesPerOrg: process.env.MAX_PROPERTIES_PER_ORG || 1000,
      },
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Settings error:', error);
    res.status(500).json({ success: false, error: 'Server error fetching settings' });
  }
});

module.exports = router;