// src/utils/emailService.js - Email sending utility
const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
};

const sendVerificationEmail = async (email, verificationToken, userName) => {
  const baseUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5000';
  const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`;

  if (process.env.ENABLE_EMAIL_NOTIFICATIONS === 'false') {
    console.log(`ℹ️ Email notifications disabled. Verification link for ${email}: ${verificationUrl}`);
    return;
  }

  const transporter = createTransporter();

  const mailOptions = {
    from: `"${process.env.APP_NAME || 'RealEstateSaaS'}" <${process.env.SMTP_FROM || 'noreply@realestate-saas.com'}>`,
    to: email,
    subject: 'Verify your email - RealEstateSaaS',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Verify Email</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #10b981 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Welcome to RealEstateSaaS!</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2>Hello ${userName || 'there'},</h2>
          <p>Thank you for registering. Please verify your email address:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}"
               style="background: linear-gradient(135deg, #3b82f6 0%, #10b981 100%);
                      color: white;
                      padding: 15px 30px;
                      text-decoration: none;
                      border-radius: 5px;
                      font-weight: bold;">
              Verify Email Address
            </a>
          </div>
          <p style="font-size: 14px; color: #666; word-break: break-all;">
            If the button doesn't work, copy and paste this URL into your browser:<br>
            <a href="${verificationUrl}">${verificationUrl}</a>
          </p>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Email sending error:', error.message || error);
    throw new Error('Failed to send verification email');
  }
};

const sendPasswordResetEmail = async (email, resetToken, userName) => {
  const baseUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5000';
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

  if (process.env.ENABLE_EMAIL_NOTIFICATIONS === 'false') {
    console.log(`ℹ️ Email notifications disabled. Reset link for ${email}: ${resetUrl}`);
    return;
  }

  const transporter = createTransporter();

  const mailOptions = {
    from: `"${process.env.APP_NAME || 'RealEstateSaaS'}" <${process.env.SMTP_FROM || 'noreply@realestate-saas.com'}>`,
    to: email,
    subject: 'Reset your password - RealEstateSaaS',
    html: `
      <!DOCTYPE html>
      <html>
      <head><title>Reset Password</title></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #10b981 100%); padding: 30px; text-align: center; border-radius: 10px;">
          <h1 style="color: white; margin: 0;">Reset Password</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; margin-top: 10px; border-radius: 10px;">
          <p>Hello ${userName || 'there'},</p>
          <p>Click below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}"
               style="background: linear-gradient(135deg, #3b82f6 0%, #10b981 100%);
                      color: white; padding: 15px 30px;
                      text-decoration: none; border-radius: 5px; font-weight: bold;">
              Reset Password
            </a>
          </div>
          <p>This link expires in 1 hour.</p>
          <p style="font-size: 14px; color: #666; word-break: break-all;">
            If the button doesn't work, copy and paste this URL into your browser:<br>
            <a href="${resetUrl}">${resetUrl}</a>
          </p>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Email sending error:', error.message || error);
    throw new Error('Failed to send password reset email');
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
};