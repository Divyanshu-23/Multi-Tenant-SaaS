/**
 * Multi-Tenancy Isolation Tests
 * These tests verify that data is properly isolated between organizations
 */
const request = require('supertest');
const { app } = require('../../src/index');
const User = require('../../src/models/User');
const Organization = require('../../src/models/Organization');
const Property = require('../../src/models/Property');
const Task = require('../../src/models/Task');

describe('Multi-Tenancy Isolation Tests', () => {
  // Test data for 3 different organizations
  const users = [
    {
      firstName: 'Tenant1',
      lastName: 'User',
      email: `tenant1_${Date.now()}@test.com`,
      password: 'TestPassword123!'
    },
    {
      firstName: 'Tenant2',
      lastName: 'User',
      email: `tenant2_${Date.now()}@test.com`,
      password: 'TestPassword123!'
    },
    {
      firstName: 'Tenant3',
      lastName: 'User',
      email: `tenant3_${Date.now()}@test.com`,
      password: 'TestPassword123!'
    }
  ];

  let tokens = [];
  let orgIds = [];
  let userIds = [];

  beforeAll(async () => {
    // Clean up before tests
    await User.deleteMany({ email: { $regex: /tenant/ } });
    await Organization.deleteMany({});
    await Property.deleteMany({});
    await Task.deleteMany({});

    // Register all users and create their organizations
    for (let i = 0; i < 3; i++) {
      // Register user
      const userRes = await request(app)
        .post('/api/auth/register')
        .send(users[i]);

      tokens.push(userRes.body.data.accessToken);
      userIds.push(userRes.body.data.user._id);

      // Create organization
      const orgRes = await request(app)
        .post('/api/orgs')
        .set('Authorization', `Bearer ${tokens[i]}`)
        .send({
          name: `Organization ${i + 1}`,
          description: `Tenant ${i + 1} Organization`
        });

      orgIds.push(orgRes.body.data.organization._id);
    }
  });

  describe('Property Isolation', () => {
    beforeAll(async () => {
      // Create properties for each organization
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/properties')
          .set('Authorization', `Bearer ${tokens[i]}`)
          .set('x-organization-id', orgIds[i])
          .send({
            title: `Tenant ${i + 1} Property`,
            description: `Property belonging to organization ${i + 1}`,
            propertyType: 'apartment',
            listingType: 'sale',
            price: 1000000 * (i + 1),
            location: { address: `Address ${i}`, city: `City ${i}` }
          });
      }
    });

    test('Tenant 1 should only see their own properties', async () => {
      const response = await request(app)
        .get('/api/properties')
        .set('Authorization', `Bearer ${tokens[0]}`)
        .set('x-organization-id', orgIds[0]);

      expect(response.status).toBe(200);
      expect(response.body.data.properties).toHaveLength(1);
      expect(response.body.data.properties[0].title).toBe('Tenant 1 Property');
    });

    test('Tenant 1 should not access Tenant 2 property directly', async () => {
      // Get Tenant 2's property ID
      const tenant2Props = await request(app)
        .get('/api/properties')
        .set('Authorization', `Bearer ${tokens[1]}`)
        .set('x-organization-id', orgIds[1]);

      const tenant2PropertyId = tenant2Props.body.data.properties[0]._id;

      // Try to access with Tenant 1's credentials but Tenant 2's org header
      const response = await request(app)
        .get(`/api/properties/${tenant2PropertyId}`)
        .set('Authorization', `Bearer ${tokens[0]}`)
        .set('x-organization-id', orgIds[1]); // Wrong org

      expect(response.status).toBe(403);
    });

    test('Tenant 2 should only see their own properties', async () => {
      const response = await request(app)
        .get('/api/properties')
        .set('Authorization', `Bearer ${tokens[1]}`)
        .set('x-organization-id', orgIds[1]);

      expect(response.status).toBe(200);
      expect(response.body.data.properties).toHaveLength(1);
      expect(response.body.data.properties[0].title).toBe('Tenant 2 Property');
    });

    test('Cross-tenant property access should be blocked', async () => {
      // Tenant 1 tries to access with Tenant 2's org header
      const response = await request(app)
        .get('/api/properties')
        .set('Authorization', `Bearer ${tokens[0]}`)
        .set('x-organization-id', orgIds[1]); // Different org

      expect(response.status).toBe(403);
    });
  });

  describe('Task Isolation', () => {
    beforeAll(async () => {
      // Create tasks for each organization
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/tasks')
          .set('Authorization', `Bearer ${tokens[i]}`)
          .set('x-organization-id', orgIds[i])
          .send({
            title: `Tenant ${i + 1} Task`,
            description: `Task belonging to organization ${i + 1}`,
            priority: 'high'
          });
      }
    });

    test('Tenant 1 should only see their own tasks', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${tokens[0]}`)
        .set('x-organization-id', orgIds[0]);

      expect(response.status).toBe(200);
      expect(response.body.data.tasks).toHaveLength(1);
      expect(response.body.data.tasks[0].title).toBe('Tenant 1 Task');
    });

    test('Cross-tenant task access should be blocked', async () => {
      // Tenant 1 tries to access with Tenant 2's org header
      const response = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${tokens[0]}`)
        .set('x-organization-id', orgIds[1]); // Different org

      expect(response.status).toBe(403);
    });
  });

  describe('Organization Access Control', () => {
    test('User should not access another organization', async () => {
      // User 1 tries to access User 2's organization
      const response = await request(app)
        .get(`/api/orgs/${orgIds[1]}`)
        .set('Authorization', `Bearer ${tokens[0]}`);

      expect(response.status).toBe(403);
    });

    test('User should not update another organization', async () => {
      const response = await request(app)
        .put(`/api/orgs/${orgIds[1]}`)
        .set('Authorization', `Bearer ${tokens[0]}`)
        .send({ name: 'Hacked Organization Name' });

      expect(response.status).toBe(403);
    });

    test('User should not delete another organization', async () => {
      const response = await request(app)
        .delete(`/api/orgs/${orgIds[1]}`)
        .set('Authorization', `Bearer ${tokens[0]}`);

      expect(response.status).toBe(403);
    });
  });

  describe('Member Management Isolation', () => {
    test('User should not invite members to another organization', async () => {
      const response = await request(app)
        .post(`/api/orgs/${orgIds[1]}/members`)
        .set('Authorization', `Bearer ${tokens[0]}`)
        .send({ email: 'test@example.com', role: 'member' });

      expect(response.status).toBe(403);
    });

    test('User should not view another organization\'s members', async () => {
      const response = await request(app)
        .get(`/api/orgs/${orgIds[1]}/members`)
        .set('Authorization', `Bearer ${tokens[0]}`);

      expect(response.status).toBe(403);
    });
  });

  // Clean up after all tests
  afterAll(async () => {
    await User.deleteMany({ email: { $regex: /tenant/ } });
    await Organization.deleteMany({});
    await Property.deleteMany({});
    await Task.deleteMany({});
  });
});