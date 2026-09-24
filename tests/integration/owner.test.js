const request = require('supertest');
const { app } = require('../../src/index');
const User = require('../../src/models/User');
const Property = require('../../src/models/Property');

describe('Owner API Integration Tests', () => {
  const suffix = Date.now();
  let ownerToken;
  let customerToken;
  let ownerId;
  let propertyId;

  beforeAll(async () => {
    await User.deleteMany({ email: { $regex: /owner-api-test/ } });

    const owner = await request(app).post('/api/auth/register').send({
      firstName: 'Property', lastName: 'Owner', email: `owner-api-test-${suffix}@test.com`,
      password: 'TestPassword123!', confirmPassword: 'TestPassword123!', phone: '1234567890',
      accountType: 'owner', termsAccepted: true,
    });
    ownerToken = owner.body.token;
    ownerId = owner.body.user.id;

    const customer = await request(app).post('/api/auth/register').send({
      firstName: 'Interested', lastName: 'Customer', email: `owner-api-test-customer-${suffix}@test.com`,
      password: 'TestPassword123!', confirmPassword: 'TestPassword123!', phone: '0987654321',
      accountType: 'customer', customerType: 'buyer', termsAccepted: true,
    });
    customerToken = customer.body.token;

    const property = await request(app).post('/api/properties').set('Authorization', `Bearer ${ownerToken}`).send({
      title: 'Owner API Property', description: 'A property created for owner dashboard testing.',
      propertyType: 'apartment', listingType: 'sale', price: 2500000,
      location: { address: 'Owner Street', city: 'Pune', state: 'Maharashtra' },
      features: { superArea: 900 }, area: { superArea: 900 },
      owner: { name: 'Property Owner', phone: '1234567890' },
    });
    propertyId = property.body.property.id;
  });

  afterAll(async () => {
    await Property.deleteMany({ createdBy: ownerId });
    await User.deleteMany({ email: { $regex: /owner-api-test/ } });
  });

  test('owner dashboard only exposes the owner account data', async () => {
    const response = await request(app).get('/api/owner/dashboard').set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(200);
    expect(response.body.stats.propertyCount).toBe(1);
    expect(response.body.recentProperties[0].title).toBe('Owner API Property');
  });

  test('customer accounts cannot access owner endpoints', async () => {
    const response = await request(app).get('/api/owner/dashboard').set('Authorization', `Bearer ${customerToken}`);
    expect(response.status).toBe(403);
  });

  test('owner profile can be updated without changing account type', async () => {
    const response = await request(app).put('/api/owner/profile').set('Authorization', `Bearer ${ownerToken}`).send({ firstName: 'Updated' });
    expect(response.status).toBe(200);
    expect(response.body.user.firstName).toBe('Updated');
    expect(response.body.user.accountType).toBe('owner');
  });

  test('owner can upload and persist a profile photo', async () => {
    const response = await request(app)
      .post('/api/uploads/user/avatar')
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('avatar', Buffer.from('profile-photo-test'), 'avatar.png');
    expect(response.status).toBe(200);
    expect(response.body.user.avatar).toMatch(/^\/uploads\/avatars\//);
  });

  test('owner enquiry list is scoped to owned properties', async () => {
    const response = await request(app).get('/api/owner/enquiries').set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(200);
    expect(response.body.enquiries).toEqual([]);
    expect(propertyId).toBeTruthy();
  });
});
