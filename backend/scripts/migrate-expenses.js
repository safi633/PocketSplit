require('dotenv').config({ quiet: true });

const mongoose = require('mongoose');
const { connectToDatabase } = require('../server');
const Transaction = require('../models/Transaction');
const Expense = require('../models/Expense');

async function migrateExpenses() {
  await connectToDatabase();

  const legacyExpenses = await Transaction.find({ type: 'expense' }).lean();
  if (legacyExpenses.length === 0) {
    console.log('No legacy expense records found in transactions.');
    return;
  }

  const expenseIds = legacyExpenses.map((expense) => expense._id);
  const alreadyMigrated = await Expense.find({ _id: { $in: expenseIds } }).select('_id').lean();
  const existingIds = new Set(alreadyMigrated.map((expense) => String(expense._id)));
  const newExpenses = legacyExpenses
    .filter((expense) => !existingIds.has(String(expense._id)))
    .map(({ type, ...expense }) => expense);

  if (newExpenses.length > 0) await Expense.insertMany(newExpenses);
  await Transaction.deleteMany({ _id: { $in: expenseIds }, type: 'expense' });
  console.log(`Migrated ${legacyExpenses.length} expense record(s) to expenses.`);
}

migrateExpenses()
  .catch((error) => {
    console.error('Expense migration failed:', error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
