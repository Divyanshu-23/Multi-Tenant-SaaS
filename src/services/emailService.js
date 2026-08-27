// src/services/emailService.js - Email Service for Background Jobs
const nodemailer = require('nodemailer');

// Email transporter configuration
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || 'test@example.com',
      pass: process.env.SMTP_PASS || 'password',
    },
  });
};

// Email templates
const templates = {
  welcome: (user, org) => ({
    subject: `Welcome to ${org.name}, ${user.firstName}!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Welcome to Real Estate SaaS! 🏠</h1>
        <p>Hi ${user.firstName},</p>
        <p>Congratulations! You've been added to <strong>${org.name}</strong> on our Real Estate SaaS Platform.</p>
        <p>With your new account, you can:</p>
        <ul>
          <li>Manage property listings</li>
          <li>Track tasks and leads</li>
          <li>Collaborate with team members</li>
          <li>View analytics and reports</li>
        </ul>
        <p>Get started by logging in to your dashboard.</p>
        <a href="${process.env.APP_URL || 'http://localhost:5000'}"
           style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Go to Dashboard
        </a>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
          Best regards,<br>
          The Real Estate SaaS Team
        </p>
      </div>
    `,
  }),

  taskAssigned: (user, task, property) => ({
    subject: `New Task Assigned: ${task.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #059669;">New Task Assigned 📋</h1>
        <p>Hi ${user.firstName},</p>
        <p>A new task has been assigned to you:</p>
        <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin-top: 0; color: #1f2937;">${task.title}</h3>
          <p><strong>Property:</strong> ${property?.title || 'N/A'}</p>
          <p><strong>Priority:</strong> <span style="color: ${task.priority === 'urgent' ? '#dc2626' : '#6b7280'}">${task.priority}</span></p>
          <p><strong>Due:</strong> ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Not set'}</p>
        </div>
        <a href="${process.env.APP_URL || 'http://localhost:5000'}/tasks/${task._id}"
           style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Task
        </a>
      </div>
    `,
  }),

  taskReminder: (user, task) => ({
    subject: `⏰ Reminder: Task "${task.title}" is due soon`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #d97706;">Task Reminder ⏰</h1>
        <p>Hi ${user.firstName},</p>
        <p>This is a reminder that your task is coming due:</p>
        <div style="background-color: #fef3c7; border-left: 4px solid #d97706; padding: 16px; margin: 16px 0;">
          <h3 style="margin-top: 0; color: #92400e;">${task.title}</h3>
          <p><strong>Priority:</strong> ${task.priority}</p>
          <p><strong>Due:</strong> ${task.dueDate ? new Date(task.dueDate).toLocaleString() : 'Not set'}</p>
        </div>
        <p>Don't forget to complete it on time!</p>
        <a href="${process.env.APP_URL || 'http://localhost:5000'}/tasks/${task._id}"
           style="background-color: #d97706; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Task
        </a>
      </div>
    `,
  }),

  memberInvitation: (user, org, inviter) => ({
    subject: `You've been invited to join ${org.name}!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #7c3aed;">You're Invited! 🎉</h1>
        <p>Hi ${user.firstName || 'There'},</p>
        <p><strong>${inviter.firstName} ${inviter.lastName}</strong> has invited you to join <strong>${org.name}</strong> on Real Estate SaaS.</p>
        <p>Click the button below to accept the invitation and get started:</p>
        <a href="${process.env.APP_URL || 'http://localhost:5000'}/accept-invitation/${org._id}"
           style="background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Accept Invitation
        </a>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
          If you didn't expect this invitation, you can safely ignore this email.
        </p>
      </div>
    `,
  }),

  passwordReset: (user, resetToken) => ({
    subject: 'Password Reset Request',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #dc2626;">Password Reset 🔐</h1>
        <p>Hi ${user.firstName},</p>
        <p>You requested a password reset. Click the button below to create a new password:</p>
        <a href="${process.env.APP_URL || 'http://localhost:5000'}/reset-password/${resetToken}"
           style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Reset Password
        </a>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
          This link will expire in 1 hour.<br>
          If you didn't request this, please ignore this email.
        </p>
      </div>
    `,
  }),

  dailyDigest: (user, stats) => ({
    subject: `📊 Daily Digest: ${stats.newProperties} new properties, ${stats.completedTasks} tasks completed`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">📊 Daily Digest</h1>
        <p>Hi ${user.firstName},</p>
        <p>Here's your daily summary for ${new Date().toLocaleDateString()}:</p>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 24px 0;">
          <div style="background-color: #dbeafe; padding: 16px; text-align: center; border-radius: 8px;">
            <div style="font-size: 32px; font-weight: bold; color: #1d4ed8;">${stats.newProperties}</div>
            <div style="color: #1e40af;">New Properties</div>
          </div>
          <div style="background-color: #dcfce7; padding: 16px; text-align: center; border-radius: 8px;">
            <div style="font-size: 32px; font-weight: bold; color: #166534;">${stats.completedTasks}</div>
            <div style="color: #14532d;">Tasks Completed</div>
          </div>
          <div style="background-color: #fef9c3; padding: 16px; text-align: center; border-radius: 8px;">
            <div style="font-size: 32px; font-weight: bold; color: #854d0e;">${stats.pendingTasks}</div>
            <div style="color: #713f12;">Pending Tasks</div>
          </div>
        </div>
        <a href="${process.env.APP_URL || 'http://localhost:5000'}/dashboard"
           style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Dashboard
        </a>
      </div>
    `,
  }),
};

// Send email function
const sendEmail = async (to, subject, html, text = null) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_FROM || '"Real Estate SaaS" <noreply@example.com>',
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for plain text
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}: ${info.messageId}`);

    // For development, log preview URL
    if (process.env.NODE_ENV !== 'production') {
      console.log(`📧 Preview URL: ${require('nodemailer').getTestMessageUrl(info)}`);
    }

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error);
    throw error;
  }
};

// Email job processor
const processEmailJob = async (job) => {
  const { type, to, data } = job.data;

  // Get template
  const template = templates[type];
  if (!template) {
    throw new Error(`Unknown email template type: ${type}`);
  }

  // Generate email content based on type
  let emailContent;
  switch (type) {
    case 'welcome':
      emailContent = template(data.user, data.org);
      break;
    case 'taskAssigned':
      emailContent = template(data.user, data.task, data.property);
      break;
    case 'taskReminder':
      emailContent = template(data.user, data.task);
      break;
    case 'memberInvitation':
      emailContent = template(data.user, data.org, data.inviter);
      break;
    case 'passwordReset':
      emailContent = template(data.user, data.resetToken);
      break;
    case 'dailyDigest':
      emailContent = template(data.user, data.stats);
      break;
    default:
      throw new Error(`Unhandled email type: ${type}`);
  }

  // Send email
  await sendEmail(to, emailContent.subject, emailContent.html);

  return { sent: true, type, to };
};

module.exports = {
  sendEmail,
  processEmailJob,
  templates,
  createTransporter,
};