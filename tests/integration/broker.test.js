const request = require('supertest');
const { app } = require('../../src/index');
const User = require('../../src/models/User');
const Property = require('../../src/models/Property');

describe('Broker Assignment Integration Tests', () => {
  const suffix = Date.now();
  let ownerToken;
  let brokerToken;
  let brokerId;
  let propertyId;

  beforeAll(async () => {
    await User.deleteMany({ email: { $regex: /broker-api-test/ } });
    const owner = await request(app).post('/api/auth/register').send({
      firstName: 'Listing', lastName: 'Owner', email: `broker-api-test-owner-${suffix}@test.com`,
      password: 'TestPassword123!', confirmPassword: 'TestPassword123!', phone: '1234567890', accountType: 'owner', termsAccepted: true,
    });
    ownerToken = owner.body.token;
    const broker = await request(app).post('/api/auth/register').send({
      firstName: 'Listing', lastName: 'Broker', email: `broker-api-test-broker-${suffix}@test.com`,
      password: 'TestPassword123!', confirmPassword: 'TestPassword123!', phone: '0987654321', accountType: 'broker', termsAccepted: true,
    });
    brokerToken = broker.body.token;
    brokerId = broker.body.user.id;
    const property = await request(app).post('/api/properties').set('Authorization', `Bearer ${ownerToken}`).send({
      title: 'Broker Assignment Property', description: 'A property for broker assignment testing.', propertyType: 'apartment', listingType: 'sale', price: 3000000,
      location: { address: 'Broker Street', city: 'Pune', state: 'Maharashtra' }, features: { superArea: 1000 }, area: { superArea: 1000 }, owner: { name: 'Listing Owner', phone: '1234567890' },
    });
    propertyId = property.body.property.id;
  });

  afterAll(async () => {
    await Property.deleteMany({ _id: propertyId });
    await User.deleteMany({ email: { $regex: /broker-api-test/ } });
  });

  test('owner can assign an existing broker to a property', async () => {
    const response = await request(app).put(`/api/owner/properties/${propertyId}/brokers`).set('Authorization', `Bearer ${ownerToken}`).send({
      brokerEmail: `broker-api-test-broker-${suffix}@test.com`, action: 'assign',
    });
    expect(response.status).toBe(200);
    expect(response.body.property.brokerIds.map((id) => String(id))).toContain(String(brokerId));
  });

  test('assigned broker can see the listing and dashboard data', async () => {
    const listings = await request(app).get('/api/properties').set('Authorization', `Bearer ${brokerToken}`);
    const dashboard = await request(app).get('/api/broker/dashboard').set('Authorization', `Bearer ${brokerToken}`);
    expect(listings.status).toBe(200);
    expect(listings.body.properties.map((property) => String(property._id))).toContain(String(propertyId));
    expect(dashboard.body.stats.listingCount).toBe(1);
  });

  test('owner can revoke broker access', async () => {
    const response = await request(app).put(`/api/owner/properties/${propertyId}/brokers`).set('Authorization', `Bearer ${ownerToken}`).send({
      brokerEmail: `broker-api-test-broker-${suffix}@test.com`, action: 'revoke',
    });
    expect(response.status).toBe(200);
    const listings = await request(app).get('/api/properties').set('Authorization', `Bearer ${brokerToken}`);
    expect(listings.body.properties).toHaveLength(0);
  });
});
