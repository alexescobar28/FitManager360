const request = require('supertest');
const { app } = require('./index');

describe('API Gateway', () => {
  // Test health endpoint
  test('GET /health should return OK', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.body.status).toBe('API Gateway is running');
    expect(response.body.version).toBe('1.0.1');
    expect(response.body.timestamp).toBeDefined();
  });

  // Test root endpoint
  test('GET / should return service info', async () => {
    const response = await request(app).get('/').expect(200);

    expect(response.body.status).toBe('OK');
    expect(response.body.service).toBe('api-gateway');
    expect(response.body.endpoints).toContain('/health');
  });

  // Test metrics endpoint
  test('GET /metrics should return metrics', async () => {
    const response = await request(app).get('/metrics').expect(200);

    expect(response.text).toContain('http_requests_total');
  });

  // Test CORS headers
  test('OPTIONS request should include CORS headers', async () => {
    const response = await request(app).options('/');

    // Accept both 200 and 204 status codes for OPTIONS requests
    expect([200, 204]).toContain(response.status);

    // Check if any CORS header is present (more flexible test)
    const hasCorsHeaders =
      response.headers['access-control-allow-origin'] ||
      response.headers['access-control-allow-methods'] ||
      response.headers['access-control-allow-headers'];

    expect(hasCorsHeaders).toBeDefined();
  });

  // Test 404 for unknown routes
  test('GET /unknown-route should return 404', async () => {
    const response = await request(app).get('/unknown-route').expect(404);

    expect(response.body.error).toBe('Route not found');
  });

  // Test that proxy routes exist (they will fail but should not 404)
  test('GET /api/auth should not return 404', async () => {
    const response = await request(app).get('/api/auth');

    // Should not be 404, might be 503 (service unavailable) or other error
    expect(response.status).not.toBe(404);
  });
});
