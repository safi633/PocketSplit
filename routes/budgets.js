const express = require('express');
const Budget = require('../models/Budget');
const { requireAuth, requireSameUser } = require('../middleware/auth');
const { requireValidId, validateBudget } = require('../middleware/validation');

const router = express.Router();

router.use(requireAuth);

router.get('/:userId', requireValidId('userId'), requireSameUser, async (req, res) => {
  try {
    const budgets = await Budget.find({ userId: req.params.userId }).sort({ month: -1 });
    res.json(budgets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:userId', requireValidId('userId'), requireSameUser, validateBudget, async (req, res) => {
  try {
    const existing = await Budget.findOne({ userId: req.params.userId, month: req.validatedBody.month });
    if (existing) {
      existing.amount = req.validatedBody.amount;
      await existing.save();
      return res.json(existing);
    }

    const budget = await Budget.create({ userId: req.params.userId, ...req.validatedBody });
    res.status(201).json(budget);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', requireValidId(), async (req, res) => {
  try {
    const deleted = await Budget.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!deleted) return res.status(404).json({ error: 'Budget not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
