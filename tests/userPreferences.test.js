const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../models/User');

function makeUser(overrides = {}) {
  return new User({
    name: 'Test User',
    email: 'test@example.com',
    username: 'test_user',
    password: 'hashed-password',
    ...overrides,
  });
}

test('white-box: user preferences default to Light theme, BDT, and English', async () => {
  const user = makeUser();

  assert.equal(user.theme, 'Light');
  assert.equal(user.currency, 'BDT');
  assert.equal(user.language, 'English');
  await user.validate();
});

test('white-box: user preferences allow Bangla and reject unsupported values', async () => {
  const supported = makeUser({ theme: 'Dark', currency: 'BDT', language: 'Bangla' });
  const unsupported = makeUser({ theme: 'Neon', currency: 'BTC', language: 'Klingon' });

  await supported.validate();
  await assert.rejects(unsupported.validate(), (error) => {
    assert.ok(error.errors.theme);
    assert.ok(error.errors.currency);
    assert.ok(error.errors.language);
    return true;
  });
});
