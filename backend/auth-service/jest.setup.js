// Setup for Jest tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test-auth';

// Suppress console logs during tests
console.log = jest.fn();
console.warn = jest.fn();
console.error = jest.fn();
