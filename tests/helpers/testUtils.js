/**
 * Test helper utilities
 */
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

let emailCounter = 0;

/**
 * Generate a test JWT token
 */
const generateTestToken = (user, secret = process.env.JWT_ACCESS_SECRET || 'test-secret', expiresIn = '15m') => {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
      role: user.role || 'user'
    },
    secret,
    { expiresIn }
  );
};

/**
 * Generate a test refresh token
 */
const generateTestRefreshToken = (user, secret = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret', expiresIn = '7d') => {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
      type: 'refresh'
    },
    secret,
    { expiresIn }
  );
};

/**
 * Create a mock user object
 */
const createMockUser = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  firstName: 'Test',
  lastName: 'User',
  email: `test_${Date.now()}_${emailCounter++}@example.com`,
  password: 'TestPassword123!',
  phone: '+1234567890',
  role: 'user',
  isActive: true,
  ...overrides
});

/**
 * Create a mock organization object
 */
const createMockOrganization = (createdById, overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  name: 'Test Organization',
  slug: 'test-organization',
  description: 'Test Description',
  createdBy: createdById,
  status: 'active',
  tier: 'free',
  settings: {
    allowPublicProperties: true,
    defaultPropertyStatus: 'available'
  },
  ...overrides
});

/**
 * Create a mock property object
 */
const createMockProperty = (organizationId, createdById, overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  title: 'Test Property',
  description: 'Test Property Description',
  propertyType: 'apartment',
  listingType: 'sale',
  price: 500000,
  organizationId: organizationId,
  createdBy: createdById,
  status: 'available',
  location: {
    address: '123 Test Street',
    city: 'Test City',
    state: 'Test State',
    country: 'Test Country',
    pincode: '123456'
  },
  area: {
    superArea: 1000,
    unit: 'sqft'
  },
  owner: {
    name: 'Test Owner',
    phone: '+1234567890',
    email: 'owner@example.com',
    relation: 'owner'
  },
  ...overrides
});

/**
 * Create a mock task object
 */
const createMockTask = (organizationId, creatorId, overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  title: 'Test Task',
  description: 'Test Task Description',
  organizationId: organizationId,
  creator: creatorId,
  assignee: creatorId,
  priority: 'medium',
  status: 'open',
  taskType: 'lead',
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  ...overrides
});

/**
 * Wait for a specified duration (for testing async operations)
 */
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Mock request object factory
 */
const createMockRequest = (params = {}, body = {}, query = {}, headers = {}) => ({
  params,
  body,
  query,
  headers,
  ip: '127.0.0.1',
  method: 'GET',
  path: '/test',
  protocol: 'http',
  get: (header) => headers[header.toLowerCase()]
});

/**
 * Mock response object factory
 */
const createMockResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis()
  };
  return res;
};

/**
 * Mock next function
 */
const createMockNext = () => jest.fn();

module.exports = {
  generateTestToken,
  generateTestRefreshToken,
  createMockUser,
  createMockOrganization,
  createMockProperty,
  createMockTask,
  wait,
  createMockRequest,
  createMockResponse,
  createMockNext
};

