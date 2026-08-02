const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app } = require('../server');

test('black-box: API health endpoint is available with security headers', async () => {
  const response = await request(app).get('/api').expect(200);

  assert.equal(response.body.message, 'Expense Tracker API Running');
  assert.equal(response.headers['x-powered-by'], undefined);
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
});

test('black-box: protected endpoints reject unauthenticated requests', async () => {
  const response = await request(app).get('/api/transactions/507f1f77bcf86cd799439011').expect(401);

  assert.equal(response.body.error, 'Authentication required');
});

test('black-box: invalid registration fails before database access', async () => {
  const response = await request(app)
    .post('/api/auth/signup')
    .send({ name: 'Test User', email: 'not-an-email', username: 'invalid user', password: 'short' })
    .expect(400);

  assert.match(response.body.error, /Username/);
});

test('black-box: malformed JSON and unknown API paths return safe client errors', async () => {
  const malformed = await request(app)
    .post('/api/auth/login')
    .set('Content-Type', 'application/json')
    .send('{')
    .expect(400);
  const missing = await request(app).get('/api/not-a-route').expect(404);

  assert.equal(malformed.body.error, 'Invalid JSON request body');
  assert.equal(missing.body.error, 'API endpoint not found');
});

test('black-box: non-public project files are not served as static assets', async () => {
  await request(app).get('/package.json').expect(404);
  await request(app).get('/server.out.log').expect(404);
});
