// src/config/queue.js - Bull Queue Configuration for Background Jobs
const Bull = require('bull');
const { redisClient } = require('./redis');

// Job queues configuration
const queues = {
  // Email notification queue
  email: new Bull('email-queue', {
    redis: {
      port: process.env.REDIS_PORT || 6379,
      host: process.env.REDIS_HOST || '127.0.0.1',
      password: process.env.REDIS_PASSWORD || undefined,
      db: 0,
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
      timeout: 30000,
    },
  }),

  // Task reminder queue
  taskReminder: new Bull('task-reminder-queue', {
    redis: {
      port: process.env.REDIS_PORT || 6379,
      host: process.env.REDIS_HOST || '127.0.0.1',
      password: process.env.REDIS_PASSWORD || undefined,
      db: 0,
    },
    defaultJobOptions: {
      attempts: 2,
      removeOnComplete: 50,
      removeOnFail: 30,
      delay: 60000, // Default 1 minute delay for testing
    },
  }),

  // Property analytics queue
  analytics: new Bull('analytics-queue', {
    redis: {
      port: process.env.REDIS_PORT || 6379,
      host: process.env.REDIS_HOST || '127.0.0.1',
      password: process.env.REDIS_PASSWORD || undefined,
      db: 0,
    },
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: 10,
      removeOnFail: 10,
    },
  }),

  // Cleanup and maintenance queue
  cleanup: new Bull('cleanup-queue', {
    redis: {
      port: process.env.REDIS_PORT || 6379,
      host: process.env.REDIS_HOST || '127.0.0.1',
      password: process.env.REDIS_PASSWORD || undefined,
      db: 0,
    },
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: 5,
      removeOnFail: 5,
    },
  }),
};

// Queue names for reference
const QUEUE_NAMES = {
  EMAIL: 'email-queue',
  TASK_REMINDER: 'task-reminder-queue',
  ANALYTICS: 'analytics-queue',
  CLEANUP: 'cleanup-queue',
};

// Job types
const JOB_TYPES = {
  // Email jobs
  EMAIL_WELCOME: 'email.welcome',
  EMAIL_TASK_ASSIGNED: 'email.task_assigned',
  EMAIL_TASK_REMINDER: 'email.task_reminder',
  EMAIL_TASK_COMPLETED: 'email.task_completed',
  EMAIL_PROPERTY_UPDATE: 'email.property_update',
  EMAIL_MEMBER_INVITATION: 'email.member_invitation',
  EMAIL_PASSWORD_RESET: 'email.password_reset',
  EMAIL_DAILY_DIGEST: 'email.daily_digest',

  // Reminder jobs
  REMINDER_TASK_DUE: 'reminder.task_due',
  REMINDER_FOLLOW_UP: 'reminder.follow_up',

  // Analytics jobs
  ANALYTICS_DAILY_REPORT: 'analytics.daily_report',
  ANALYTICS_PROPERTY_STATS: 'analytics.property_stats',

  // Cleanup jobs
  CLEANUP_EXPIRED_TOKENS: 'cleanup.expired_tokens',
  CLEANUP_OLD_LOGS: 'cleanup.old_logs',
  CLEANUP_TEMP_FILES: 'cleanup.temp_files',
};

// Add job to queue
const addJob = async (queueName, jobType, data, options = {}) => {
  try {
    const queue = queues[queueName];
    if (!queue) {
      throw new Error(`Queue '${queueName}' not found`);
    }

    const job = await queue.add(jobType, data, {
      jobId: `${jobType}-${Date.now()}`,
      ...options,
    });

    console.log(`✅ Job added to ${queueName}: ${jobType}`, job.id);
    return job;
  } catch (error) {
    console.error(`❌ Failed to add job to ${queueName}:`, error);
    throw error;
  }
};

// Get queue status
const getQueueStatus = async (queueName) => {
  try {
    const queue = queues[queueName];
    if (!queue) {
      throw new Error(`Queue '${queueName}' not found`);
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      name: queueName,
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: queue.paused,
    };
  } catch (error) {
    console.error(`Failed to get queue status for ${queueName}:`, error);
    throw error;
  }
};

// Get all queues status
const getAllQueuesStatus = async () => {
  const statuses = {};
  for (const [name, queue] of Object.entries(queues)) {
    statuses[name] = await getQueueStatus(name);
  }
  return statuses;
};

// Pause queue
const pauseQueue = async (queueName) => {
  const queue = queues[queueName];
  if (queue) {
    await queue.pause();
    console.log(`⏸️ Queue paused: ${queueName}`);
  }
};

// Resume queue
const resumeQueue = async (queueName) => {
  const queue = queues[queueName];
  if (queue) {
    await queue.resume();
    console.log(`▶️ Queue resumed: ${queueName}`);
  }
};

// Clean queue
const cleanQueue = async (queueName, grace = 0, status = 'completed') => {
  const queue = queues[queueName];
  if (queue) {
    await queue.clean(grace, status);
    console.log(`🧹 Queue cleaned: ${queueName} (${status})`);
  }
};

// Event listeners for all queues
const setupQueueEvents = () => {
  Object.entries(queues).forEach(([name, queue]) => {
    // Job completed
    queue.on('completed', (job, result) => {
      console.log(`✅ Job completed: ${name} - ${job.name} (${job.id})`);
    });

    // Job failed
    queue.on('failed', (job, error) => {
      console.error(`❌ Job failed: ${name} - ${job.name} (${job.id})`, error.message);
    });

    // Job progress
    queue.on('progress', (job, progress) => {
      console.log(`📊 Job progress: ${name} - ${job.name} (${job.id}) - ${progress}%`);
    });

    // Job error
    queue.on('error', (error) => {
      console.error(`🚨 Queue error: ${name}`, error.message);
    });

    // Worker stalled
    queue.on('stalled', (job) => {
      console.warn(`⚠️ Job stalled: ${name} - ${job.name} (${job.id})`);
    });

    console.log(`📋 Queue event listeners setup: ${name}`);
  });
};

module.exports = {
  queues,
  QUEUE_NAMES,
  JOB_TYPES,
  addJob,
  getQueueStatus,
  getAllQueuesStatus,
  pauseQueue,
  resumeQueue,
  cleanQueue,
  setupQueueEvents,
};