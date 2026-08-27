// src/workers/cleanupWorker.js - Cleanup & Maintenance Queue Worker
const { queues, JOB_TYPES } = require('../config/queue');
const fs = require('fs');
const path = require('path');
const { AuditLog, User } = require('../models');

// Process cleanup jobs
queues.cleanup.process(async (job) => {
  console.log(`🧹 Processing cleanup job: ${job.name} (${job.id})`);

  try {
    const { type } = job.data;

    let result;

    switch (type) {
      case 'expired_tokens':
        result = await cleanExpiredTokens();
        break;

      case 'old_logs':
        result = await cleanOldAuditLogs();
        break;

      case 'temp_files':
        result = await cleanTempFiles();
        break;

      case 'stale_sessions':
        result = await cleanStaleSessions();
        break;

      default:
        throw new Error(`Unknown cleanup type: ${type}`);
    }

    console.log(`✅ Cleanup job completed: ${type}`);
    return result;
  } catch (error) {
    console.error(`Failed to process cleanup job ${job.id}:`, error);
    throw error;
  }
});

// Clean expired reset tokens
const cleanExpiredTokens = async () => {
  try {
    const result = await User.updateMany(
      { 'resetToken.expiresAt': { $lt: new Date() } },
      { $unset: { resetToken: 1 } }
    );

    console.log(`🧹 Cleaned ${result.modifiedCount} expired reset tokens`);
    return { cleaned: result.modifiedCount, type: 'expired_tokens' };
  } catch (error) {
    console.error('Failed to clean expired tokens:', error);
    throw error;
  }
};

// Clean old audit logs (older than 90 days)
const cleanOldAuditLogs = async () => {
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const result = await AuditLog.deleteMany({
      createdAt: { $lt: ninetyDaysAgo },
    });

    console.log(`🧹 Cleaned ${result.deletedCount} audit logs older than 90 days`);
    return { deleted: result.deletedCount, type: 'old_logs' };
  } catch (error) {
    console.error('Failed to clean old audit logs:', error);
    throw error;
  }
};

// Clean temporary/orphaned files
const cleanTempFiles = async () => {
  try {
    const uploadsDir = path.join(__dirname, '../../uploads');
    let deletedCount = 0;

    // Check each subdirectory
    const subdirs = ['properties', 'tasks', 'avatars', 'documents'];

    for (const subdir of subdirs) {
      const subdirPath = path.join(uploadsDir, subdir);

      if (!fs.existsSync(subdirPath)) continue;

      const files = fs.readdirSync(subdirPath);

      for (const file of files) {
        const filePath = path.join(subdirPath, file);
        const stats = fs.statSync(filePath);

        // Delete files older than 30 days
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        if (Date.now() - stats.mtimeMs > thirtyDaysMs) {
          fs.unlinkSync(filePath);
          deletedCount++;
          console.log(`  Deleted: ${file}`);
        }
      }
    }

    console.log(`🧹 Cleaned ${deletedCount} temporary files older than 30 days`);
    return { deleted: deletedCount, type: 'temp_files' };
  } catch (error) {
    console.error('Failed to clean temp files:', error);
    throw error;
  }
};

// Clean stale user sessions
const cleanStaleSessions = async () => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await User.updateMany(
      { lastActivityAt: { $lt: thirtyDaysAgo } },
      { $set: { lastActivityAt: new Date() } }
    );

    console.log(`🧹 Cleaned ${result.modifiedCount} stale user sessions`);
    return { cleaned: result.modifiedCount, type: 'stale_sessions' };
  } catch (error) {
    console.error('Failed to clean stale sessions:', error);
    throw error;
  }
};

// Event handlers
queues.cleanup.on('completed', (job, result) => {
  console.log(`✅ Cleanup job completed: ${job.name}`);
});

queues.cleanup.on('failed', (job, error) => {
  console.error(`❌ Cleanup job failed: ${job.name} (${job.id})`, error.message);
});

console.log('🧹 Cleanup worker started and ready to process jobs');

module.exports = queues.cleanup;