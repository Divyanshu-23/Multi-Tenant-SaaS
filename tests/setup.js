// Test setup file
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/db');
const { connectRedis, disconnectRedis } = require('../src/config/redis');
const env = require('../src/config/env');

// Set test timeout
jest.setTimeout(30000);

// Global test variables
global.testUser = null;
global.testOrganization = null;
global.testToken = null;
global.testRefreshToken = null;
global.testOrgId = null;

// Connect to test database before all tests
beforeAll(async () => {
  // CRITICAL: always use a dedicated TEST database - never the development DB.
  // The afterAll hook wipes every collection in the connected database.
  const testDbUri = env.mongodb.testUri || 'mongodb://localhost:27017/real-estate-saas-test';

  try {
    await connectDB(testDbUri);
    console.log('✅ Test database connected');
  } catch (error) {
    console.error('❌ Failed to connect to test database:', error.message);
  }

  // Try to connect to Redis (optional for tests)
  try {
    await connectRedis();
    console.log('✅ Test Redis connected');
  } catch (error) {
    console.warn('⚠️ Test Redis not available:', error.message);
  }
});

// Clean up after all tests
afterAll(async () => {
  try {
    // Clean up test data
    if (mongoose.connection.readyState === 1) {
      const collections = mongoose.connection.collections;
      for (const key in collections) {
        await collections[key].deleteMany({});
      }
    }

    await disconnectDB();
    console.log('✅ Test database disconnected');
  } catch (error) {
    console.error('❌ Error disconnecting database:', error.message);
  }

  try {
    await disconnectRedis();
    console.log('✅ Test Redis disconnected');
  } catch (error) {
    console.warn('⚠️ Error disconnecting Redis:', error.message);
  }
});

// Clean up after each test
afterEach(async () => {
  // Clear any cached data
  jest.clearAllMocks();

  // Clear global test variables
  global.testUser = null;
  global.testOrganization = null;
  global.testToken = null;
  global.testRefreshToken = null;
  global.testOrgId = null;
});

// Helper function to generate random test data
global.generateTestEmail = () => `test_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`;
global.generateTestPhone = () => `+1${Math.floor(Math.random() * 9000000000 + 1000000000)}`;