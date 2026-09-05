/**
 * Queue Job Processing Tests
 * Tests queue configuration and job creation using Bull queue
 */
const Queue = require('bull');

// Mock Bull before requiring queue config
jest.mock('bull', () => {
  const mockQueue = jest.fn().mockImplementation((name, options) => ({
    name,
    options,
    add: jest.fn().mockResolvedValue({ id: 'mock-job-id', name: 'test-job', data: {} }),
    on: jest.fn(),
    process: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
    getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, completed: 1, failed: 0, delayed: 0 }),
    clean: jest.fn().mockResolvedValue([]),
  }));
  return mockQueue;
});

// Mock email service
jest.mock('../../src/services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'mock-123' }),
  processEmailJob: jest.fn().mockResolvedValue({ sent: true, type: 'welcome' }),
  templates: {
    welcome: jest.fn().mockReturnValue({ subject: 'Welcome', html: '<p>Welcome</p>' }),
    taskAssigned: jest.fn().mockReturnValue({ subject: 'Task Assigned', html: '<p>Task</p>' }),
    taskReminder: jest.fn().mockReturnValue({ subject: 'Task Reminder', html: '<p>Reminder</p>' }),
    passwordReset: jest.fn().mockReturnValue({ subject: 'Password Reset', html: '<p>Reset</p>' }),
    memberInvitation: jest.fn().mockReturnValue({ subject: 'Invitation', html: '<p>Invite</p>' }),
    dailyDigest: jest.fn().mockReturnValue({ subject: 'Daily Digest', html: '<p>Digest</p>' })
  },
  createTransporter: jest.fn().mockReturnValue({ sendMail: jest.fn() })
}));

const { sendEmail } = require('../../src/services/emailService');
const { emailQueue, taskReminderQueue, analyticsQueue, cleanupQueue } = require('../../src/config/queue');

describe('Queue Job Processing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Queue Configuration', () => {
    test('should create email queue with correct name', () => {
      expect(emailQueue.name).toBe('email-queue');
    });

    test('should create task reminder queue with correct name', () => {
      expect(taskReminderQueue.name).toBe('task-reminder-queue');
    });

    test('should create analytics queue with correct name', () => {
      expect(analyticsQueue.name).toBe('analytics-queue');
    });

    test('should create cleanup queue with correct name', () => {
      expect(cleanupQueue.name).toBe('cleanup-queue');
    });

    test('should have process method on all queues', () => {
      expect(emailQueue.process).toBeDefined();
      expect(taskReminderQueue.process).toBeDefined();
      expect(analyticsQueue.process).toBeDefined();
      expect(cleanupQueue.process).toBeDefined();
    });
  });

  describe('Email Job Creation', () => {
    test('should add email job to queue with correct data', async () => {
      const jobData = {
        to: 'test@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        html: '<p>This is a test email</p>'
      };

      const job = await emailQueue.add('sendEmail', jobData, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 }
      });

      expect(emailQueue.add).toHaveBeenCalledWith('sendEmail', jobData, expect.objectContaining({
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 }
      }));
      expect(job.id).toBe('mock-job-id');
    });

    test('should add welcome email job with correct structure', async () => {
      const jobData = {
        type: 'welcome',
        to: 'welcome@example.com',
        data: {
          user: { firstName: 'Test User' },
          org: { name: 'Test Org' }
        }
      };

      await emailQueue.add('sendEmail', jobData);

      expect(emailQueue.add).toHaveBeenCalledWith('sendEmail', expect.objectContaining({
        type: 'welcome',
        to: 'welcome@example.com'
      }));
    });

    test('should add task reminder job with correct structure', async () => {
      const jobData = {
        taskId: '507f1f77bcf86cd799439011',
        organizationId: '507f1f77bcf86cd799439012',
        dueDate: new Date(Date.now() + 3600000).toISOString()
      };

      await taskReminderQueue.add('sendTaskReminder', jobData);

      expect(taskReminderQueue.add).toHaveBeenCalledWith('sendTaskReminder', jobData);
    });
  });

  describe('Queue Event Handlers', () => {
    test('should have on method for event handling', () => {
      expect(emailQueue.on).toBeDefined();
      expect(taskReminderQueue.on).toBeDefined();
    });

    test('should be able to register completed event handler', () => {
      const callback = jest.fn();
      emailQueue.on('completed', callback);
      expect(emailQueue.on).toHaveBeenCalledWith('completed', callback);
    });

    test('should be able to register failed event handler', () => {
      const callback = jest.fn();
      emailQueue.on('failed', callback);
      expect(emailQueue.on).toHaveBeenCalledWith('failed', callback);
    });
  });
});