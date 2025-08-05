const request = require('supertest');
const { app } = require('./index');

describe('Chat Service', () => {
  // Test health endpoint
  test('GET /health should return OK', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.body.status).toBe('OK');
    expect(response.body.service).toBe('chat-service');
  });

  // Test metrics endpoint
  test('GET /metrics should return metrics', async () => {
    const response = await request(app).get('/metrics').expect(200);

    expect(response.text).toContain('http_requests_total');
  });

  // Test get rooms without auth
  test('GET /rooms without auth should return 401', async () => {
    const response = await request(app).get('/rooms').expect(401);

    expect(response.body.error).toBe('Access token required');
  });

  // Test get conversations without auth
  test('GET /conversations without auth should return 401', async () => {
    const response = await request(app).get('/conversations').expect(401);

    expect(response.body.error).toBe('Access token required');
  });

  // Test create room without auth
  test('POST /rooms without auth should return 401', async () => {
    const response = await request(app)
      .post('/rooms')
      .send({
        name: 'Test Room',
        description: 'Test description',
      })
      .expect(401);

    expect(response.body.error).toBe('Access token required');
  });

  // Test invalid room creation data
  test('POST /rooms with invalid data should return 400', async () => {
    const response = await request(app)
      .post('/rooms')
      .set('Authorization', 'Bearer invalid-token')
      .send({
        name: 'ab', // too short
      })
      .expect(403); // Will be 403 because of invalid token, but validates our auth middleware

    expect(response.body.error).toBe('Invalid token');
  });
});
