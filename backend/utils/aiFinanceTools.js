const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const Income = require('../models/Income');
const Budget = require('../models/Budget');
const Category = require('../models/Category');
const PendingAiAction = require('../models/PendingAiAction');
const User = require('../models/User');

const CURRENCIES = new Set(['BDT', 'USD', 'EUR', 'GBP', 'INR']);
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const writeActions = new Set(['propose_transaction', 'propose_transaction_update', 'propose_transaction_delete', 'propose_budget', 'propose_budget_delete', 'propose_category', 'propose_category_update', 'propose_category_delete', 'propose_profile_update', 'propose_settings_update']);

const functionDeclarations = [
  {
    name: 'get_finance_summary',
    description: 'Read the signed-in user’s monthly income, expenses, category totals, and budgets for up to 12 months.',
    parameters: { type: 'OBJECT', properties: { months: { type: 'INTEGER', description: 'Number of recent months to summarize, from 1 to 12.' } } },
  },
  {
    name: 'search_transactions',
    description: 'Search the signed-in user’s own income and expense records. Use when a question needs specific recorded entries or descriptions.',
    parameters: { type: 'OBJECT', properties: {
      month: { type: 'STRING', description: 'Optional month filter in YYYY-MM format.' },
      type: { type: 'STRING', enum: ['expense', 'income'], description: 'Optional record type.' },
      category: { type: 'STRING', description: 'Optional category filter.' },
      query: { type: 'STRING', description: 'Optional text to find in the category or description.' },
    } },
  },
  {
    name: 'generate_finance_report',
    description: 'Calculate a report grouped by month, type, category, and currency for a requested date range of at most 12 months.',
    parameters: { type: 'OBJECT', properties: {
      startMonth: { type: 'STRING', description: 'First month in YYYY-MM format.' },
      endMonth: { type: 'STRING', description: 'Last month in YYYY-MM format.' },
    }, required: ['startMonth', 'endMonth'] },
  },
  {
    name: 'list_categories',
    description: 'List the signed-in user’s categories and their IDs, for category questions or an explicitly requested category edit.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'get_budgets',
    description: 'List the signed-in user’s monthly budgets with their months and amounts.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'get_account_settings',
    description: 'Read the signed-in user’s own profile and preferences. Passwords and authentication secrets are never returned.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'propose_transaction',
    description: 'Prepare a new expense or income record. This only proposes a change; the user must approve it in PocketSplit before it is saved.',
    parameters: { type: 'OBJECT', properties: {
      type: { type: 'STRING', enum: ['expense', 'income'] },
      date: { type: 'STRING', description: 'Transaction date in YYYY-MM-DD format.' },
      category: { type: 'STRING' },
      amount: { type: 'NUMBER' },
      currency: { type: 'STRING', enum: ['BDT', 'USD', 'EUR', 'GBP', 'INR'] },
      description: { type: 'STRING' },
    }, required: ['type', 'date', 'category', 'amount'] },
  },
  {
    name: 'propose_transaction_update',
    description: 'Prepare an update to an existing record found by search_transactions. This only proposes a change; the user must approve it before it is saved.',
    parameters: { type: 'OBJECT', properties: {
      transactionId: { type: 'STRING' },
      date: { type: 'STRING' },
      category: { type: 'STRING' },
      amount: { type: 'NUMBER' },
      description: { type: 'STRING' },
    }, required: ['transactionId'] },
  },
  {
    name: 'propose_transaction_delete',
    description: 'Prepare deletion of an existing record found by search_transactions. The user must approve the deletion before it occurs.',
    parameters: { type: 'OBJECT', properties: { transactionId: { type: 'STRING' } }, required: ['transactionId'] },
  },
  {
    name: 'propose_budget',
    description: 'Prepare a monthly budget change. The user must approve it before the budget is saved.',
    parameters: { type: 'OBJECT', properties: {
      month: { type: 'STRING', description: 'Month in YYYY-MM format.' },
      amount: { type: 'NUMBER', description: 'Monthly budget amount, in the user’s preferred currency.' },
    }, required: ['month', 'amount'] },
  },
  {
    name: 'propose_budget_delete',
    description: 'Prepare deletion of a monthly budget found with get_budgets. The user must approve before it is deleted.',
    parameters: { type: 'OBJECT', properties: { month: { type: 'STRING', description: 'Month in YYYY-MM format.' } }, required: ['month'] },
  },
  {
    name: 'propose_category',
    description: 'Prepare a new expense category. The user must approve it before it is saved.',
    parameters: { type: 'OBJECT', properties: { name: { type: 'STRING' } }, required: ['name'] },
  },
  {
    name: 'propose_category_update',
    description: 'Prepare a category rename using an ID from list_categories. The user must approve it before it is saved.',
    parameters: { type: 'OBJECT', properties: { categoryId: { type: 'STRING' }, name: { type: 'STRING' } }, required: ['categoryId', 'name'] },
  },
  {
    name: 'propose_category_delete',
    description: 'Prepare deletion of a category using an ID from list_categories. This does not delete transactions; the user must approve it.',
    parameters: { type: 'OBJECT', properties: { categoryId: { type: 'STRING' } }, required: ['categoryId'] },
  },
  {
    name: 'propose_profile_update',
    description: 'Prepare a change to the signed-in user’s profile name or email. The user must approve it before saving. Password and username changes are not supported.',
    parameters: { type: 'OBJECT', properties: { name: { type: 'STRING' }, email: { type: 'STRING' } } },
  },
  {
    name: 'propose_settings_update',
    description: 'Prepare changes to theme, currency, language, or notifications. The user must approve them before saving.',
    parameters: { type: 'OBJECT', properties: {
      theme: { type: 'STRING', enum: ['Light', 'Dark'] },
      currency: { type: 'STRING', enum: ['BDT', 'USD', 'EUR', 'GBP', 'INR'] },
      language: { type: 'STRING', enum: ['English', 'Bangla', 'Spanish', 'French'] },
      notifications: { type: 'BOOLEAN' },
    } },
  },
];

function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function recentMonths(count = 12) {
  const size = Math.min(12, Math.max(1, Number.isInteger(count) ? count : 12));
  const current = new Date();
  const first = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - size + 1, 1));
  const afterCurrent = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1));
  return {
    months: Array.from({ length: size }, (_, index) => monthKey(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + index, 1)))),
    startDate: `${monthKey(first)}-01`,
    endDate: `${monthKey(afterCurrent)}-01`,
  };
}

function summarize(expenses, incomes, budgets, currency, months) {
  return {
    preferredCurrency: currency,
    months: months.map((month) => {
      const monthExpenses = expenses.filter((entry) => entry.date.startsWith(month));
      const monthIncomes = incomes.filter((entry) => entry.date.startsWith(month));
      const currencyCodes = [...new Set([
        ...monthExpenses.map((entry) => entry.currency), ...monthIncomes.map((entry) => entry.currency),
      ])].sort();
      return {
        month,
        currencies: currencyCodes.map((currencyCode) => {
          const expenseRows = monthExpenses.filter((entry) => entry.currency === currencyCode);
          const incomeRows = monthIncomes.filter((entry) => entry.currency === currencyCode);
          const categories = expenseRows.reduce((result, entry) => {
            result[entry.category] = (result[entry.category] || 0) + Number(entry.amount);
            return result;
          }, {});
          return {
            currency: currencyCode,
            income: incomeRows.reduce((total, entry) => total + Number(entry.amount), 0),
            expenses: expenseRows.reduce((total, entry) => total + Number(entry.amount), 0),
            expenseByCategory: Object.entries(categories).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total),
          };
        }),
        budget: budgets[month] === undefined ? null : (typeof budgets[month] === 'object'
          ? budgets[month]
          : { amount: budgets[month], currency }),
      };
    }),
  };
}

function dateRange(startMonth, endMonth) {
  if (!MONTH_PATTERN.test(startMonth || '') || !MONTH_PATTERN.test(endMonth || '') || startMonth > endMonth) return null;
  const start = new Date(`${startMonth}-01T00:00:00Z`);
  const afterEnd = new Date(Date.UTC(Number(endMonth.slice(0, 4)), Number(endMonth.slice(5, 7)), 1));
  const length = (afterEnd.getUTCFullYear() - start.getUTCFullYear()) * 12 + afterEnd.getUTCMonth() - start.getUTCMonth();
  if (length > 12) return null;
  return { startDate: `${startMonth}-01`, endDate: `${monthKey(afterEnd)}-01`, months: Array.from({ length }, (_, index) => monthKey(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1)))) };
}

async function getRecords(userId, range) {
  return Promise.all([
    Expense.find({ userId, date: { $gte: range.startDate, $lt: range.endDate } }).select('date amount currency category description').lean(),
    Income.find({ userId, date: { $gte: range.startDate, $lt: range.endDate } }).select('date amount currency category description').lean(),
    Budget.find({ userId, month: { $gte: range.months[0], $lte: range.months[range.months.length - 1] } }).select('month amount currency').lean(),
  ]);
}

async function executeReadTool(name, args, userId, user) {
  if (name === 'get_account_settings') {
    return User.findById(userId).select('-_id name email theme currency notifications language').lean();
  }
  if (name === 'get_budgets') {
    return Budget.find({ userId }).select('month amount currency').sort({ month: -1 }).lean()
      .then((rows) => rows.map((row) => ({ month: row.month, amount: Number(row.amount), currency: row.currency || user.currency || 'BDT' })));
  }
  if (name === 'list_categories') {
    return Category.find({ userId }).select('_id name').sort({ name: 1 }).lean()
      .then((categories) => categories.map((category) => ({ id: String(category._id), name: category.name })));
  }
  if (name === 'get_finance_summary') {
    const range = recentMonths(args.months);
    const [expenses, incomes, budgetRows] = await getRecords(userId, range);
    const budgets = Object.fromEntries(budgetRows.map((budget) => [budget.month, { amount: Number(budget.amount), currency: budget.currency || user.currency || 'BDT' }]));
    return summarize(expenses, incomes, budgets, user.currency || 'BDT', range.months);
  }

  if (name === 'generate_finance_report') {
    const range = dateRange(args.startMonth, args.endMonth);
    if (!range) return { error: 'Choose a valid range no longer than 12 months.' };
    const [expenses, incomes, budgetRows] = await getRecords(userId, range);
    const budgets = Object.fromEntries(budgetRows.map((budget) => [budget.month, { amount: Number(budget.amount), currency: budget.currency || user.currency || 'BDT' }]));
    return summarize(expenses, incomes, budgets, user.currency || 'BDT', range.months);
  }

  if (name === 'search_transactions') {
    const type = ['expense', 'income'].includes(args.type) ? args.type : null;
    const month = args.month && MONTH_PATTERN.test(args.month) ? args.month : null;
    const query = typeof args.query === 'string' ? args.query.trim().slice(0, 80) : '';
    const category = typeof args.category === 'string' ? args.category.trim().slice(0, 50) : '';
    const filter = { userId };
    if (month) filter.date = { $gte: `${month}-01`, $lt: `${monthKey(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)))}-01` };
    if (category) filter.category = { $regex: `^${category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' };
    if (query) {
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ category: { $regex: escapedQuery, $options: 'i' } }, { description: { $regex: escapedQuery, $options: 'i' } }];
    }
    const [expenseRows, incomeRows] = await Promise.all([
      type === 'income' ? [] : Expense.find(filter).select('date amount currency category description').sort({ date: -1 }).limit(15).lean(),
      type === 'expense' ? [] : Income.find(filter).select('date amount currency category description').sort({ date: -1 }).limit(15).lean(),
    ]);
    return [...expenseRows.map((row) => ({ ...row, type: 'expense' })), ...incomeRows.map((row) => ({ ...row, type: 'income' }))]
      .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20)
      .map((row) => ({ id: String(row._id), type: row.type, date: row.date, category: row.category, amount: row.amount, currency: row.currency, description: row.description || '' }));
  }

  return { error: 'Unknown read operation.' };
}

function normalizeRecord(args, user, existing = {}) {
  const date = args.date ?? existing.date;
  const category = String(args.category ?? existing.category ?? '').trim();
  const amount = Number(args.amount ?? existing.amount);
  const description = String(args.description ?? existing.description ?? '').trim();
  const currency = String(args.currency ?? existing.currency ?? user.currency ?? 'BDT').toUpperCase();
  if (!isValidDate(date)) return { error: 'Use a real date in YYYY-MM-DD format.' };
  if (!category || category.length > 50) return { error: 'Category must contain 1 to 50 characters.' };
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000000) return { error: 'Amount must be greater than 0 and no more than 1,000,000,000.' };
  if (!CURRENCIES.has(currency)) return { error: 'Currency must be BDT, USD, EUR, GBP, or INR.' };
  if (description.length > 500) return { error: 'Description must be 500 characters or fewer.' };
  return { value: { date, category, amount, currency, description } };
}

async function prepareWriteAction(name, args, userId, user) {
  let operation;
  let payload;
  let preview;

  if (name === 'propose_transaction') {
    if (!['expense', 'income'].includes(args.type)) return { error: 'Choose expense or income.' };
    const normalized = normalizeRecord(args, user);
    if (normalized.error) return normalized;
    operation = args.type === 'expense' ? 'create-expense' : 'create-income';
    payload = normalized.value;
    preview = { type: args.type, ...normalized.value };
  } else if (name === 'propose_transaction_update' || name === 'propose_transaction_delete') {
    if (!mongoose.isValidObjectId(args.transactionId)) return { error: 'Search for the record first, then choose a valid record ID.' };
    const existingExpense = await Expense.findOne({ _id: args.transactionId, userId }).lean();
    const existingIncome = existingExpense ? null : await Income.findOne({ _id: args.transactionId, userId }).lean();
    const existing = existingExpense || existingIncome;
    if (!existing) return { error: 'I could not find that record in your account.' };
    const type = existingExpense ? 'expense' : 'income';
    if (name === 'propose_transaction_delete') {
      operation = type === 'expense' ? 'delete-expense' : 'delete-income';
      payload = { id: String(existing._id) };
      preview = { type, id: String(existing._id), date: existing.date, category: existing.category, amount: existing.amount, currency: existing.currency, description: existing.description || '' };
    } else {
      const normalized = normalizeRecord(args, user, existing);
      if (normalized.error) return normalized;
      operation = type === 'expense' ? 'update-expense' : 'update-income';
      payload = { id: String(existing._id), record: normalized.value };
      preview = { type, id: String(existing._id), ...normalized.value };
    }
  } else if (name === 'propose_budget') {
    if (!MONTH_PATTERN.test(args.month || '') || !Number.isFinite(Number(args.amount)) || Number(args.amount) <= 0 || Number(args.amount) > 1000000000) {
      return { error: 'Use a valid YYYY-MM month and a budget amount from 0.01 to 1,000,000,000.' };
    }
    operation = 'set-budget';
    payload = { month: args.month, amount: Number(args.amount), currency: user.currency || 'BDT' };
    preview = { month: args.month, amount: Number(args.amount), currency: user.currency || 'BDT' };
  } else if (name === 'propose_budget_delete') {
    if (!MONTH_PATTERN.test(args.month || '')) return { error: 'Use a valid YYYY-MM budget month.' };
    const budget = await Budget.findOne({ userId, month: args.month }).lean();
    if (!budget) return { error: 'There is no budget for that month in your account.' };
    operation = 'delete-budget';
    payload = { month: budget.month };
    preview = { month: budget.month, amount: Number(budget.amount), currency: budget.currency || user.currency || 'BDT', effect: 'Removes this monthly budget.' };
  } else if (name === 'propose_category') {
    const categoryName = typeof args.name === 'string' ? args.name.trim() : '';
    if (!categoryName || categoryName.length > 50) return { error: 'Category name must contain 1 to 50 characters.' };
    const duplicate = await Category.findOne({ userId, name: { $regex: `^${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }).lean();
    if (duplicate) return { error: 'That category already exists.' };
    operation = 'create-category';
    payload = { name: categoryName };
    preview = { category: categoryName };
  } else if (name === 'propose_category_update' || name === 'propose_category_delete') {
    if (!mongoose.isValidObjectId(args.categoryId)) return { error: 'Use a category ID from your category list.' };
    const category = await Category.findOne({ _id: args.categoryId, userId }).lean();
    if (!category) return { error: 'I could not find that category in your account.' };
    if (name === 'propose_category_delete') {
      operation = 'delete-category';
      payload = { id: String(category._id) };
      preview = { category: category.name, effect: 'Deletes only the category; existing transactions remain.' };
    } else {
      const categoryName = typeof args.name === 'string' ? args.name.trim() : '';
      if (!categoryName || categoryName.length > 50) return { error: 'Category name must contain 1 to 50 characters.' };
      const duplicate = await Category.findOne({ userId, _id: { $ne: category._id }, name: { $regex: `^${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }).lean();
      if (duplicate) return { error: 'That category already exists.' };
      operation = 'update-category';
      payload = { id: String(category._id), name: categoryName };
      preview = { previousName: category.name, newName: categoryName };
    }
  } else if (name === 'propose_profile_update') {
    const update = {};
    if (args.name !== undefined) {
      const profileName = typeof args.name === 'string' ? args.name.trim() : '';
      if (!profileName || profileName.length > 80) return { error: 'Name must contain 1 to 80 characters.' };
      update.name = profileName;
    }
    if (args.email !== undefined) {
      const email = typeof args.email === 'string' ? args.email.trim().toLowerCase() : '';
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email address.' };
      update.email = email;
    }
    if (!Object.keys(update).length) return { error: 'Provide a new name or email address to update.' };
    operation = 'update-profile';
    payload = update;
    preview = update;
  } else if (name === 'propose_settings_update') {
    const update = {};
    if (args.theme !== undefined) {
      if (!['Light', 'Dark'].includes(args.theme)) return { error: 'Theme must be Light or Dark.' };
      update.theme = args.theme;
    }
    if (args.currency !== undefined) {
      if (!CURRENCIES.has(args.currency)) return { error: 'Choose a supported currency: BDT, USD, EUR, GBP, or INR.' };
      update.currency = args.currency;
    }
    if (args.language !== undefined) {
      if (!['English', 'Bangla', 'Spanish', 'French'].includes(args.language)) return { error: 'Choose a supported language.' };
      update.language = args.language;
    }
    if (args.notifications !== undefined) {
      if (typeof args.notifications !== 'boolean') return { error: 'Notifications must be enabled or disabled.' };
      update.notifications = args.notifications;
    }
    if (!Object.keys(update).length) return { error: 'Provide at least one setting to update.' };
    operation = 'update-settings';
    payload = update;
    preview = update;
  } else {
    return { error: 'Unknown write operation.' };
  }

  const pending = await PendingAiAction.create({
    userId,
    operation,
    payload,
    preview,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });
  return { pendingAction: { id: String(pending._id), operation, preview, expiresAt: pending.expiresAt } };
}

async function applyPendingAction(action, userId) {
  const { operation, payload } = action;
  if (operation === 'create-expense') return Expense.create({ userId, ...payload });
  if (operation === 'create-income') return Income.create({ userId, ...payload });
  if (operation === 'update-expense') return Expense.findOneAndUpdate({ _id: payload.id, userId }, payload.record, { returnDocument: 'after', runValidators: true });
  if (operation === 'update-income') return Income.findOneAndUpdate({ _id: payload.id, userId }, payload.record, { returnDocument: 'after', runValidators: true });
  if (operation === 'delete-expense') return Expense.findOneAndDelete({ _id: payload.id, userId });
  if (operation === 'delete-income') return Income.findOneAndDelete({ _id: payload.id, userId });
  if (operation === 'set-budget') return Budget.findOneAndUpdate(
    { userId, month: payload.month }, { $set: { amount: payload.amount, currency: payload.currency || 'BDT' } }, { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
  );
  if (operation === 'delete-budget') return Budget.findOneAndDelete({ userId, month: payload.month });
  if (operation === 'create-category') return Category.create({ userId, name: payload.name });
  if (operation === 'update-category') return Category.findOneAndUpdate({ _id: payload.id, userId }, { name: payload.name }, { returnDocument: 'after', runValidators: true });
  if (operation === 'delete-category') return Category.findOneAndDelete({ _id: payload.id, userId });
  if (operation === 'update-profile' || operation === 'update-settings') {
    if (payload.currency) {
      const currentUser = await User.findById(userId).select('currency');
      if (currentUser && payload.currency !== currentUser.currency) {
        await Budget.updateMany(
          { userId, currency: { $exists: false } },
          { $set: { currency: currentUser.currency || 'BDT' } },
        );
      }
    }
    return User.findByIdAndUpdate(userId, payload, { returnDocument: 'after', runValidators: true }).select('-password');
  }
  throw new Error('Unsupported pending action.');
}

module.exports = {
  applyPendingAction,
  executeReadTool,
  functionDeclarations,
  prepareWriteAction,
  recentMonths,
  summarize,
  writeActions,
};
