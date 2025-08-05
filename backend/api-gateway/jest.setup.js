// Setup for Jest tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';

// Mock service URLs for testing
process.env.AUTH_SERVICE_URL = 'http://localhost:3001';
process.env.ROUTINE_SERVICE_URL = 'http://localhost:3002';
process.env.CHAT_SERVICE_URL = 'http://localhost:3003';
process.env.STATS_SERVICE_URL = 'http://localhost:3004';

// Suppress console logs during tests
console.log = jest.fn();
console.warn = jest.fn();
console.error = jest.fn();
