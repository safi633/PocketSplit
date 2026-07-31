const express = require('express');
const Budget = require('../models/Budget');
const Expense = require('../models/Expense');
const { requireAuth, requireSameUser } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/:userId', requireSameUser, async (req, res) => {
  try {
    const budgets = await Budget.find({ userId: req.params.userId }).sort({ month: -1 });
    res.json(budgets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:userId', requireSameUser, async (req, res) => {
  try {
    const existing = await Budget.findOne({ userId: req.params.userId, month: req.body.month });
    if (existing) {
      existing.amount = req.body.amount;
      await existing.save();
      return res.json(existing);
    }

    const budget = await Budget.create({ userId: req.params.userId, month: req.body.month, amount: req.body.amount });
    res.status(201).json(budget);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Budget.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!deleted) return res.status(404).json({ error: 'Budget not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:userId/summary', requireSameUser, async (req, res) => {
  try {
    const budgets = await Budget.find({ userId: req.params.userId });
    const expenses = await Expense.find({ userId: req.params.userId });

    const summary = budgets.map(b => {
      const spent = expenses.filter(e => e.date.startsWith(b.month)).reduce((s, e) => s + Number(e.amount), 0);
      return { month: b.month, amount: b.amount, spent, over: spent > b.amount };
    });

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
