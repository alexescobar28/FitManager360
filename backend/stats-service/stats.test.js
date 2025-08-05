const request = require('supertest');
const app = require('./index');

describe('Stats Service', () => {
  // Test health endpoint
  test('GET /health should return OK', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.body.status).toBe('OK');
    expect(response.body.service).toBe('stats-service');
  });

  // Test metrics endpoint
  test('GET /metrics should return metrics', async () => {
    const response = await request(app).get('/metrics').expect(200);

    expect(response.text).toContain('http_requests_total');
  });

  // Test get body metrics without auth
  test('GET /body-metrics without auth should return 401', async () => {
    const response = await request(app).get('/body-metrics').expect(401);

    expect(response.body.error).toBe('Access token required');
  });

  // Test create body metrics without auth
  test('POST /body-metrics without auth should return 401', async () => {
    const response = await request(app)
      .post('/body-metrics')
      .send({
        weight: 70,
        height: 175,
      })
      .expect(401);

    expect(response.body.error).toBe('Access token required');
  });

  // Test get dashboard stats without auth
  test('GET /dashboard without auth should return 401', async () => {
    const response = await request(app).get('/dashboard').expect(401);

    expect(response.body.error).toBe('Access token required');
  });

  // Test invalid body metrics data
  test('POST /body-metrics with invalid token should return 403', async () => {
    const response = await request(app)
      .post('/body-metrics')
      .set('Authorization', 'Bearer invalid-token')
      .send({
        weight: 70,
        height: 175,
      })
      .expect(403);

    expect(response.body.error).toBe('Invalid token');
  });
});
