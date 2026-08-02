const test = require('node:test');
const assert = require('node:assert/strict');
const { validateBudget, validateRecord } = require('../middleware/validation');
const Transaction = require('../models/Transaction');
const Income = require('../models/Income');

function runMiddleware(middleware, body) {
  const req = { body };
  let statusCode;
  let response;
  let nextCalled = false;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      response = payload;
      return this;
    },
  };

  middleware(req, res, () => { nextCalled = true; });
  return { req, statusCode, response, nextCalled };
}

test('white-box: transaction validation normalizes trusted fields', () => {
  const result = runMiddleware(validateRecord(), {
    type: 'expense',
    date: '2026-08-01',
    category: ' Food ',
    amount: '42.50',
    description: ' Lunch ',
    ignored: 'not persisted',
  });

  assert.equal(result.nextCalled, true);
  assert.deepEqual(result.req.validatedBody, {
    type: 'expense', date: '2026-08-01', category: 'Food', amount: 42.5, description: 'Lunch',
  });
});

test('white-box: transaction validation rejects invalid dates and amounts', () => {
  const invalidDate = runMiddleware(validateRecord('income'), {
    type: 'income', date: 'not-a-date', category: 'Salary', amount: 1,
  });
  const invalidAmount = runMiddleware(validateRecord('income'), {
    type: 'income', date: '2026-08-01', category: 'Salary', amount: 0,
  });

  assert.equal(invalidDate.statusCode, 400);
  assert.match(invalidDate.response.error, /Date/);
  assert.equal(invalidAmount.statusCode, 400);
  assert.match(invalidAmount.response.error, /Amount/);
});

test('white-box: income validation infers the income type', () => {
  const result = runMiddleware(validateRecord('income'), {
    date: '2026-08-01', category: 'Salary', amount: 1000,
  });

  assert.equal(result.nextCalled, true);
  assert.deepEqual(result.req.validatedBody, {
    date: '2026-08-01', category: 'Salary', amount: 1000, description: '',
  });
});

test('white-box: budget validation accepts only calendar months and positive totals', () => {
  const valid = runMiddleware(validateBudget, { month: '2026-08', amount: '500' });
  const invalid = runMiddleware(validateBudget, { month: '2026-13', amount: 500 });

  assert.equal(valid.nextCalled, true);
  assert.deepEqual(valid.req.validatedBody, { month: '2026-08', amount: 500 });
  assert.equal(invalid.statusCode, 400);
});

test('white-box: records require a supported saved currency', async () => {
  const validTransaction = new Transaction({
    userId: '507f1f77bcf86cd799439011', type: 'expense', date: '2026-08-01', category: 'Food', amount: 10, currency: 'USD',
  });
  const missingCurrencyIncome = new Income({
    userId: '507f1f77bcf86cd799439011', date: '2026-08-01', category: 'Salary', amount: 10,
  });

  await validTransaction.validate();
  await assert.rejects(missingCurrencyIncome.validate(), (error) => {
    assert.ok(error.errors.currency);
    return true;
  });
});
