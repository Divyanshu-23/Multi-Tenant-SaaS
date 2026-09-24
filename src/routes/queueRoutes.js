// src/routes/queueRoutes.js - Queue Management & Monitoring API
const express = require('express');
const { auth, orgContext, requireOrgContext } = require('../middleware/auth');
const {
  QUEUE_NAMES,
  JOB_TYPES,
  addJob,
  getQueueStatus,
  getAllQueuesStatus,
  pauseQueue,
  resumeQueue,
  cleanQueue,
} = require('../config/queue');

const router = express.Router();

// Require authentication and organization membership for all queue operations
router.use(auth, orgContext, requireOrgContext);

// @route   GET /api/queues - Get all queues status
// @desc    Get status of all background job queues
// @access  Private (Admin only)
router.get('/', async (req, res) => {
  try {
    const statuses = await getAllQueuesStatus();
    res.json({
      success: true,
      queues: statuses,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Get queues status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get queue statuses' });
  }
});

// @route   GET /api/queues/:queueName - Get specific queue status
// @desc    Get detailed status of a specific queue
// @access  Private (Admin only)
router.get('/:queueName', async (req, res) => {
  try {
    const { queueName } = req.params;

    const status = await getQueueStatus(queueName);
    if (!status) {
      return res.status(404).json({ success: false, error: 'Queue not found' });
    }

    res.json({
      success: true,
      queue: status,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Get queue status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get queue status' });
  }
});

// @route   POST /api/queues/:queueName/pause - Pause queue
// @desc    Pause a job queue (prevents processing of new jobs)
// @access  Private (Admin only)
router.post('/:queueName/pause', async (req, res) => {
  try {
    const { queueName } = req.params;

    await pauseQueue(queueName);

    res.json({
      success: true,
      message: `Queue ${queueName} paused successfully`,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Pause queue error:', error);
    res.status(500).json({ success: false, error: 'Failed to pause queue' });
  }
});

// @route   POST /api/queues/:queueName/resume - Resume queue
// @desc    Resume a paused job queue
// @access  Private (Admin only)
router.post('/:queueName/resume', async (req, res) => {
  try {
    const { queueName } = req.params;

    await resumeQueue(queueName);

    res.json({
      success: true,
      message: `Queue ${queueName} resumed successfully`,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Resume queue error:', error);
    res.status(500).json({ success: false, error: 'Failed to resume queue' });
  }
});

// @route   POST /api/queues/:queueName/clean - Clean queue
// @desc    Remove completed or failed jobs from queue
// @access  Private (Admin only)
router.post('/:queueName/clean', async (req, res) => {
  try {
    const { queueName } = req.params;
    const { status = 'completed' } = req.body;

    await cleanQueue(queueName, 0, status);

    res.json({
      success: true,
      message: `Queue ${queueName} cleaned (${status} jobs removed)`,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Clean queue error:', error);
    res.status(500).json({ success: false, error: 'Failed to clean queue' });
  }
});

// @route   POST /api/queues/test-email - Send test email
// @desc    Send a test email to verify email service
// @access  Private (Admin only)
router.post('/test-email', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email address required' });
    }

    const job = await addJob('email', JOB_TYPES.EMAIL_WELCOME, {
      type: 'welcome',
      to: email,
      data: {
        user: { firstName: 'Test User' },
        org: { name: 'Test Organization' },
      },
    });

    res.json({
      success: true,
      message: 'Test email job queued',
      jobId: job.id,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ success: false, error: 'Failed to queue test email' });
  }
});

// @route   POST /api/queues/schedule-cleanup - Schedule cleanup job
// @desc    Trigger immediate cleanup job
// @access  Private (Admin only)
router.post('/schedule-cleanup', async (req, res) => {
  try {
    const { type = 'old_logs' } = req.body;

    const job = await addJob('cleanup', `cleanup.${type}`, { type });

    res.json({
      success: true,
      message: `Cleanup job queued: ${type}`,
      jobId: job.id,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Schedule cleanup error:', error);
    res.status(500).json({ success: false, error: 'Failed to schedule cleanup' });
  }
});

// @route   GET /api/queues/stats/overview - Queue statistics
// @desc    Get overview of all queue statistics
// @access  Private (Admin only)
router.get('/stats/overview', async (req, res) => {
  try {
    const statuses = await getAllQueuesStatus();

    const overview = {
      totalQueues: Object.keys(statuses).length,
      totalWaiting: 0,
      totalActive: 0,
      totalCompleted: 0,
      totalFailed: 0,
      totalDelayed: 0,
      queues: statuses,
    };

    // Sum up all queue stats
    Object.values(statuses).forEach((queue) => {
      overview.totalWaiting += queue.waiting;
      overview.totalActive += queue.active;
      overview.totalCompleted += queue.completed;
      overview.totalFailed += queue.failed;
      overview.totalDelayed += queue.delayed;
    });

    res.json({
      success: true,
      overview,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Get queue statistics error:', error);
    res.status(500).json({ success: false, error: 'Failed to get queue statistics' });
  }
});

module.exports = router;
