const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeTransactions } = require('../utils/transactionSummary');

test('summarizes income, expense, balance, and category totals', () => {
  const transactions = [
    { type: 'income', amount: 3000, category: 'Salary', date: '2026-07-09' },
    { type: 'income', amount: 500, category: 'Freelance', date: '2026-07-12' },
    { type: 'expense', amount: 1200, category: 'Rent', date: '2026-07-10' },
    { type: 'expense', amount: 150, category: 'Groceries', date: '2026-07-11' },
  ];

  const summary = summarizeTransactions(transactions);

  assert.equal(summary.totalIncome, 3500);
  assert.equal(summary.totalExpenses, 1350);
  assert.equal(summary.balance, 2150);
  assert.deepEqual(summary.byCategory, [
    { type: 'income', category: 'Salary', total: 3000 },
    { type: 'income', category: 'Freelance', total: 500 },
    { type: 'expense', category: 'Rent', total: 1200 },
    { type: 'expense', category: 'Groceries', total: 150 },
  ]);
});

test('ignores invalid records and aggregates repeated categories in linear time', () => {
  const summary = summarizeTransactions([
    { type: 'expense', amount: 10, category: 'Food' },
    { type: 'expense', amount: '2.5', category: 'Food' },
    { type: 'income', amount: 100, category: 'Salary' },
    { type: 'other', amount: 999, category: 'Ignored' },
    { type: 'expense', amount: -1, category: 'Ignored' },
  ]);

  assert.equal(summary.totalIncome, 100);
  assert.equal(summary.totalExpenses, 12.5);
  assert.deepEqual(summary.byCategory, [
    { type: 'expense', category: 'Food', total: 12.5 },
    { type: 'income', category: 'Salary', total: 100 },
  ]);
});
