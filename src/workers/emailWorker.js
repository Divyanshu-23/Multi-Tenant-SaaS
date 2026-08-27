// src/workers/emailWorker.js - Email Queue Worker
const { queues, JOB_TYPES } = require('../config/queue');
const { processEmailJob } = require('../services/emailService');

// Process email jobs
queues.email.process(async (job) => {
  console.log(`📧 Processing email job: ${job.name} (${job.id})`);

  try {
    // Update progress
    await job.progress(10);

    // Process email based on job type
    const result = await processEmailJob(job);

    // Update progress
    await job.progress(100);

    return result;
  } catch (error) {
    console.error(`Failed to process email job ${job.id}:`, error);
    throw error;
  }
});

// Event handlers
queues.email.on('completed', (job, result) => {
  console.log(`✅ Email job completed: ${job.name} - ${result.to}`);
});

queues.email.on('failed', (job, error) => {
  console.error(`❌ Email job failed: ${job.name} (${job.id})`, error.message);
});

queues.email.on('stalled', (job) => {
  console.warn(`⚠️ Email job stalled: ${job.name} (${job.id})`);
});

console.log('📧 Email worker started and ready to process jobs');

module.exports = queues.email;