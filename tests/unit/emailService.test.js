/**
 * Unit Tests - Email Service
 */
const nodemailer = require('nodemailer');

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({
      messageId: 'test-message-id-123',
      response: '250 OK'
    }),
    options: {
      host: 'smtp.ethereal.email',
      port: 587
    }
  }),
  getTestMessageUrl: jest.fn().mockReturnValue('https://ethereal.email/message/test')
}));

const { sendEmail, processEmailJob, templates, createTransporter } = require('../../src/services/emailService');

describe('Email Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SMTP_HOST = 'smtp.ethereal.email';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'test@test.com';
    process.env.SMTP_PASS = 'testpass';
    process.env.EMAIL_FROM = 'noreply@example.com';
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.EMAIL_FROM;
  });

  describe('sendEmail', () => {
    test('should send email with valid parameters', async () => {
      const result = await sendEmail(
        'recipient@example.com',
        'Test Subject',
        '<h1>HTML Email</h1>'
      );

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('messageId', 'test-message-id-123');
    });

    test('should send email with text fallback', async () => {
      const result = await sendEmail(
        'recipient@example.com',
        'Test Subject',
        '<h1>HTML Email</h1>',
        'Plain text version'
      );

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('messageId');
    });

    test('should call sendMail with correct options', async () => {
      await sendEmail(
        'test@example.com',
        'Test Subject',
        '<p>Hello</p>'
      );

      const transport = nodemailer.createTransport();
      expect(transport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Test Subject',
          html: '<p>Hello</p>'
        })
      );
    });
  });

  describe('createTransporter', () => {
    test('should call nodemailer.createTransport', () => {
      createTransporter();
      expect(nodemailer.createTransport).toHaveBeenCalled();
    });
  });

  describe('Email Templates', () => {
    test('should generate welcome email template', () => {
      const user = { firstName: 'John' };
      const org = { name: 'Test Org' };

      const template = templates.welcome(user, org);

      expect(template).toHaveProperty('subject');
      expect(template).toHaveProperty('html');
      expect(template.subject).toContain('Welcome');
      expect(template.html).toContain('John');
      expect(template.html).toContain('Test Org');
    });

    test('should generate taskAssigned email template', () => {
      const user = { firstName: 'Jane' };
      const task = { title: 'Test Task', priority: 'high', dueDate: new Date() };
      const property = { title: 'Test Property' };

      const template = templates.taskAssigned(user, task, property);

      expect(template.subject).toContain('New Task Assigned');
      expect(template.html).toContain('Jane');
      expect(template.html).toContain('Test Task');
    });

    test('should generate taskReminder email template', () => {
      const user = { firstName: 'Bob' };
      const task = { title: 'Reminder Task', priority: 'urgent', dueDate: new Date() };

      const template = templates.taskReminder(user, task);

      expect(template.subject).toContain('Reminder');
      expect(template.html).toContain('Bob');
      expect(template.html).toContain('Reminder Task');
    });

    test('should generate memberInvitation email template', () => {
      const user = { firstName: 'New' };
      const org = { name: 'Invite Org', _id: '123' };
      const inviter = { firstName: 'Admin', lastName: 'User' };

      const template = templates.memberInvitation(user, org, inviter);

      expect(template.subject).toContain('invited');
      expect(template.html).toContain('Admin User');
      expect(template.html).toContain('Invite Org');
    });

    test('should generate passwordReset email template', () => {
      const user = { firstName: 'Reset' };
      const resetToken = 'reset-token-123';

      const template = templates.passwordReset(user, resetToken);

      expect(template.subject).toContain('Password Reset');
      expect(template.html).toContain('Reset');
      expect(template.html).toContain('reset-token-123');
    });

    test('should generate dailyDigest email template', () => {
      const user = { firstName: 'Digest' };
      const stats = { newProperties: 5, completedTasks: 10, pendingTasks: 3 };

      const template = templates.dailyDigest(user, stats);

      expect(template.subject).toContain('Daily Digest');
      expect(template.html).toContain('5');
      expect(template.html).toContain('10');
      expect(template.html).toContain('3');
    });
  });

  describe('processEmailJob', () => {
    test('should process welcome email job', async () => {
      const job = {
        data: {
          type: 'welcome',
          to: 'welcome@example.com',
          data: {
            user: { firstName: 'Test' },
            org: { name: 'Test Org' }
          }
        }
      };

      const result = await processEmailJob(job);

      expect(result.sent).toBe(true);
      expect(result.type).toBe('welcome');
      expect(result.to).toBe('welcome@example.com');
    });

    test('should process taskReminder email job', async () => {
      const job = {
        data: {
          type: 'taskReminder',
          to: 'reminder@example.com',
          data: {
            user: { firstName: 'Test' },
            task: { title: 'Task', priority: 'high', dueDate: new Date() }
          }
        }
      };

      const result = await processEmailJob(job);

      expect(result.sent).toBe(true);
      expect(result.type).toBe('taskReminder');
    });

    test('should process passwordReset email job', async () => {
      const job = {
        data: {
          type: 'passwordReset',
          to: 'reset@example.com',
          data: {
            user: { firstName: 'Reset' },
            resetToken: 'abc123'
          }
        }
      };

      const result = await processEmailJob(job);

      expect(result.sent).toBe(true);
      expect(result.type).toBe('passwordReset');
    });

    test('should throw error for unknown template type', async () => {
      const job = {
        data: {
          type: 'unknown',
          to: 'test@example.com',
          data: {}
        }
      };

      await expect(processEmailJob(job)).rejects.toThrow('Unknown email template type');
    });
  });

  describe('Error Handling', () => {
    test('should throw error when sendMail fails', async () => {
      const transport = nodemailer.createTransport();
      transport.sendMail.mockRejectedValueOnce(new Error('SMTP Error'));

      await expect(sendEmail(
        'test@example.com',
        'Test',
        '<p>Test</p>'
      )).rejects.toThrow('SMTP Error');
    });
  });
});
