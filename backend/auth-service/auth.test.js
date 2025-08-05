const request = require('supertest');
const app = require('./index');

describe('Auth Service', () => {
  // Test health endpoint
  test('GET /health should return OK', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.body.status).toBe('OK');
    expect(response.body.service).toBe('auth-service');
  });

  // Test root endpoint
  test('GET / should return service info', async () => {
    const response = await request(app).get('/').expect(200);

    expect(response.body.status).toBe('OK');
    expect(response.body.service).toBe('auth-service');
  });

  // Test metrics endpoint
  test('GET /metrics should return metrics', async () => {
    const response = await request(app).get('/metrics').expect(200);

    expect(response.text).toContain('http_requests_total');
  });

  // Test invalid register data
  test('POST /register with invalid data should return 400', async () => {
    const response = await request(app)
      .post('/register')
      .send({
        username: 'ab', // too short
        email: 'invalid-email',
        password: '123', // too short
      })
      .expect(400);

    expect(response.body.error).toBeDefined();
  });

  // Test login without credentials
  test('POST /login without credentials should return 400', async () => {
    const response = await request(app).post('/login').send({}).expect(400);

    expect(response.body.error).toBeDefined();
  });
});
