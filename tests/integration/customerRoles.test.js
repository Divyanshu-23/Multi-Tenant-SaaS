const request = require('supertest');
const { app } = require('../../src/index');
const User = require('../../src/models/User');

describe('Customer role-specific workspace', () => {
  const suffix = Date.now();
  let token;

  beforeAll(async () => {
    await User.deleteMany({ email: { $regex: /customer-role-test/ } });
    const response = await request(app).post('/api/auth/register').send({
      firstName: 'Rental', lastName: 'Seeker', email: `customer-role-test-${suffix}@test.com`,
      password: 'TestPassword123!', confirmPassword: 'TestPassword123!', phone: '1234567890',
      accountType: 'customer', customerType: 'renter', termsAccepted: true,
    });
    token = response.body.token;
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $regex: /customer-role-test/ } });
  });

  test('renter dashboard identifies the rental role and stores preferences', async () => {
    const dashboard = await request(app).get('/api/customer/dashboard').set('Authorization', `Bearer ${token}`);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.customerType).toBe('renter');

    const profile = await request(app).put('/api/customer/profile').set('Authorization', `Bearer ${token}`).send({
      customerPreferences: { monthlyRent: 35000, leaseDuration: '11_months', furnishing: 'semi-furnished' },
    });
    expect(profile.status).toBe(200);
    expect(profile.body.user.customerPreferences.monthlyRent).toBe(35000);
    expect(profile.body.user.customerPreferences.leaseDuration).toBe('11_months');
  });
});
