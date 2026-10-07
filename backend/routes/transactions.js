const express = require('express');
const Expense = require('../models/Expense');
const User = require('../models/User');
const { requireAuth, requireSameUser } = require('../middleware/auth');
const { requireValidId, validateRecord } = require('../middleware/validation');

const router = express.Router();

router.use(requireAuth);

router.get('/:userId', requireValidId('userId'), requireSameUser, async (req, res) => {
  try {
    const expenses = await Expense.find({ userId: req.params.userId }).sort({ date: -1, createdAt: -1 });
    res.json(expenses.map((expense) => ({ ...expense.toObject(), type: 'expense' })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:userId', requireValidId('userId'), requireSameUser, validateRecord(), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('currency');
    if (!user) return res.status(404).json({ error: 'User not found' });
    const expense = await Expense.create({
      userId: req.params.userId,
      currency: user.currency || 'BDT',
      ...req.validatedBody,
    });
    res.status(201).json({ ...expense.toObject(), type: 'expense' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', requireValidId(), validateRecord(), async (req, res) => {
  try {
    const updated = await Expense.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.validatedBody,
      { returnDocument: 'after', runValidators: true },
    );
    if (!updated) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ ...updated.toObject(), type: 'expense' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', requireValidId(), async (req, res) => {
  try {
    const deleted = await Expense.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!deleted) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
