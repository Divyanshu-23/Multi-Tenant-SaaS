// src/workers/taskReminderWorker.js - Task Reminder Queue Worker
const { queues, JOB_TYPES } = require('../config/queue');
const { Task, User } = require('../models');
const { addJob } = require('../config/queue');

// Process task reminder jobs
queues.taskReminder.process(async (job) => {
  console.log(`⏰ Processing task reminder: ${job.name} (${job.id})`);

  try {
    const { taskId } = job.data;

    // Fetch task with assignee details
    const task = await Task.findById(taskId)
      .populate('assignee', 'firstName lastName email')
      .populate('propertyId', 'title');

    if (!task) {
      console.warn(`Task not found: ${taskId}`);
      return { success: false, reason: 'Task not found' };
    }

    // Check if task is still pending/in_progress
    if (!['pending', 'in_progress'].includes(task.status)) {
      console.log(`Task ${taskId} is already ${task.status}, skipping reminder`);
      return { success: false, reason: `Task already ${task.status}` };
    }

    // Check if task has assignee
    if (!task.assignee) {
      console.log(`Task ${taskId} has no assignee, skipping reminder`);
      return { success: false, reason: 'No assignee' };
    }

    // Send reminder email
    await addJob('email', JOB_TYPES.EMAIL_TASK_REMINDER, {
      type: 'taskReminder',
      to: task.assignee.email,
      data: {
        user: task.assignee,
        task: {
          _id: task._id,
          title: task.title,
          priority: task.priority,
          dueDate: task.dueDate,
          status: task.status,
        },
      },
    });

    console.log(`✅ Reminder sent for task ${taskId} to ${task.assignee.email}`);

    return { success: true, taskId, sentTo: task.assignee.email };
  } catch (error) {
    console.error(`Failed to process task reminder ${job.id}:`, error);
    throw error;
  }
});

// Event handlers
queues.taskReminder.on('completed', (job, result) => {
  if (result.success) {
    console.log(`✅ Task reminder completed: ${job.data.taskId}`);
  }
});

queues.taskReminder.on('failed', (job, error) => {
  console.error(`❌ Task reminder failed: ${job.name} (${job.id})`, error.message);
});

console.log('⏰ Task reminder worker started and ready to process jobs');

module.exports = queues.taskReminder;