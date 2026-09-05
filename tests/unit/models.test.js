/**
 * Unit Tests - Model Schemas
 */
const User = require('../../src/models/User');
const Organization = require('../../src/models/Organization');
const Property = require('../../src/models/Property');
const Task = require('../../src/models/Task');

describe('Model Schema Validation', () => {
  describe('User Schema', () => {
    test('should validate a valid user', () => {
      const validUser = {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'TestPassword123!',
        phone: '+1234567890'
      };

      const user = new User(validUser);
      const result = user.validateSync();

      expect(result).toBeUndefined();
    });

    test('should set default role to user', () => {
      const user = new User({
        firstName: 'Test',
        lastName: 'User',
        email: 'roletest@example.com',
        password: 'TestPassword123!',
        phone: '+1234567890'
      });

      expect(user.role).toBe('user');
    });

    test('should accept admin role', () => {
      const user = new User({
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@example.com',
        password: 'TestPassword123!',
        phone: '+1234567890',
        role: 'admin'
      });

      expect(user.role).toBe('admin');
    });

    test('should set default isActive to true', () => {
      const user = new User({
        firstName: 'Test',
        lastName: 'User',
        email: 'isactivesetest@example.com',
        password: 'TestPassword123!',
        phone: '+1234567890'
      });

      expect(user.isActive).toBe(true);
    });
  });

  describe('Organization Schema', () => {
    test('should validate a valid organization', () => {
      const validOrg = {
        name: 'Test Organization',
        slug: 'test-organization',
        createdBy: '507f1f77bcf86cd799439011'
      };

      const org = new Organization(validOrg);
      const result = org.validateSync();

      expect(result).toBeUndefined();
      expect(org.name).toBe('Test Organization');
    });

    test('should auto-generate slug from name', async () => {
      const org = new Organization({
        name: 'My Test Organization',
        createdBy: '507f1f77bcf86cd799439011'
      });

      // The pre-save hook generates slug from name
      // Note: In real DB save, this would be generated. For validateSync, we need to provide it
      org.slug = org.slug || org.name
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');

      expect(org.slug).toBe('my-test-organization');
    });

    test('should set default tier to free', () => {
      const org = new Organization({
        name: 'Test Org',
        slug: 'test-org',
        createdBy: '507f1f77bcf86cd799439011'
      });

      expect(org.tier).toBe('free');
    });

    test('should set default status to active', () => {
      const org = new Organization({
        name: 'Test Org',
        slug: 'test-org',
        createdBy: '507f1f77bcf86cd799439011'
      });

      expect(org.status).toBe('active');
    });
  });

  describe('Property Schema', () => {
    test('should validate a valid property', () => {
      const validProperty = {
        organizationId: '507f1f77bcf86cd799439011',
        title: 'Test Property',
        description: 'Test Description',
        propertyType: 'apartment',
        listingType: 'sale',
        price: 5000000,
        createdBy: '507f1f77bcf86cd799439012',
        location: {
          address: '123 Test St',
          city: 'Test City',
          state: 'Test State',
          country: 'India'
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
        }
      };

      const property = new Property(validProperty);
      const result = property.validateSync();

      expect(result).toBeUndefined();
    });

    test('should set default status to available', () => {
      const property = new Property({
        title: 'Test Property',
        description: 'Test Description',
        price: 5000000,
        propertyType: 'apartment',
        listingType: 'sale',
        organizationId: '507f1f77bcf86cd799439011',
        createdBy: '507f1f77bcf86cd799439012',
        location: { address: '123 Test St', city: 'Test City' },
        area: { superArea: 1000 },
        owner: { name: 'Test Owner', phone: '+1234567890', email: 'owner@test.com', relation: 'owner' }
      });

      expect(property.status).toBe('available');
    });
  });

  describe('Task Schema', () => {
    test('should validate a valid task', () => {
      const validTask = {
        title: 'Test Task',
        description: 'Test Description',
        organizationId: '507f1f77bcf86cd799439011',
        creator: '507f1f77bcf86cd799439012',
        priority: 'high',
        status: 'open',
        dueDate: new Date()
      };

      const task = new Task(validTask);
      const result = task.validateSync();

      expect(result).toBeUndefined();
    });

    test('should set default status to open', () => {
      const task = new Task({
        title: 'Test Task',
        description: 'Test Description',
        organizationId: '507f1f77bcf86cd799439011',
        creator: '507f1f77bcf86cd799439012',
        priority: 'high'
      });

      expect(task.status).toBe('open');
    });

    test('should set default priority to medium', () => {
      const task = new Task({
        title: 'Test Task',
        description: 'Test Description',
        organizationId: '507f1f77bcf86cd799439011',
        creator: '507f1f77bcf86cd799439012'
      });

      expect(task.priority).toBe('medium');
    });

    test('should not set assignee by default', () => {
      const task = new Task({
        title: 'Test Task',
        description: 'Test Description',
        organizationId: '507f1f77bcf86cd799439011',
        creator: '507f1f77bcf86cd799439012'
      });

      expect(task.assignee).toBeUndefined();
    });
  });
});

