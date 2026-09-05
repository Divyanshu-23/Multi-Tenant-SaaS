/**
 * Organization API Integration Tests (Multi-tenancy)
 */
const request = require('supertest');
const { app } = require('../../src/index');
const User = require('../../src/models/User');
const Organization = require('../../src/models/Organization');
const Member = require('../../src/models/Member');

describe('Organization API Integration Tests (Multi-tenancy)', () => {
  // Test data
  const user1Data = {
    firstName: 'OrgTest',
    lastName: 'User1',
    email: `orgtest_user1_${Date.now()}@test.com`,
    password: 'TestPassword123!',
    phone: '+1234567890'
  };

  const user2Data = {
    firstName: 'OrgTest',
    lastName: 'User2',
    email: `orgtest_user2_${Date.now()}@test.com`,
    password: 'TestPassword123!',
    phone: '+2234567890'
  };

  let user1Token = null;
  let user2Token = null;
  let user1Id = null;
  let user2Id = null;
  let orgId = null;

  beforeAll(async () => {
    // Clean up before tests
    await User.deleteMany({ email: { $regex: /orgtest/ } });
    await Organization.deleteMany({});
    await Member.deleteMany({});
  });

  beforeEach(async () => {
    // Register both users
    const user1Res = await request(app)
      .post('/api/auth/register')
      .send(user1Data);

    const user2Res = await request(app)
      .post('/api/auth/register')
      .send(user2Data);

    user1Token = user1Res.body.token;
    user2Token = user2Res.body.token;
    user1Id = user1Res.body.user.id;
    user2Id = user2Res.body.user.id;
  });

  describe('POST /api/orgs', () => {
    test('should create an organization successfully', async () => {
      const orgData = {
        name: 'Test Organization 1',
        description: 'Test Description 1'
      };

      const response = await request(app)
        .post('/api/orgs')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(orgData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Organization created successfully');
      expect(response.body.data).toHaveProperty('organization');
      expect(response.body.data.organization).toHaveProperty('name', orgData.name);
      expect(response.body.data.organization).toHaveProperty('owner', user1Id);
      expect(response.body.data.organization).toHaveProperty('status', 'active');
      expect(response.body.data).toHaveProperty('isOwner', true);

      orgId = response.body.data.organization._id;
    });

    test('should reject organization creation without authorization', async () => {
      const response = await request(app)
        .post('/api/orgs')
        .send({ name: 'Test Org' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    });

    test('should reject organization creation with invalid name', async () => {
      const response = await request(app)
        .post('/api/orgs')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: '' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/orgs', () => {
    let user1OrgIds = [];

    beforeEach(async () => {
      // Create multiple organizations for user1
      for (let i = 1; i <= 3; i++) {
        const response = await request(app)
          .post('/api/orgs')
          .set('Authorization', `Bearer ${user1Token}`)
          .send({
            name: `Test Org ${i}`,
            description: `Description ${i}`
          });

        user1OrgIds.push(response.body.data.organization._id);
      }
    });

    test('should list user\'s organizations', async () => {
      const response = await request(app)
        .get('/api/orgs')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('organizations');
      expect(Array.isArray(response.body.data.organizations)).toBe(true);
      expect(response.body.data.organizations).toHaveLength(3);
    });

    test('should show only user\'s own organizations', async () => {
      // User2 should have no organizations initially
      const response = await request(app)
        .get('/api/orgs')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.organizations).toHaveLength(0);
    });
  });

  describe('GET /api/orgs/:orgId', () => {
    beforeEach(async () => {
      // Create an organization
      const response = await request(app)
        .post('/api/orgs')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: 'Test Get Organization',
          description: 'Test Description'
        });

      orgId = response.body.data.organization._id;
    });

    test('should get organization details for owner', async () => {
      const response = await request(app)
        .get(`/api/orgs/${orgId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('organization');
      expect(response.body.data.organization).toHaveProperty('_id', orgId);
      expect(response.body.data).toHaveProperty('isOwner', true);
    });

    test('should reject unauthorized access', async () => {
      const response = await request(app)
        .get(`/api/orgs/${orgId}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toMatch(/access.*organization/i);
    });

    test('should reject with invalid organization ID', async () => {
      const response = await request(app)
        .get('/api/orgs/invalid-id')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('PUT /api/orgs/:orgId', () => {
    beforeEach(async () => {
      // Create an organization
      const response = await request(app)
        .post('/api/orgs')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: 'Test Update Organization',
          description: 'Old Description'
        });

      orgId = response.body.data.organization._id;
    });

    test('should update organization successfully', async () => {
      const updateData = {
        name: 'Updated Organization Name',
        description: 'Updated Description',
        settings: {
          allowPublicProperties: false,
          defaultPropertyStatus: 'draft'
        }
      };

      const response = await request(app)
        .put(`/api/orgs/${orgId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.organization).toHaveProperty('name', updateData.name);
      expect(response.body.data.organization).toHaveProperty('description', updateData.description);
    });

    test('should reject update by non-owner', async () => {
      const response = await request(app)
        .put(`/api/orgs/${orgId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ name: 'Unauthorized Update' });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/orgs/:orgId/members', () => {
    beforeEach(async () => {
      // Create an organization
      const response = await request(app)
        .post('/api/orgs')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: 'Test Members Organization',
          description: 'Test Description'
        });

      orgId = response.body.data.organization._id;
    });

    test('should invite a member successfully', async () => {
      const inviteData = {
        email: user2Data.email,
        role: 'member'
      };

      const response = await request(app)
        .post(`/api/orgs/${orgId}/members`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(inviteData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Member invited successfully');
      expect(response.body.data).toHaveProperty('member');
      expect(response.body.data.member).toHaveProperty('user', user2Id);
      expect(response.body.data.member).toHaveProperty('role', 'member');
    });

    test('should reject member invite by non-owner', async () => {
      const response = await request(app)
        .post(`/api/orgs/${orgId}/members`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ email: 'test@example.com', role: 'member' });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/orgs/:orgId/members', () => {
    beforeEach(async () => {
      // Create organization and invite user2 as member
      const orgRes = await request(app)
        .post('/api/orgs')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: 'Test Members List Org',
          description: 'Test Description'
        });

      orgId = orgRes.body.data.organization._id;

      await request(app)
        .post(`/api/orgs/${orgId}/members`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ email: user2Data.email, role: 'member' });
    });

    test('should list organization members', async () => {
      const response = await request(app)
        .get(`/api/orgs/${orgId}/members`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('members');
      expect(Array.isArray(response.body.data.members)).toBe(true);
      expect(response.body.data.members).toHaveLength(2); // Owner + invited member
    });

    test('should allow member to view members list', async () => {
      const response = await request(app)
        .get(`/api/orgs/${orgId}/members`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('members');
    });
  });

  describe('DELETE /api/orgs/:orgId/members/:userId', () => {
    let memberUserId = null;

    beforeEach(async () => {
      // Create organization
      const orgRes = await request(app)
        .post('/api/orgs')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: 'Test Remove Member Org',
          description: 'Test Description'
        });

      orgId = orgRes.body.data.organization._id;

      // Invite a new user as member
      const newUserRes = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Member',
          lastName: 'ToRemove',
          email: `member_remove_${Date.now()}@test.com`,
          password: 'TestPassword123!',
          phone: '+3334567890'
        });

      memberUserId = newUserRes.body.data.user._id;

      await request(app)
        .post(`/api/orgs/${orgId}/members`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ email: `member_remove_${Date.now()}@test.com`, role: 'member' });
    });

    test('should remove member successfully', async () => {
      const response = await request(app)
        .delete(`/api/orgs/${orgId}/members/${memberUserId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toMatch(/removed.*successfully/i);
    });

    test('should reject member removal by non-owner', async () => {
      const response = await request(app)
        .delete(`/api/orgs/${orgId}/members/${memberUserId}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  // Clean up after all tests
  afterAll(async () => {
    await User.deleteMany({ email: { $regex: /orgtest/ } });
    await Organization.deleteMany({});
    await Member.deleteMany({});
  });
});
