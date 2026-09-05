/**
 * Property Management API Integration Tests
 */
const request = require('supertest');
const { app } = require('../../src/index');
const User = require('../../src/models/User');
const Organization = require('../../src/models/Organization');
const Property = require('../../src/models/Property');

describe('Property Management API Integration Tests', () => {
  // Test data
  const user1Data = {
    firstName: 'PropertyTest',
    lastName: 'User1',
    email: `propertytest_user1_${Date.now()}@test.com`,
    password: 'TestPassword123!',
    phone: '+1234567890'
  };

  const user2Data = {
    firstName: 'PropertyTest',
    lastName: 'User2',
    email: `propertytest_user2_${Date.now()}@test.com`,
    password: 'TestPassword123!',
    phone: '+2234567890'
  };

  let user1Token = null;
  let user2Token = null;
  let user1Id = null;
  let orgId = null;
  let propertyId = null;

  beforeAll(async () => {
    // Clean up before tests
    await User.deleteMany({ email: { $regex: /propertytest/ } });
    await Organization.deleteMany({});
    await Property.deleteMany({});
  });

  beforeEach(async () => {
    // Register users
    const user1Res = await request(app)
      .post('/api/auth/register')
      .send(user1Data);

    const user2Res = await request(app)
      .post('/api/auth/register')
      .send(user2Data);

    user1Token = user1Res.body.token;
    user2Token = user2Res.body.token;
    user1Id = user1Res.body.user.id;

    // Create organization for user1
    const orgRes = await request(app)
      .post('/api/orgs')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        name: 'Test Property Organization',
        description: 'Test Description'
      });

    orgId = orgRes.body.data.organization._id;
  });

  describe('POST /api/properties', () => {
    const propertyData = {
      title: 'Luxury Beachfront Villa',
      description: 'Beautiful 4BHK villa with private beach access',
      propertyType: 'villa',
      listingType: 'sale',
      price: 15000000,
      status: 'available',
      location: {
        address: '456 Ocean Drive',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        pincode: '400001'
      },
      features: {
        bedrooms: 4,
        bathrooms: 3,
        superArea: 2500,
        coveredArea: 2000
      },
      owner: {
        name: 'John Smith',
        phone: '+9876543210',
        email: 'john.smith@example.com'
      }
    };

    test('should create a property successfully', async () => {
      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId)
        .send(propertyData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Property created successfully');
      expect(response.body.data).toHaveProperty('property');
      expect(response.body.data.property).toHaveProperty('title', propertyData.title);
      expect(response.body.data.property).toHaveProperty('price', propertyData.price);
      expect(response.body.data.property).toHaveProperty('organization', orgId);
      expect(response.body.data.property).toHaveProperty('createdBy', user1Id);
      expect(response.body.data.property.location).toMatchObject(propertyData.location);
      expect(response.body.data.property.features).toMatchObject(propertyData.features);

      propertyId = response.body.data.property._id;
    });

    test('should reject property creation without organization header', async () => {
      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(propertyData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toMatch(/organization.*required/i);
    });

    test('should reject property creation with invalid organization access', async () => {
      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${user2Token}`) // User2 doesn't have access to org
        .set('x-organization-id', orgId)
        .send(propertyData);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('success', false);
    });

    test('should reject property creation with invalid data', async () => {
      const invalidData = {
        title: '',
        price: -1000 // Invalid price
      };

      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/properties', () => {
    beforeEach(async () => {
      // Create multiple properties
      const properties = [
        {
          title: 'Property 1',
          description: 'Description 1',
          propertyType: 'apartment',
          listingType: 'sale',
          price: 5000000,
          status: 'available',
          location: { address: 'Address 1', city: 'City1' }
        },
        {
          title: 'Property 2',
          description: 'Description 2',
          propertyType: 'villa',
          listingType: 'rent',
          price: 30000,
          status: 'sold',
          location: { address: 'Address 2', city: 'City2' }
        },
        {
          title: 'Property 3',
          description: 'Description 3',
          propertyType: 'apartment',
          listingType: 'sale',
          price: 8000000,
          status: 'available',
          location: { address: 'Address 3', city: 'City1' }
        }
      ];

      for (const prop of properties) {
        await request(app)
          .post('/api/properties')
          .set('Authorization', `Bearer ${user1Token}`)
          .set('x-organization-id', orgId)
          .send(prop);
      }
    });

    test('should list properties with pagination', async () => {
      const response = await request(app)
        .get('/api/properties')
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('properties');
      expect(Array.isArray(response.body.data.properties)).toBe(true);
      expect(response.body.data.properties).toHaveLength(3);
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.pagination).toHaveProperty('total', 3);
    });

    test('should filter properties by status', async () => {
      const response = await request(app)
        .get('/api/properties?status=available')
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId);

      expect(response.status).toBe(200);
      expect(response.body.data.properties).toHaveLength(2); // Only available properties
      response.body.data.properties.forEach(property => {
        expect(property.status).toBe('available');
      });
    });

    test('should filter properties by property type', async () => {
      const response = await request(app)
        .get('/api/properties?propertyType=apartment')
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId);

      expect(response.status).toBe(200);
      expect(response.body.data.properties).toHaveLength(2); // Only apartments
      response.body.data.properties.forEach(property => {
        expect(property.propertyType).toBe('apartment');
      });
    });

    test('should filter properties by price range', async () => {
      const response = await request(app)
        .get('/api/properties?minPrice=6000000')
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId);

      expect(response.status).toBe(200);
      expect(response.body.data.properties).toHaveLength(1);
      expect(response.body.data.properties[0].price).toBeGreaterThanOrEqual(6000000);
    });
  });

  describe('GET /api/properties/:id', () => {
    beforeEach(async () => {
      // Create a property
      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId)
        .send({
          title: 'Test Property Details',
          description: 'Test Description',
          propertyType: 'apartment',
          listingType: 'sale',
          price: 5000000,
          location: { address: 'Test Address', city: 'Test City' }
        });

      propertyId = response.body.data.property._id;
    });

    test('should get property details successfully', async () => {
      const response = await request(app)
        .get(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('property');
      expect(response.body.data.property).toHaveProperty('_id', propertyId);
      expect(response.body.data.property).toHaveProperty('title', 'Test Property Details');
    });

    test('should reject access from unauthorized organization', async () => {
      // Create another organization
      const orgRes = await request(app)
        .post('/api/orgs')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          name: 'Another Organization',
          description: 'Another Description'
        });

      const anotherOrgId = orgRes.body.data.organization._id;

      const response = await request(app)
        .get(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .set('x-organization-id', anotherOrgId); // Different org

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('success', false);
    });

    test('should return 404 for non-existent property', async () => {
      const response = await request(app)
        .get('/api/properties/507f1f77bcf86cd799439011') // Invalid ObjectId
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('PUT /api/properties/:id', () => {
    beforeEach(async () => {
      // Create a property
      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId)
        .send({
          title: 'Property to Update',
          description: 'Old Description',
          propertyType: 'apartment',
          listingType: 'sale',
          price: 5000000,
          location: { address: 'Old Address', city: 'Old City' }
        });

      propertyId = response.body.data.property._id;
    });

    test('should update property successfully', async () => {
      const updateData = {
        title: 'Updated Property Title',
        description: 'Updated Description',
        price: 5500000,
        status: 'sold'
      };

      const response = await request(app)
        .put(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.property).toHaveProperty('title', updateData.title);
      expect(response.body.data.property).toHaveProperty('description', updateData.description);
      expect(response.body.data.property).toHaveProperty('price', updateData.price);
      expect(response.body.data.property).toHaveProperty('status', updateData.status);
    });

    test('should reject update by unauthorized user', async () => {
      const response = await request(app)
        .put(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .set('x-organization-id', orgId)
        .send({ title: 'Unauthorized Update' });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('DELETE /api/properties/:id', () => {
    beforeEach(async () => {
      // Create a property
      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId)
        .send({
          title: 'Property to Delete',
          description: 'Delete Description',
          propertyType: 'apartment',
          listingType: 'sale',
          price: 5000000,
          location: { address: 'Delete Address', city: 'Delete City' }
        });

      propertyId = response.body.data.property._id;
    });

    test('should delete property successfully', async () => {
      const response = await request(app)
        .delete(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toMatch(/deleted.*successfully/i);

      // Verify property is actually deleted
      const verifyResponse = await request(app)
        .get(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId);

      expect(verifyResponse.status).toBe(404);
    });

    test('should reject delete by unauthorized user', async () => {
      const response = await request(app)
        .delete(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .set('x-organization-id', orgId);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/properties/search/query', () => {
    beforeEach(async () => {
      // Create properties with different searchable content
      const properties = [
        {
          title: 'Luxury Apartment Mumbai',
          description: 'Beautiful apartment in South Mumbai',
          propertyType: 'apartment',
          listingType: 'sale',
          price: 8000000,
          location: { city: 'Mumbai', address: 'South Mumbai' }
        },
        {
          title: 'Beach Villa Goa',
          description: 'Private beach access villa',
          propertyType: 'villa',
          listingType: 'rent',
          price: 25000,
          location: { city: 'Goa', address: 'Baga Beach' }
        },
        {
          title: 'Mumbai Office Space',
          description: 'Commercial property in Bandra',
          propertyType: 'commercial',
          listingType: 'sale',
          price: 12000000,
          location: { city: 'Mumbai', address: 'Bandra' }
        }
      ];

      for (const prop of properties) {
        await request(app)
          .post('/api/properties')
          .set('Authorization', `Bearer ${user1Token}`)
          .set('x-organization-id', orgId)
          .send(prop);
      }
    });

    test('should search properties by text query', async () => {
      const response = await request(app)
        .get('/api/properties/search/Mumbai')
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId);

      expect(response.status).toBe(200);
      expect(response.body.data.properties).toHaveLength(2); // Properties with "Mumbai" in title or description
    });

    test('should return empty results for no matches', async () => {
      const response = await request(app)
        .get('/api/properties/search/nonexistent')
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId);

      expect(response.status).toBe(200);
      expect(response.body.data.properties).toHaveLength(0);
    });
  });

  describe('GET /api/properties/stats/overview', () => {
    beforeEach(async () => {
      // Create properties with different statuses
      const properties = [
        { status: 'available', price: 5000000 },
        { status: 'available', price: 3000000 },
        { status: 'sold', price: 8000000 },
        { status: 'rented', price: 20000 }
      ];

      for (const [index, prop] of properties.entries()) {
        await request(app)
          .post('/api/properties')
          .set('Authorization', `Bearer ${user1Token}`)
          .set('x-organization-id', orgId)
          .send({
            title: `Property ${index + 1}`,
            description: `Description ${index + 1}`,
            propertyType: 'apartment',
            listingType: 'sale',
            price: prop.price,
            status: prop.status,
            location: { address: `Address ${index + 1}`, city: 'Test City' }
          });
      }
    });

    test('should get property statistics', async () => {
      const response = await request(app)
        .get('/api/properties/stats/overview')
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('totalProperties', 4);
      expect(response.body.data).toHaveProperty('totalValue');
      expect(response.body.data).toHaveProperty('averagePrice');
      expect(response.body.data).toHaveProperty('statusDistribution');
      expect(response.body.data.statusDistribution).toHaveProperty('available', 2);
      expect(response.body.data.statusDistribution).toHaveProperty('sold', 1);
      expect(response.body.data.statusDistribution).toHaveProperty('rented', 1);
    });
  });

  // Clean up after all tests
  afterAll(async () => {
    await User.deleteMany({ email: { $regex: /propertytest/ } });
    await Organization.deleteMany({});
    await Property.deleteMany({});
  });
});

