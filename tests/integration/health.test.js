/**
 * Health Check & Base Route Tests
 */
const request = require('supertest');
const { app } = require('../../src/index');

describe('Health Check & Base Routes', () => {
  describe('GET /health', () => {
    test('should return health check response', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Real Estate SaaS API is running');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('version', '1.0.0');

      // Validate timestamp is a valid ISO string
      const timestamp = new Date(response.body.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(isNaN(timestamp.getTime())).toBe(false);
    });

    test('should return correct content type', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('GET /', () => {
    test('should return welcome response', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Welcome to Real Estate SaaS API');
      expect(response.body).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('features');
      expect(response.body).toHaveProperty('endpoints');
    });

    test('should list all feature areas', async () => {
      const response = await request(app).get('/');

      expect(response.body.features).toHaveProperty('authentication');
      expect(response.body.features).toHaveProperty('multi_tenancy');
      expect(response.body.features).toHaveProperty('properties');
      expect(response.body.features).toHaveProperty('tasks');
      expect(response.body.features).toHaveProperty('real_time');
    });

    test('should list all API endpoints', async () => {
      const response = await request(app).get('/');

      expect(response.body.endpoints).toHaveProperty('auth', '/api/auth');
      expect(response.body.endpoints).toHaveProperty('organizations', '/api/orgs');
      expect(response.body.endpoints).toHaveProperty('properties', '/api/properties');
      expect(response.body.endpoints).toHaveProperty('tasks', '/api/tasks');
    });
  });

  describe('404 Not Found', () => {
    test('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/api/unknown');

      expect(response.status).toBe(404);
    });
  });

  describe('Error Handling', () => {
    test('should return JSON error for malformed JSON body', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"malformed json');

      expect(response.status).toBe(400);
    });
  });
});
