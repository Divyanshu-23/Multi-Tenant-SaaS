/**
 * Unit Tests - Utilities
 */
const { generateTestToken, generateTestRefreshToken, createMockUser, createMockOrganization, createMockProperty, createMockTask } = require('../../tests/helpers/testUtils');
const jwt = require('jsonwebtoken');

describe('Test Utilities', () => {
  describe('generateTestToken', () => {
    test('should generate a valid JWT token', () => {
      const user = createMockUser();
      const token = generateTestToken(user);

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    test('should include userId and email in token payload', () => {
      const user = createMockUser({ email: 'test@example.com' });
      const secret = 'test-secret';
      const token = generateTestToken(user, secret);
      const decoded = jwt.verify(token, secret);

      expect(decoded.userId).toBe(user._id.toString());
      expect(decoded.email).toBe(user.email);
    });

    test('should include role in token payload', () => {
      const user = createMockUser({ role: 'admin' });
      const secret = 'test-secret';
      const token = generateTestToken(user, secret);
      const decoded = jwt.verify(token, secret);

      expect(decoded.role).toBe('admin');
    });

    test('should use custom expiration', () => {
      const user = createMockUser();
      const token = generateTestToken(user, 'test-secret', '1h');
      const decoded = jwt.decode(token);

      expect(decoded.exp - decoded.iat).toBe(3600); // 1 hour in seconds
    });
  });

  describe('generateTestRefreshToken', () => {
    test('should generate a valid refresh token', () => {
      const user = createMockUser();
      const token = generateTestRefreshToken(user);

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    test('should include type=refresh in payload', () => {
      const user = createMockUser();
      const token = generateTestRefreshToken(user, 'test-secret');
      const decoded = jwt.verify(token, 'test-secret');

      expect(decoded.type).toBe('refresh');
    });

    test('should have longer expiration than access token', () => {
      const user = createMockUser();
      const accessToken = generateTestToken(user, 'test-secret', '15m');
      const refreshToken = generateTestRefreshToken(user, 'test-secret', '7d');

      const accessDecoded = jwt.decode(accessToken);
      const refreshDecoded = jwt.decode(refreshToken);

      expect(refreshDecoded.exp).toBeGreaterThan(accessDecoded.exp);
    });
  });

  describe('createMockUser', () => {
    test('should create a user object with required fields', () => {
      const user = createMockUser();

      expect(user).toHaveProperty('_id');
      expect(user).toHaveProperty('firstName', 'Test');
      expect(user).toHaveProperty('lastName', 'User');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('password');
      expect(user).toHaveProperty('phone');
      expect(user).toHaveProperty('role', 'user');
      expect(user).toHaveProperty('isActive', true);
    });

    test('should allow overriding defaults', () => {
      const user = createMockUser({
        firstName: 'Custom',
        lastName: 'User',
        role: 'admin'
      });

      expect(user.firstName).toBe('Custom');
      expect(user.lastName).toBe('User');
      expect(user.role).toBe('admin');
    });

    test('should generate unique email each time', () => {
      const user1 = createMockUser();
      const user2 = createMockUser();

      expect(user1.email).not.toBe(user2.email);
    });
  });

  describe('createMockOrganization', () => {
    test('should create an organization object with required fields', () => {
      const createdById = '123456789012345678901234';
      const org = createMockOrganization(createdById);

      expect(org).toHaveProperty('_id');
      expect(org).toHaveProperty('name', 'Test Organization');
      expect(org).toHaveProperty('slug', 'test-organization');
      expect(org).toHaveProperty('description', 'Test Description');
      expect(org).toHaveProperty('createdBy', createdById);
      expect(org).toHaveProperty('status', 'active');
      expect(org).toHaveProperty('tier', 'free');
      expect(org.settings).toHaveProperty('allowPublicProperties', true);
    });

    test('should allow overriding defaults', () => {
      const createdById = '123456789012345678901234';
      const org = createMockOrganization(createdById, {
        name: 'Custom Org',
        status: 'trial'
      });

      expect(org.name).toBe('Custom Org');
      expect(org.status).toBe('trial');
    });
  });

  describe('createMockProperty', () => {
    test('should create a property object with required fields', () => {
      const orgId = '123456789012345678901234';
      const createdById = '123456789012345678901235';
      const property = createMockProperty(orgId, createdById);

      expect(property).toHaveProperty('_id');
      expect(property).toHaveProperty('title', 'Test Property');
      expect(property).toHaveProperty('propertyType', 'apartment');
      expect(property).toHaveProperty('listingType', 'sale');
      expect(property).toHaveProperty('price', 500000);
      expect(property).toHaveProperty('organizationId', orgId);
      expect(property).toHaveProperty('createdBy', createdById);
      expect(property).toHaveProperty('status', 'available');
      expect(property.location).toHaveProperty('city', 'Test City');
      expect(property.area).toHaveProperty('superArea', 1000);
    });

    test('should allow overriding defaults', () => {
      const orgId = '123456789012345678901234';
      const createdById = '123456789012345678901235';
      const property = createMockProperty(orgId, createdById, {
        title: 'Custom Property',
        price: 1000000,
        propertyType: 'villa'
      });

      expect(property.title).toBe('Custom Property');
      expect(property.price).toBe(1000000);
      expect(property.propertyType).toBe('villa');
    });
  });

  describe('createMockTask', () => {
    test('should create a task object with required fields', () => {
      const orgId = '123456789012345678901234';
      const creatorId = '123456789012345678901235';
      const task = createMockTask(orgId, creatorId);

      expect(task).toHaveProperty('_id');
      expect(task).toHaveProperty('title', 'Test Task');
      expect(task).toHaveProperty('priority', 'medium');
      expect(task).toHaveProperty('status', 'open');
      expect(task).toHaveProperty('organizationId', orgId);
      expect(task).toHaveProperty('creator', creatorId);
      expect(task).toHaveProperty('assignee', creatorId);
    });

    test('should allow overriding defaults', () => {
      const orgId = '123456789012345678901234';
      const creatorId = '123456789012345678901235';
      const task = createMockTask(orgId, creatorId, {
        title: 'Custom Task',
        priority: 'high',
        status: 'completed'
      });

      expect(task.title).toBe('Custom Task');
      expect(task.priority).toBe('high');
      expect(task.status).toBe('completed');
    });
  });
});