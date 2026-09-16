const request = require('supertest');
const { app } = require('../../src/index');

describe('Public Property Marketplace API', () => {
  test('should list available properties without authentication', async () => {
    const response = await request(app).get('/api/public/properties');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.properties)).toBe(true);
    expect(response.body.properties.every((property) => property.status === 'available')).toBe(true);
  });

  test('should return 404 for an unavailable public property', async () => {
    const response = await request(app).get('/api/public/properties/5f8f8f8f8f8f8f8f8f8f8f8f');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });
});
