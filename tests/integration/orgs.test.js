/**
 * Organization API Integration Tests
 * Verifies org CRUD, membership, and admin-only member management
 * against the real API contract.
 */
const request = require('supertest');
const { app } = require('../../src/index');
const User = require('../../src/models/User');
const Organization = require('../../src/models/Organization');
const Member = require('../../src/models/Member');

describe('Organization API Integration Tests', () => {
  const suffix = Date.now();
  const userData = (n) => ({
    firstName: 'OrgTest',
    lastName: `User${n}`,
    email: `orgtest_user${n}_${suffix}@test.com`,
    password: 'TestPassword123!',
    phone: `${n}23456789${n}`,
    confirmPassword: 'TestPassword123!',
    termsAccepted: true,
    accountType: 'organization',
  });

  let user1Token;
  let user2Token;
  let user3Token;
  let user1Id;
  let user2Id;

  beforeAll(async () => {
    await User.deleteMany({ email: { $regex: /orgtest/ } });
    await Organization.deleteMany({});
    await Member.deleteMany({});

    const u1 = await request(app).post('/api/auth/register').send(userData(1));
    const u2 = await request(app).post('/api/auth/register').send(userData(2));
    const u3 = await request(app).post('/api/auth/register').send(userData(3));
    const u4 = await request(app).post('/api/auth/register').send(userData(4));

    user1Token = u1.body.token;
    user2Token = u2.body.token;
    user3Token = u3.body.token;
    user1Id = u1.body.user.id;
    user2Id = u2.body.user.id;

    expect(user1Token).toBeDefined();
    expect(u1.status).toBe(201);
    expect(u2.status).toBe(201);
    expect(u3.status).toBe(201);
    expect(u4.status).toBe(201);
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $regex: /orgtest/ } });
    await Organization.deleteMany({});
    await Member.deleteMany({});
  });

  describe('POST /api/orgs - Create organization', () => {
    test('should create an organization successfully', async () => {
      const response = await request(app)
        .post('/api/orgs')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Test Organization 1', description: 'Test Description 1' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Organization created successfully');
      expect(response.body.data.organization.name).toBe('Test Organization 1');
      expect(response.body.data.organization.slug).toBe('test-organization-1');
      expect(response.body.data.organization.createdBy).toBe(user1Id);
      expect(response.body.data.organization.status).toBe('active');
      expect(response.body.data.organization._id).toBeDefined();
      expect(response.body.data.isOwner).toBe(true);
    });

    test('should reject organization creation without auth', async () => {
      const response = await request(app)
        .post('/api/orgs')
        .send({ name: 'Unauthorized Org' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should reject organization creation with invalid name', async () => {
      const response = await request(app)
        .post('/api/orgs')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'A' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    test('should create slugs that handle collisions', async () => {
      const first = await request(app)
        .post('/api/orgs')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Collision Test' });
      const second = await request(app)
        .post('/api/orgs')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Collision Test' });

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(first.body.data.organization.slug).toBe('collision-test');
      expect(second.body.data.organization.slug).toBe('collision-test-1');
    });
  });

  describe('GET /api/orgs - List user organizations', () => {
    test("should list only the user's organizations with role and memberId", async () => {
      const orgNames = ['List Org A', 'List Org B', 'List Org C'];
      for (const name of orgNames) {
        await request(app)
          .post('/api/orgs')
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ name });
      }

      const response = await request(app)
        .get('/api/orgs')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.organizations)).toBe(true);
      expect(response.body.data.organizations.length).toBeGreaterThanOrEqual(3);

      const listOrg = response.body.data.organizations.find((o) => o.name === 'List Org B');
      expect(listOrg).toBeDefined();
      expect(listOrg.role).toBe('admin');
      expect(listOrg.memberId).toBeDefined();
    });

    test('should return empty list for a user with no organizations', async () => {
      const response = await request(app)
        .get('/api/orgs')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.organizations).toEqual([]);
    });

    test('should reject listing without auth', async () => {
      const response = await request(app).get('/api/orgs');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/orgs/:orgId - Get organization details', () => {
    let orgId;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/orgs')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Detail Organization' });
      orgId = response.body.data.organization._id;
    });

    test('should return organization details to a member', async () => {
      const response = await request(app)
        .get(`/api/orgs/${orgId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.organization._id).toBe(orgId);
      expect(response.body.data.organization.name).toBe('Detail Organization');
      expect(response.body.data.organization.memberCount).toBe(1);
      expect(response.body.data.isOwner).toBe(true);
      expect(response.body.data.role).toBe('admin');
    });

    test('should reject access for a non-member', async () => {
      const response = await request(app)
        .get(`/api/orgs/${orgId}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    test('should return 404 for an invalid organization id', async () => {
      const response = await request(app)
        .get('/api/orgs/not-a-valid-id')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/orgs/:orgId - Update organization', () => {
    let orgId;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/orgs')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Update Organization', description: 'Original' });
      orgId = response.body.data.organization._id;
    });

    test('should allow the admin to update the organization', async () => {
      const response = await request(app)
        .put(`/api/orgs/${orgId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Updated Organization Name', description: 'Updated description' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Organization updated successfully');
      expect(response.body.data.organization.name).toBe('Updated Organization Name');
      expect(response.body.data.organization.description).toBe('Updated description');
    });

    test('should reject updates by a non-admin', async () => {
      const response = await request(app)
        .put(`/api/orgs/${orgId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ name: 'Hacked Name' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    test('should return 404 for an unknown organization', async () => {
      const response = await request(app)
        .put(`/api/orgs/${'5f8f8f8f8f8f8f8f8f8f8f8f'.slice(0, 23)}1`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Nope' });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/orgs/:orgId/members - Invite member', () => {
    let orgId;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/orgs')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Invite Organization' });
      orgId = response.body.data.organization._id;
    });

    test('should invite a user to the organization', async () => {
      const response = await request(app)
        .post(`/api/orgs/${orgId}/members`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ email: userData(2).email, role: 'member' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Member invited successfully');
      expect(response.body.data.member.user).toBe(user2Id);
      expect(response.body.data.member.email).toBe(userData(2).email);
      expect(response.body.data.member.role).toBe('member');
      expect(response.body.data.member.status).toBe('active');
    });

    test('should reject invites from a non-admin', async () => {
      const response = await request(app)
        .post(`/api/orgs/${orgId}/members`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ email: `stranger_${suffix}@test.com`, role: 'member' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    test('should reject inviting an unknown email', async () => {
      const response = await request(app)
        .post(`/api/orgs/${orgId}/members`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ email: `nobody_${suffix}@test.com`, role: 'member' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/orgs/:orgId/members - List members', () => {
    let orgId;

    beforeEach(async () => {
      const created = await request(app)
        .post('/api/orgs')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Members Organization' });
      orgId = created.body.data.organization._id;

      await request(app)
        .post(`/api/orgs/${orgId}/members`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ email: userData(3).email, role: 'member' });
    });

    test('should list owner and invited member', async () => {
      const response = await request(app)
        .get(`/api/orgs/${orgId}/members`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.members)).toBe(true);
      expect(response.body.data.members.length).toBe(2);
      const roles = response.body.data.members.map((m) => m.role);
      expect(roles).toContain('admin');
      expect(roles).toContain('member');
      const invited = response.body.data.members.find((m) => m.role === 'member');
      expect(invited.userId).toBeDefined();
      expect(invited.userId.firstName).toBe('OrgTest');
    });

    test('should allow a member to view the member list', async () => {
      const response = await request(app)
        .get(`/api/orgs/${orgId}/members`)
        .set('Authorization', `Bearer ${user3Token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/orgs/:orgId/members/:userId - Remove member', () => {
    let orgId;

    beforeEach(async () => {
      const created = await request(app)
        .post('/api/orgs')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Remove Member Org' });
      orgId = created.body.data.organization._id;

      await request(app)
        .post(`/api/orgs/${orgId}/members`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ email: userData(4).email, role: 'member' });
    });

    test('should reject removal by a non-admin', async () => {
      const response = await request(app)
        .delete(`/api/orgs/${orgId}/members/${user2Id}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    test('should remove a member successfully', async () => {
      const memberList = await request(app)
        .get(`/api/orgs/${orgId}/members`)
        .set('Authorization', `Bearer ${user1Token}`);
      const target = memberList.body.data.members.find((m) => m.role === 'member');
      expect(target).toBeDefined();

      const response = await request(app)
        .delete(`/api/orgs/${orgId}/members/${target.userId._id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Member removed successfully');

      const afterList = await request(app)
        .get(`/api/orgs/${orgId}/members`)
        .set('Authorization', `Bearer ${user1Token}`);
      expect(afterList.body.data.members.length).toBe(1);
    });
  });
});
