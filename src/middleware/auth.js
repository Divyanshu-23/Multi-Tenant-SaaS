// src/middleware/auth.js - Authentication middleware
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { jwt: jwtConfig } = require('../config/env');
const { Member } = require('../models');

const auth = async (req, res, next) => {
  let token;

  // Check for token in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Check for token in cookies
  if (!token && req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route',
    });
  }

  try {
    const decoded = jwt.verify(token, jwtConfig.secret);
    req.user = {
      id: decoded.id,
    };
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route',
    });
  }
};

// Middleware to extract organization context and verify membership
const orgContext = async (req, res, next) => {
  // Check for org_id in query, body, or headers
  const orgId = req.query.org_id || req.body.org_id || req.headers['x-organization-id'];

  if (!orgId) {
    return next();
  }

  // A malformed organization id can never grant membership
  if (!mongoose.Types.ObjectId.isValid(String(orgId))) {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Invalid organization identifier.',
    });
  }

  req.organizationId = orgId;

  // No authenticated user yet - let other middleware handle auth
  if (!req.user || !req.user.id) {
    return next();
  }

  try {
    // Verify the user is an active member of the organization
    const member = await Member.findOne({
      userId: req.user.id,
      organizationId: orgId,
      status: 'active',
    });

    if (!member) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You are not a member of this organization.',
      });
    }

    req.member = member;
    next();
  } catch (error) {
    console.error('Organization context error:', error);
    res.status(500).json({ success: false, error: 'Server error during authorization' });
  }
};

// Require organization context for certain routes
const requireOrgContext = (req, res, next) => {
  if (!req.organizationId) {
    return res.status(400).json({
      success: false,
      error: 'Organization ID is required. Please provide org_id as a query parameter, body field, or x-organization-id header.',
    });
  }
  next();
};

module.exports = { auth, orgContext, requireOrgContext };