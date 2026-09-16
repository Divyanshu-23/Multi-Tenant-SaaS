/**
 * Property API Integration Tests
 * Verifies property CRUD, listing filters, search, and stats
 * against the real API contract (property routes run inside org context).
 */
const request = require('supertest');
const { app } = require('../../src/index');
const User = require('../../src/models/User');
const Organization = require('../../src/models/Organization');
const Member = require('../../src/models/Member');
const Property = require('../../src/models/Property');

const propertyPayload = (overrides = {}) => ({
  title: 'Luxury Apartment',
  description: 'A beautiful modern apartment in the heart of the city with sea views and premium finishes.',
  propertyType: 'apartment',
  listingType: 'sale',
  price: 5000000,
  location: {
    address: '123 Main Street',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    pincode: '400001',
    coordinates: { lat: 19.076, lng: 72.8777 },
  },
  features: {
    superArea: 1200,
    bedrooms: 3,
    bathrooms: 2,
    parking: 2,
    furnishing: 'semi_furnished',
    balcony: true,
  },
  area: {
    superArea: 1200,
    carpetArea: 950,
  },
  owner: {
    name: 'Ramesh Kumar',
    phone: '+919876543210',
    email: 'ramesh@example.com',
  },
  status: 'available',
  ...overrides,
});

describe('Property API Integration Tests', () => {
  const suffix = Date.now();
  const makeUser = (n) => ({
    firstName: 'PropertyTest',
    lastName: `User${n}`,
    email: `propertytest_user${n}_${suffix}@test.com`,
    password: 'TestPassword123!',
    phone: `${n}42345678${n}`,
    confirmPassword: 'TestPassword123!',
    termsAccepted: true,
    accountType: 'organization',
  });

  let user1Token;
  let user1Id;
  let user2Token;
  let orgId;

  beforeAll(async () => {
    await User.deleteMany({ email: { $regex: /propertytest/ } });
    await Organization.deleteMany({});
    await Member.deleteMany({});
    await Property.deleteMany({});

    const u1 = await request(app).post('/api/auth/register').send(makeUser(1));
    const u2 = await request(app).post('/api/auth/register').send(makeUser(2));
    user1Token = u1.body.token;
    user2Token = u2.body.token;
    user1Id = u1.body.user.id;

    const orgResponse = await request(app)
      .post('/api/orgs')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ name: 'PropertyTest Org' });
    orgId = orgResponse.body.data.organization._id;
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $regex: /propertytest/ } });
    await Organization.deleteMany({});
    await Member.deleteMany({});
    await Property.deleteMany({});
  });

  const orgHeaders = () => ({
    Authorization: `Bearer ${user1Token}`,
    'x-organization-id': orgId,
  });

  describe('POST /api/properties - Create property', () => {
    test('should create a property successfully', async () => {
      const response = await request(app)
        .post('/api/properties')
        .set(orgHeaders())
        .send(propertyPayload({ title: 'Create Test Apartment' }));

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Property created successfully');
      expect(response.body.property).toBeDefined();
      expect(response.body.property.id).toBeDefined();
      expect(response.body.property.title).toBe('Create Test Apartment');
      expect(response.body.property.price).toBe(5000000);
      expect(response.body.property.status).toBe('available');
      expect(response.body.property.location.city).toBe('Mumbai');
    });

    test('should reject creation without org context', async () => {
      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(propertyPayload());

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should reject creation by a non-member of the organization', async () => {
      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${user2Token}`)
        .set('x-organization-id', orgId)
        .send(propertyPayload());

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    test('should reject invalid property data', async () => {
      const response = await request(app)
        .post('/api/properties')
        .set(orgHeaders())
        .send(propertyPayload({ title: '', price: -1000, location: { city: 'Mumbai' } }));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('GET /api/properties - List properties', () => {
    beforeEach(async () => {
      await Property.deleteMany({ organizationId: orgId });
      const base = {
        s1: propertyPayload({ title: 'List Apartment A', status: 'available', propertyType: 'apartment', price: 5000000 }),
        s2: propertyPayload({ title: 'List Villa B', status: 'sold', propertyType: 'villa', price: 3000000 }),
        s3: propertyPayload({ title: 'List Apartment C', status: 'available', propertyType: 'apartment', price: 8000000 }),
      };
      await request(app).post('/api/properties').set(orgHeaders()).send(propertyPayload(base.s1));
      await request(app).post('/api/properties').set(orgHeaders()).send(propertyPayload(base.s2));
      await request(app).post('/api/properties').set(orgHeaders()).send(propertyPayload(base.s3));
    });

    test('should list all properties with pagination', async () => {
      const response = await request(app)
        .get('/api/properties')
        .set(orgHeaders());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(3);
      expect(response.body.pagination.total).toBe(3);
      expect(response.body.properties).toHaveLength(3);
      expect(response.body.properties[0].title).toBeDefined();
    });

    test('should filter by status', async () => {
      const response = await request(app)
        .get('/api/properties?status=available')
        .set(orgHeaders());

      expect(response.status).toBe(200);
      expect(response.body.properties).toHaveLength(2);
      expect(response.body.properties.every((p) => p.status === 'available')).toBe(true);
    });

    test('should filter by propertyType', async () => {
      const response = await request(app)
        .get('/api/properties?propertyType=villa')
        .set(orgHeaders());

      expect(response.status).toBe(200);
      expect(response.body.properties).toHaveLength(1);
      expect(response.body.properties[0].title).toBe('List Villa B');
    });

    test('should filter by minPrice', async () => {
      const response = await request(app)
        .get('/api/properties?minPrice=6000000')
        .set(orgHeaders());

      expect(response.status).toBe(200);
      expect(response.body.properties).toHaveLength(1);
      expect(response.body.properties[0].price).toBe(8000000);
    });
  });

  describe('GET /api/properties/:id - Get property details', () => {
    let propertyId;

    beforeEach(async () => {
      await Property.deleteMany({ organizationId: orgId });
      const created = await request(app)
        .post('/api/properties')
        .set(orgHeaders())
        .send(propertyPayload({ title: 'Detail Property' }));
      propertyId = created.body.property.id;
    });

    test('should return property details to an org member', async () => {
      const response = await request(app)
        .get(`/api/properties/${propertyId}`)
        .set(orgHeaders());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.property._id).toBe(propertyId);
      expect(response.body.property.title).toBe('Detail Property');
      expect(response.body.property.organizationId).toBe(orgId);
      expect(response.body.property.createdBy).toBeDefined();
    });

    test('should return 404 for a non-existent property', async () => {
      const response = await request(app)
        .get('/api/properties/5f8f8f8f8f8f8f8f8f8f8f8f')
        .set(orgHeaders());

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    test('should block access from a different organization', async () => {
      const otherOrg = await request(app)
        .post('/api/orgs')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ name: 'PropertyTest Other Org' });

      const user2OrgId = otherOrg.body.data.organization._id;

      const response = await request(app)
        .get(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .set('x-organization-id', user2OrgId);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    test('should deny cross-tenant access with an unowned organization header', async () => {
      const response = await request(app)
        .get(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .set('x-organization-id', orgId);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/properties/:id - Update property', () => {
    let propertyId;

    beforeEach(async () => {
      await Property.deleteMany({ organizationId: orgId });
      const created = await request(app)
        .post('/api/properties')
        .set(orgHeaders())
        .send(propertyPayload({ title: 'Update Property' }));
      propertyId = created.body.property.id;
    });

    test('should update the property', async () => {
      const response = await request(app)
        .put(`/api/properties/${propertyId}`)
        .set(orgHeaders())
        .send({ title: 'Updated Property Title', description: 'A freshly updated listing description.', price: 6000000, status: 'sold' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Property updated successfully');
      expect(response.body.property.title).toBe('Updated Property Title');
      expect(response.body.property.price).toBe(6000000);
      expect(response.body.property.status).toBe('sold');
    });

    test('should reject updates from a non-member organization', async () => {
      const response = await request(app)
        .put(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .set('x-organization-id', orgId)
        .send({ title: 'Hacked Title' });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/properties/:id - Delete property', () => {
    let propertyId;

    beforeEach(async () => {
      await Property.deleteMany({ organizationId: orgId });
      const created = await request(app)
        .post('/api/properties')
        .set(orgHeaders())
        .send(propertyPayload({ title: 'Delete Property' }));
      propertyId = created.body.property.id;
    });

    test('should delete the property', async () => {
      const response = await request(app)
        .delete(`/api/properties/${propertyId}`)
        .set(orgHeaders());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const after = await request(app)
        .get(`/api/properties/${propertyId}`)
        .set(orgHeaders());
      expect(after.status).toBe(404);
    });

    test('should reject deletion from a non-member organization', async () => {
      const response = await request(app)
        .delete(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .set('x-organization-id', orgId);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/properties/search/query - Full-text search', () => {
    beforeEach(async () => {
      await Property.deleteMany({ organizationId: orgId });
      await request(app).post('/api/properties').set(orgHeaders()).send(propertyPayload({
        title: 'Mumbai Beach House',
        description: 'A cozy beach house near Marine Drive with amazing ocean views.',
      }));
      await request(app).post('/api/properties').set(orgHeaders()).send(propertyPayload({
        title: 'Mumbai Penthouse',
        description: 'Luxury penthouse in Lower Parel with skyline views.',
      }));
      await request(app).post('/api/properties').set(orgHeaders()).send(propertyPayload({
        title: 'Delhi Farmhouse',
        description: 'Spacious farmhouse on the outskirts of Delhi.',
      }));
    });

    test('should return matching properties', async () => {
      const response = await request(app)
        .get('/api/properties/search/query?q=Mumbai')
        .set(orgHeaders());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.query).toBe('Mumbai');
      expect(response.body.results.length).toBe(2);
      expect(response.body.pagination.total).toBe(2);
    });

    test('should return empty results for a miss', async () => {
      const response = await request(app)
        .get('/api/properties/search/query?q=nonexistentxyz')
        .set(orgHeaders());

      expect(response.status).toBe(200);
      expect(response.body.results).toEqual([]);
    });
  });

  describe('GET /api/properties/stats/overview - Statistics', () => {
    test('should aggregate statistics for the organization', async () => {
      await Property.deleteMany({ organizationId: orgId });
      await request(app).post('/api/properties').set(orgHeaders()).send(propertyPayload({ price: 5000000, status: 'available' }));
      await request(app).post('/api/properties').set(orgHeaders()).send(propertyPayload({ price: 3000000, status: 'sold' }));
      await request(app).post('/api/properties').set(orgHeaders()).send(propertyPayload({ price: 1000000, status: 'available' }));

      const response = await request(app)
        .get('/api/properties/stats/overview')
        .set(orgHeaders());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.stats.total).toBe(3);
      expect(response.body.stats.avgPrice).toBe(3000000);
      expect(response.body.stats.minPrice).toBe(1000000);
      expect(response.body.stats.maxPrice).toBe(5000000);
      expect(response.body.stats.byStatus.available).toBe(2);
      expect(response.body.stats.byStatus.sold).toBe(1);
      expect(response.body.stats.byType.apartment).toBe(3);
    });

    test('should return zeroed stats for an organization with no properties', async () => {
      const orphanOrg = await request(app)
        .post('/api/orgs')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Stats Empty Org' });
      const newOrgId = orphanOrg.body.data.organization._id;

      const response = await request(app)
        .get('/api/properties/stats/overview')
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', newOrgId);

      expect(response.status).toBe(200);
      expect(response.body.stats.total).toBe(0);
      expect(response.body.stats.avgPrice).toBe(0);
    });

    test('should not leak another organization data via creator id', async () => {
      expect(user1Id).toBeDefined();
      const response = await request(app)
        .get('/api/properties/stats/overview')
        .set('Authorization', `Bearer ${user2Token}`)
        .set('x-organization-id', orgId);

      expect(response.status).toBe(403);
    });
  });
});
