// src/workers/analyticsWorker.js - Analytics Queue Worker
const { queues, JOB_TYPES } = require('../config/queue');
const { Property, Task, Organization, User } = require('../models');
const { cacheStats } = require('../utils/cache');

// Process analytics jobs
queues.analytics.process(async (job) => {
  console.log(`📊 Processing analytics job: ${job.name} (${job.id})`);

  try {
    const { type, organizationId, userId } = job.data;

    let result;

    switch (type) {
      case 'daily_report':
        result = await generateDailyReport(organizationId);
        break;

      case 'property_stats':
        result = await generatePropertyStats(organizationId);
        break;

      case 'user_activity':
        result = await trackUserActivity(userId);
        break;

      default:
        throw new Error(`Unknown analytics type: ${type}`);
    }

    console.log(`✅ Analytics job completed: ${type}`);
    return result;
  } catch (error) {
    console.error(`Failed to process analytics job ${job.id}:`, error);
    throw error;
  }
});

// Generate daily report for organization
const generateDailyReport = async (organizationId) => {
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));

  // Get daily stats
  const [newProperties, completedTasks, pendingTasks, totalViews] = await Promise.all([
    Property.countDocuments({
      organizationId,
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    }),
    Task.countDocuments({
      organizationId,
      status: 'completed',
      updatedAt: { $gte: startOfDay, $lte: endOfDay },
    }),
    Task.countDocuments({
      organizationId,
      status: { $in: ['pending', 'in_progress'] },
    }),
    Property.aggregate([
      { $match: { organizationId } },
      { $group: { _id: null, totalViews: { $sum: '$views' } } },
    ]),
  ]);

  const stats = {
    date: today.toISOString().split('T')[0],
    organizationId,
    newProperties,
    completedTasks,
    pendingTasks,
    totalViews: totalViews[0]?.totalViews || 0,
  };

  // Cache the stats
  await cacheStats(organizationId, stats, 86400); // Cache for 24 hours

  console.log(`📊 Daily report generated for org ${organizationId}:`, stats);
  return stats;
};

// Generate property statistics
const generatePropertyStats = async (organizationId) => {
  const stats = await Property.aggregate([
    { $match: { organizationId: require('mongoose').Types.ObjectId(organizationId) } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
        totalViews: { $sum: '$views' },
        byStatus: { $push: { status: '$status', type: '$propertyType' } },
      },
    },
  ]);

  // Count by status
  const statusCounts = {};
  if (stats[0]) {
    stats[0].byStatus.forEach((item) => {
      statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
    });
  }

  const result = {
    organizationId,
    timestamp: new Date(),
    ...(stats[0] || {}),
    statusCounts,
  };

  console.log(`📊 Property stats generated for org ${organizationId}`);
  return result;
};

// Track user activity
const trackUserActivity = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  // Update last activity timestamp
  user.lastActivityAt = new Date();
  await user.save();

  console.log(`📊 User activity tracked for ${userId}`);
  return { userId, lastActivityAt: user.lastActivityAt };
};

// Event handlers
queues.analytics.on('completed', (job, result) => {
  console.log(`✅ Analytics job completed: ${job.name}`);
});

queues.analytics.on('failed', (job, error) => {
  console.error(`❌ Analytics job failed: ${job.name} (${job.id})`, error.message);
});

console.log('📊 Analytics worker started and ready to process jobs');

module.exports = queues.analytics;