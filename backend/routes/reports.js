const express = require('express');
const Expense = require('../models/Expense');
const Income = require('../models/Income');
const { requireAuth, requireSameUser } = require('../middleware/auth');
const { requireValidId } = require('../middleware/validation');

const router = express.Router();

router.use(requireAuth);

router.get('/:userId', requireValidId('userId'), requireSameUser, async (req, res) => {
  try {
    const [expenses, incomes] = await Promise.all([
      Expense.find({ userId: req.params.userId }).lean(),
      Income.find({ userId: req.params.userId }).lean(),
    ]);
    const records = [
      ...expenses.map((expense) => ({ ...expense, type: 'expense' })),
      ...incomes.map((income) => ({ ...income, type: 'income' })),
    ];
    const totals = records.reduce((acc, item) => {
      const key = JSON.stringify([item.type, item.currency || 'BDT', item.category]);
      acc[key] = (acc[key] || 0) + Number(item.amount);
      return acc;
    }, {});

    res.json(Object.entries(totals).map(([key, total]) => {
      const [type, currency, category] = JSON.parse(key);
      return { type, currency, category, total };
    }).sort((a, b) => a.type.localeCompare(b.type) || a.category.localeCompare(b.category) || a.currency.localeCompare(b.currency)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
