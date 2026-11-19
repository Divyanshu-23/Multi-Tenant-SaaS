/**
 * Authentication API Integration Tests
 */
const request = require('supertest');
const { app } = require('../../src/index');
const User = require('../../src/models/User');
const { generateTestToken } = require('../helpers/testUtils');

describe('Auth API Integration Tests', () => {
  // Test user data
  const testUserData = {
    firstName: 'Integration',
    lastName: 'Test',
    email: `integration_${Date.now()}@test.com`,
    password: 'TestPassword123!',
    phone: '1234567890',
    accountType: 'customer',
    confirmPassword: 'TestPassword123!',
    termsAccepted: true
  };

  let createdUserId = null;
  let authToken = null;
  let refreshToken = null;

  // Clean up before each test
  beforeEach(async () => {
    // Remove any test users
    await User.deleteMany({ email: { $regex: /^integration_/ } });
  });

  describe('POST /api/auth/register', () => {
    test('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUserData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', testUserData.email);
      expect(response.body.user).toHaveProperty('firstName', testUserData.firstName);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');

      // Save for other tests
      createdUserId = response.body.user.id;
      authToken = response.body.token;
      refreshToken = response.body.refreshToken;
    });

    test('should reject registration with existing email', async () => {
      // Create user first
      await request(app)
        .post('/api/auth/register')
        .send(testUserData);

      // Try to create again
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUserData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/email.*exists/i);
    });

    test('should reject registration with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...testUserData,
          email: 'invalid-email'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('errors');
    });

    test('should reject registration with weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...testUserData,
          password: 'weak'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Register a user first
      await request(app)
        .post('/api/auth/register')
        .send(testUserData);
    });

    test('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserData.email,
          password: testUserData.password
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', testUserData.email);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
    });

    test('should reject login with incorrect password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserData.email,
          password: 'WrongPassword123!'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/invalid.*credentials/i);
    });

    test('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'SomePassword123!'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/invalid.*credentials/i);
    });
  });

  describe('Account type selection', () => {
    test('should allow a broker to authenticate without an organization', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...testUserData,
          email: `broker_${Date.now()}@test.com`,
          accountType: 'broker',
        });

      expect(response.status).toBe(201);
      const profile = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${response.body.token}`);

      expect(profile.status).toBe(200);
      expect(profile.body.user.accountType).toBe('broker');
      expect(profile.body.organizations).toEqual([]);
    });

    test('should register a customer account and return its immutable type', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...testUserData,
          email: `customer_${Date.now()}@test.com`,
          accountType: 'customer',
        });

      expect(response.status).toBe(201);
      expect(response.body.user.accountType).toBe('customer');

      const me = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${response.body.token}`);

      expect(me.status).toBe(200);
      expect(me.body.user.accountType).toBe('customer');

      const savedUser = await User.findById(response.body.user.id);
      savedUser.accountType = 'broker';
      await savedUser.save();

      const unchangedUser = await User.findById(response.body.user.id);
      expect(unchangedUser.accountType).toBe('customer');
    });

    test('should reject an invalid account type', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...testUserData,
          email: `invalid_account_type_${Date.now()}@test.com`,
          accountType: 'both',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should reject a password without required complexity', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...testUserData, email: `weak_complexity_${Date.now()}@test.com`, password: 'password123', confirmPassword: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should reject mismatched confirmation password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...testUserData, email: `mismatch_${Date.now()}@test.com`, confirmPassword: 'DifferentPassword123!' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should reject registration without terms acceptance', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...testUserData, email: `no_terms_${Date.now()}@test.com`, termsAccepted: false });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should reject a phone number that is not exactly 10 digits', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...testUserData, email: `bad_phone_${Date.now()}@test.com`, phone: '12345678901' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken;

    beforeEach(async () => {
      // Register and get tokens
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(testUserData);

      refreshToken = registerResponse.body.refreshToken;
    });

    test('should refresh token successfully', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.token).not.toBe(refreshToken);
    });

    test('should reject refresh with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    test('should reject refresh without token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Password Reset Flow', () => {
    let resetUserEmail;
    const initialPassword = 'InitialPassword123!';
    const newPassword = 'NewSecretPassword456!';

    beforeEach(async () => {
      resetUserEmail = `forgot_test_${Date.now()}@test.com`;
      await request(app)
        .post('/api/auth/register')
        .send({
          ...testUserData,
          email: resetUserEmail,
          password: initialPassword,
          confirmPassword: initialPassword,
        });
    });

    describe('POST /api/auth/forgot-password', () => {
      test('should generate reset token for existing user and return success message', async () => {
        const response = await request(app)
          .post('/api/auth/forgot-password')
          .send({ email: resetUserEmail });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body.message).toMatch(/password reset link/i);
        expect(response.body).toHaveProperty('resetToken');

        const user = await User.findOne({ email: resetUserEmail });
        expect(user.resetToken).toBeDefined();
        expect(user.resetTokenExpiry).toBeDefined();
        expect(user.resetTokenExpiry.getTime()).toBeGreaterThan(Date.now());
      });

      test('should return success message even if email is not registered to prevent enumeration', async () => {
        const response = await request(app)
          .post('/api/auth/forgot-password')
          .send({ email: 'nonexistent_account_12345@test.com' });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body.message).toMatch(/password reset link/i);
      });

      test('should reject forgot-password with invalid email', async () => {
        const response = await request(app)
          .post('/api/auth/forgot-password')
          .send({ email: 'not-an-email' });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
      });

      test('should reject forgot-password without email', async () => {
        const response = await request(app)
          .post('/api/auth/forgot-password')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('POST /api/auth/reset-password', () => {
      let validResetToken;

      beforeEach(async () => {
        const forgotResponse = await request(app)
          .post('/api/auth/forgot-password')
          .send({ email: resetUserEmail });

        validResetToken = forgotResponse.body.resetToken;
      });

      test('should reset password with valid token and allow login with new password', async () => {
        const resetResponse = await request(app)
          .post('/api/auth/reset-password')
          .send({
            token: validResetToken,
            password: newPassword,
          });

        expect(resetResponse.status).toBe(200);
        expect(resetResponse.body).toHaveProperty('success', true);
        expect(resetResponse.body.message).toMatch(/successfully/i);

        // Verify user resetToken was cleared
        const user = await User.findOne({ email: resetUserEmail });
        expect(user.resetToken).toBeUndefined();

        // Old password must fail
        const oldLogin = await request(app)
          .post('/api/auth/login')
          .send({ email: resetUserEmail, password: initialPassword });
        expect(oldLogin.status).toBe(401);

        // New password must succeed
        const newLogin = await request(app)
          .post('/api/auth/login')
          .send({ email: resetUserEmail, password: newPassword });
        expect(newLogin.status).toBe(200);
        expect(newLogin.body).toHaveProperty('token');
      });

      test('should reject reset with invalid token', async () => {
        const response = await request(app)
          .post('/api/auth/reset-password')
          .send({
            token: 'completely-invalid-jwt-token',
            password: newPassword,
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.error).toMatch(/invalid.*token/i);
      });

      test('should reject reset with weak password', async () => {
        const response = await request(app)
          .post('/api/auth/reset-password')
          .send({
            token: validResetToken,
            password: 'short',
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
      });

      test('should reject reset with expired token', async () => {
        // Artificially expire token in DB
        await User.updateOne(
          { email: resetUserEmail },
          { resetTokenExpiry: new Date(Date.now() - 10000) }
        );

        const response = await request(app)
          .post('/api/auth/reset-password')
          .send({
            token: validResetToken,
            password: newPassword,
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.error).toMatch(/expired/i);
      });
    });
  });
});
