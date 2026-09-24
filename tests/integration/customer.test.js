const request = require('supertest');
const { app } = require('../../src/index');
const User = require('../../src/models/User');
const Organization = require('../../src/models/Organization');
const Member = require('../../src/models/Member');
const Property = require('../../src/models/Property');
const Favorite = require('../../src/models/Favorite');
const Enquiry = require('../../src/models/Enquiry');
const SupportTicket = require('../../src/models/SupportTicket');

describe('Customer workspace API', () => {
  const suffix = Date.now();
  const customer = { firstName: 'Customer', lastName: 'Test', email: `customer_flow_${suffix}@test.com`, password: 'TestPassword123!', confirmPassword: 'TestPassword123!', phone: '9876543210', accountType: 'customer', termsAccepted: true };
  const owner = { firstName: 'Owner', lastName: 'Test', email: `customer_owner_${suffix}@test.com`, password: 'TestPassword123!', confirmPassword: 'TestPassword123!', phone: '8765432109', accountType: 'owner', termsAccepted: true };
  let customerToken; let ownerToken; let propertyId;

  beforeAll(async () => {
    await User.deleteMany({ email: { $regex: /customer_(flow|owner)_/ } });
    const customerResponse = await request(app).post('/api/auth/register').send(customer);
    const ownerResponse = await request(app).post('/api/auth/register').send(owner);
    customerToken = customerResponse.body.token;
    ownerToken = ownerResponse.body.token;
    const org = await request(app).post('/api/orgs').set('Authorization', `Bearer ${ownerToken}`).send({ name: `Customer Flow Org ${suffix}` });
    const property = await request(app).post('/api/properties').set('Authorization', `Bearer ${ownerToken}`).set('x-organization-id', org.body.data.organization._id).send({
      title: 'Customer Flow Apartment', description: 'A complete test property for customer workflows.', propertyType: 'apartment', listingType: 'sale', price: 7500000,
      location: { address: '1 Test Street', city: 'Pune', state: 'Maharashtra' }, features: { superArea: 1200 }, area: { superArea: 1200 }, owner: { name: 'Owner', phone: '8765432109' }, status: 'available',
    });
    propertyId = property.body.property.id;
  });

  afterAll(async () => {
    await Favorite.deleteMany({}); await Enquiry.deleteMany({}); await SupportTicket.deleteMany({}); await Property.deleteMany({}); await Member.deleteMany({}); await Organization.deleteMany({}); await User.deleteMany({ email: { $regex: /customer_(flow|owner)_/ } });
  });

  test('should load the customer dashboard', async () => {
    const response = await request(app).get('/api/customer/dashboard').set('Authorization', `Bearer ${customerToken}`);
    expect(response.status).toBe(200);
    expect(response.body.stats).toEqual({ favoriteCount: 0, enquiryCount: 0, openTicketCount: 0 });
  });

  test('should save and remove a favorite property', async () => {
    const saved = await request(app).post('/api/customer/favorites').set('Authorization', `Bearer ${customerToken}`).send({ propertyId });
    expect(saved.status).toBe(201);
    const listed = await request(app).get('/api/customer/favorites').set('Authorization', `Bearer ${customerToken}`);
    expect(listed.body.favorites).toHaveLength(1);
    const removed = await request(app).delete(`/api/customer/favorites/${propertyId}`).set('Authorization', `Bearer ${customerToken}`);
    expect(removed.status).toBe(200);
  });

  test('should submit and list an enquiry', async () => {
    const created = await request(app).post('/api/customer/enquiries').set('Authorization', `Bearer ${customerToken}`).send({ propertyId, message: 'I would like to schedule a viewing.' });
    expect(created.status).toBe(201);
    const listed = await request(app).get('/api/customer/enquiries').set('Authorization', `Bearer ${customerToken}`);
    expect(listed.body.enquiries).toHaveLength(1);
  });

  test('should update profile without changing account type', async () => {
    const response = await request(app).put('/api/customer/profile').set('Authorization', `Bearer ${customerToken}`).send({ firstName: 'Updated Customer', phone: '7654321098' });
    expect(response.status).toBe(200);
    expect(response.body.user.firstName).toBe('Updated Customer');
    expect(response.body.user.accountType).toBe('customer');
  });

  test('should create and list a support ticket', async () => {
    const created = await request(app).post('/api/customer/support').set('Authorization', `Bearer ${customerToken}`).send({ subject: 'Need help', message: 'Please help with my enquiry.', category: 'enquiry' });
    expect(created.status).toBe(201);
    const listed = await request(app).get('/api/customer/support').set('Authorization', `Bearer ${customerToken}`);
    expect(listed.body.tickets).toHaveLength(1);
  });

  test('should reject customer APIs for organization users', async () => {
    const response = await request(app).get('/api/customer/dashboard').set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(403);
  });
});
