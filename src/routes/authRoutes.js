// src/routes/authRoutes.js - Authentication endpoints
const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const { User, Organization, Member } = require('../models');
const { auth, orgContext } = require('../middleware/auth');
const { generateToken, generateRefreshToken, verifyToken } = require('../utils/generateToken');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/emailService');
const { jwt: jwtConfig } = require('../config/env');

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[a-z]/).withMessage('Password must include a lowercase letter')
    .matches(/[A-Z]/).withMessage('Password must include an uppercase letter')
    .matches(/\d/).withMessage('Password must include a number')
    .matches(/[^A-Za-z\d]/).withMessage('Password must include a special character'),
  body('confirmPassword').custom((value, { req }) => value === req.body.password).withMessage('Passwords do not match'),
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('phone').optional({ checkFalsy: true }).matches(/^\d{10}$/).withMessage('Phone number must contain exactly 10 digits'),
  body('termsAccepted').custom((value) => value === true || value === 'true').withMessage('You must accept the terms and privacy policy'),
  body('accountType').optional().isIn(['customer', 'broker', 'owner', 'builder']).withMessage('Select a valid account type'),
  body('customerType').optional().isIn(['buyer', 'renter']).withMessage('Select a valid customer type'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password, firstName, lastName, phone, accountType = 'customer' } = req.body;
    const customerType = accountType === 'customer' ? (req.body.customerType || 'buyer') : undefined;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists',
      });
    }

    // Create user
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      phone,
      accountType,
      customerType,
      termsAccepted: true,
      termsAcceptedAt: new Date(),
    });

    // Generate verification token and tokens
    const verificationToken = generateToken(user._id, '1d');
    user.verificationToken = verificationToken;
    await user.save();

    // Generate token
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Send verification email
    try {
      await sendVerificationEmail(user.email, user.verificationToken, user.getFullName());
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail registration if email sending fails
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful! Please check your email to verify your account.',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        accountType: user.accountType,
        customerType: user.customerType,
      },
      token,
      refreshToken,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during registration',
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password',
      });
    }

    // Check if user exists
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        verified: user.verified,
        accountType: user.accountType,
        customerType: user.customerType,
      },
      token,
      refreshToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during login',
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile and organizations
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const memberships = await Member.find({ userId: user._id, status: 'active' })
      .populate('organizationId', 'name slug tier status branding settings createdAt');

    const organizations = memberships
      .filter((m) => m.organizationId)
      .map((m) => ({
        id: m.organizationId._id,
        name: m.organizationId.name,
        slug: m.organizationId.slug,
        tier: m.organizationId.tier,
        memberId: m._id,
      }));

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        accountType: user.accountType,
        customerType: user.customerType,
        verified: user.verified,
      },
      organizations,
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ success: false, error: 'Server error fetching user' });
  }
});

// @route   POST /api/auth/refresh
// @desc    Refresh access token
// @access  Public
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required',
      });
    }

    // Verify refresh token
    const decoded = verifyToken(refreshToken, true);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
      });
    }

    // Generate new tokens
    const newToken = generateToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    res.json({
      success: true,
      token: newToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid or expired refresh token',
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', auth, async (req, res) => {
  try {
    // In a real app, you might want to add the token to a blacklist
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during logout',
    });
  }
});

// @route   POST /api/auth/verify-email
// @desc    Verify email with token
// @access  Public
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Verification token is required',
      });
    }

    // Verify token
    const decoded = verifyToken(token);

    // Find user and update verification status
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    user.verified = true;
    user.verificationToken = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Email verified successfully! You can now login.',
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(400).json({
      success: false,
      error: 'Invalid or expired verification token',
    });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Request password reset
// @access  Public
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0]?.msg || 'Please provide a valid email',
        errors: errors.array(),
      });
    }

    const email = (req.body.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({
        success: true,
        message: 'If a user with this email exists, a password reset link has been sent.',
      });
    }

    // Generate reset token
    const resetToken = generateToken(user._id, '1h');

    // Save reset token
    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + 3600000; // 1 hour
    await user.save();

    const frontendBaseUrl = req.headers.origin || process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5000';
    const resetUrl = `${frontendBaseUrl}/reset-password?token=${resetToken}`;

    // Send reset email
    try {
      await sendPasswordResetEmail(user.email, resetToken, user.getFullName());
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError.message || emailError);
    }

    console.log(`🔑 Password reset link for ${email}: ${resetUrl}`);

    const responseData = {
      success: true,
      message: 'If a user with this email exists, a password reset link has been sent.',
    };

    if (process.env.NODE_ENV !== 'production') {
      responseData.resetUrl = resetUrl;
      responseData.resetToken = resetToken;
    }

    res.json(responseData);
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Token is required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[a-z]/).withMessage('Password must include a lowercase letter')
    .matches(/[A-Z]/).withMessage('Password must include an uppercase letter')
    .matches(/\d/).withMessage('Password must include a number')
    .matches(/[^A-Za-z\d]/).withMessage('Password must include a special character'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0]?.msg || 'Validation failed',
        errors: errors.array(),
      });
    }

    const { token, password } = req.body;

    // Verify token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (_tokenErr) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token',
      });
    }

    // Find user
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Check if token is expired
    if (user.resetTokenExpiry && Date.now() > user.resetTokenExpiry) {
      return res.status(400).json({
        success: false,
        error: 'Password reset token has expired',
      });
    }

    // Check if token matches
    if (user.resetToken !== token) {
      return res.status(400).json({
        success: false,
        error: 'Invalid reset token',
      });
    }

    // Update password
    user.password = password;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now login with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
});

module.exports = router;
