// src/middleware/auth.js - Authentication middleware
const jwt = require('jsonwebtoken');
const { jwt: jwtConfig } = require('../config/env');

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

// Middleware to extract organization context from request
const orgContext = (req, res, next) => {
  // Check for org_id in query, body, or headers
  const orgId = req.query.org_id || req.body.org_id || req.headers['x-organization-id'];

  if (orgId) {
    req.organizationId = orgId;
  }

  next();
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