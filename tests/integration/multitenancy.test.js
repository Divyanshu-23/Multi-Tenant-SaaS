/**
 * Multi-Tenancy Isolation Integration Tests
 * Verifies that users in one organization cannot access or mutate
 * another organization's data across properties, tasks, and org APIs.
 */
const request = require('supertest');
const { app } = require('../../src/index');
const User = require('../../src/models/User');
const Organization = require('../../src/models/Organization');
const Member = require('../../src/models/Member');
const Property = require('../../src/models/Property');
const Task = require('../../src/models/Task');

const propertyPayload = (title) => ({
  title,
  description: 'Isolation test property with complete required fields and a good location.',
  propertyType: 'apartment',
  listingType: 'sale',
  price: 4500000,
  location: { address: '77 Isolation Street', city: 'Pune', state: 'Maharashtra', country: 'India', pincode: '411001' },
  features: { superArea: 1100, bedrooms: 2, bathrooms: 2 },
  area: { superArea: 1100, carpetArea: 900 },
  owner: { name: 'Isolation Owner', phone: '+919999999999' },
  status: 'available',
});

const taskPayload = (title, assigneeId) => ({
  title,
  priority: 'medium',
  taskType: 'lead',
  assignee: assigneeId,
});

describe('Multi-Tenancy Isolation Integration Tests', () => {
  const suffix = Date.now();
  const users = [
    { firstName: 'Tenant', lastName: 'One', email: `tenant_one_${suffix}@test.com`, password: 'TestPassword123!', phone: '1122334455', confirmPassword: 'TestPassword123!', termsAccepted: true },
    { firstName: 'Tenant', lastName: 'Two', email: `tenant_two_${suffix}@test.com`, password: 'TestPassword123!', phone: '2233445566', confirmPassword: 'TestPassword123!', termsAccepted: true },
    { firstName: 'Tenant', lastName: 'Three', email: `tenant_three_${suffix}@test.com`, password: 'TestPassword123!', phone: '3344556677', confirmPassword: 'TestPassword123!', termsAccepted: true },
  ];

  const credentials = {}; // tenant index -> { token, userId }
  const orgIds = {};      // tenant index -> org id

  beforeAll(async () => {
    await User.deleteMany({ email: { $regex: /tenant_/ } });
    await Organization.deleteMany({});
    await Member.deleteMany({});
    await Property.deleteMany({});
    await Task.deleteMany({});

    for (let i = 0; i < users.length; i++) {
      const reg = await request(app).post('/api/auth/register').send(users[i]);
      expect(reg.status).toBe(201);
      credentials[i] = { token: reg.body.token, userId: reg.body.user.id };

      const org = await request(app)
        .post('/api/orgs')
        .set('Authorization', `Bearer ${reg.body.token}`)
        .send({ name: `Tenant Org ${users[i].firstName} ${i}` });
      expect(org.status).toBe(201);
      orgIds[i] = org.body.data.organization._id;
    }
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $regex: /tenant_/ } });
    await Organization.deleteMany({});
    await Member.deleteMany({});
    await Property.deleteMany({});
    await Task.deleteMany({});
  });

  const headers = (tenantIndex, orgIndex) => ({
    Authorization: `Bearer ${credentials[tenantIndex].token}`,
    'x-organization-id': orgIds[orgIndex],
  });

  describe('Property isolation', () => {
    beforeAll(async () => {
      for (let i = 0; i < users.length; i++) {
        const create = await request(app)
          .post('/api/properties')
          .set(headers(i, i))
          .send(propertyPayload(`Tenant ${i} Property`));
        expect(create.status).toBe(201);
      }
    });

    test('each tenant sees only its own properties', async () => {
      const zero = await request(app)
        .get('/api/properties?limit=50')
        .set(headers(0, 0));
      const one = await request(app)
        .get('/api/properties?limit=50')
        .set(headers(1, 1));

      expect(zero.body.properties).toHaveLength(1);
      expect(zero.body.properties[0].title).toBe('Tenant 0 Property');
      expect(one.body.properties).toHaveLength(1);
      expect(one.body.properties[0].title).toBe('Tenant 1 Property');
    });

    test('a tenant cannot read another tenant property with its own org header', async () => {
      const response = await request(app)
        .get('/api/properties?limit=50')
        .set(headers(0, 1));

      expect(response.status).toBe(403);
    });

    test('a tenant cannot list properties using another org\'s header', async () => {
      const response = await request(app)
        .get('/api/properties?limit=50')
        .set(headers(2, 0));

      expect(response.status).toBe(403);
    });

    test('a tenant cannot retrieve another tenant property by id', async () => {
      const list = await request(app)
        .get('/api/properties?limit=1')
        .set(headers(0, 0));
      const tenant0PropertyId = list.body.properties[0]._id;

      const response = await request(app)
        .get(`/api/properties/${tenant0PropertyId}`)
        .set(headers(1, 1));

      // Tenant 1 is not a member of org 0; the org header (org 1) does not
      // contain the property, so it is not found in the tenant's scope.
      expect([403, 404]).toContain(response.status);
    });

    test('a tenant cannot create a property inside another tenant org', async () => {
      const response = await request(app)
        .post('/api/properties')
        .set(headers(0, 1))
        .send(propertyPayload('Intruder Property'));

      expect(response.status).toBe(403);
    });

    test('a tenant cannot update another tenant property', async () => {
      const list = await request(app)
        .get('/api/properties?limit=1')
        .set(headers(0, 0));
      const propertyId = list.body.properties[0]._id;

      const response = await request(app)
        .put(`/api/properties/${propertyId}`)
        .set(headers(1, 1))
        .send({ price: 1 });

      expect([403, 404]).toContain(response.status);
    });
  });

  describe('Task isolation', () => {
    beforeAll(async () => {
      for (let i = 0; i < users.length; i++) {
        const create = await request(app)
          .post('/api/tasks')
          .set(headers(i, i))
          .send(taskPayload(`Tenant ${i} Task`, credentials[i].userId));
        expect(create.status).toBe(201);
      }
    });

    test('each tenant sees only its own tasks', async () => {
      const zero = await request(app)
        .get('/api/tasks?limit=50')
        .set(headers(0, 0));
      const one = await request(app)
        .get('/api/tasks?limit=50')
        .set(headers(1, 1));

      expect(zero.body.tasks).toHaveLength(1);
      expect(zero.body.tasks[0].title).toBe('Tenant 0 Task');
      expect(one.body.tasks).toHaveLength(1);
      expect(one.body.tasks[0].title).toBe('Tenant 1 Task');
    });

    test('a tenant cannot list tasks of another org', async () => {
      const response = await request(app)
        .get('/api/tasks?limit=50')
        .set(headers(0, 2));

      expect(response.status).toBe(403);
    });

    test('a tenant cannot retrieve another tenant task by id', async () => {
      const list = await request(app)
        .get('/api/tasks?limit=1')
        .set(headers(0, 0));
      const taskId = list.body.tasks[0]._id;

      const response = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set(headers(2, 2));

      expect([403, 404]).toContain(response.status);
    });

    test('a tenant cannot create a task inside another tenant org', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .set(headers(0, 1))
        .send(taskPayload('Intruder Task', credentials[0].userId));

      expect(response.status).toBe(403);
    });

    test('a tenant cannot update another tenant task', async () => {
      const list = await request(app)
        .get('/api/tasks?limit=1')
        .set(headers(0, 0));
      const taskId = list.body.tasks[0]._id;

      const response = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set(headers(1, 1))
        .send({ status: 'completed' });

      expect([403, 404]).toContain(response.status);
    });
  });

  describe('Organization data isolation', () => {
    test('a tenant cannot view another org details', async () => {
      const response = await request(app)
        .get(`/api/orgs/${orgIds[0]}`)
        .set('Authorization', `Bearer ${credentials[1].token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    test('a tenant cannot update another org', async () => {
      const response = await request(app)
        .put(`/api/orgs/${orgIds[0]}`)
        .set('Authorization', `Bearer ${credentials[1].token}`)
        .send({ name: 'Hacked Org Name' });

      expect(response.status).toBe(403);
    });

    test('a tenant cannot invite members to another org', async () => {
      const response = await request(app)
        .post(`/api/orgs/${orgIds[0]}/members`)
        .set('Authorization', `Bearer ${credentials[1].token}`)
        .send({ email: users[2].email, role: 'member' });

      expect(response.status).toBe(403);
    });

    test('a tenant cannot view another org member list', async () => {
      const response = await request(app)
        .get(`/api/orgs/${orgIds[0]}/members`)
        .set('Authorization', `Bearer ${credentials[1].token}`);

      expect(response.status).toBe(403);
    });

    test('a tenant cannot remove another org member', async () => {
      const response = await request(app)
        .delete(`/api/orgs/${orgIds[0]}/members/${credentials[2].userId}`)
        .set('Authorization', `Bearer ${credentials[1].token}`);

      expect(response.status).toBe(403);
    });

    test('organization deletion endpoint is not exposed to tenants', async () => {
      const response = await request(app)
        .delete(`/api/orgs/${orgIds[0]}`)
        .set('Authorization', `Bearer ${credentials[1].token}`);

      // No DELETE /api/orgs/:orgId route exists, so this must never succeed.
      expect(response.status).toBe(404);
    });

    test('tenant 1 remains untouched after tenant 2 attempts', async () => {
      const check = await request(app)
        .get(`/api/orgs/${orgIds[0]}/members`)
        .set('Authorization', `Bearer ${credentials[0].token}`);

      expect(check.status).toBe(200);
      expect(check.body.data.members).toHaveLength(1);
    });
  });
});
