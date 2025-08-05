const request = require('supertest');
const app = require('./index');

describe('Routine Service', () => {
  // Test health endpoint
  test('GET /health should return OK', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.body.status).toBe('OK');
    expect(response.body.service).toBe('routine-service');
  });

  // Test metrics endpoint
  test('GET /metrics should return metrics', async () => {
    const response = await request(app).get('/metrics').expect(200);

    expect(response.text).toContain('http_requests_total');
  });

  // Test exercises stats endpoint (should require auth but return 401)
  test('GET /exercises/stats without auth should return 401', async () => {
    const response = await request(app).get('/exercises/stats').expect(401);

    expect(response.body.error).toBe('Access token required');
  });

  // Test get exercises without auth
  test('GET /exercises without auth should return 401', async () => {
    const response = await request(app).get('/exercises').expect(401);

    expect(response.body.error).toBe('Access token required');
  });

  // Test get routines without auth
  test('GET /routines without auth should return 401', async () => {
    const response = await request(app).get('/routines').expect(401);

    expect(response.body.error).toBe('Access token required');
  });

  // Test create exercise without auth
  test('POST /exercises without auth should return 401', async () => {
    const response = await request(app)
      .post('/exercises')
      .send({
        name: 'Test Exercise',
        description: 'Test description',
      })
      .expect(401);

    expect(response.body.error).toBe('Access token required');
  });
});
