const express = require('express');
const Income = require('../models/Income');
const { requireAuth, requireSameUser } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/:userId', requireSameUser, async (req, res) => {
  try {
    const incomes = await Income.find({ userId: req.params.userId }).sort({ date: -1, createdAt: -1 });
    res.json(incomes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:userId', requireSameUser, async (req, res) => {
  try {
    const income = await Income.create({
      userId: req.params.userId,
      date: req.body.date,
      category: req.body.category,
      amount: req.body.amount,
      description: req.body.description || '',
    });
    res.status(201).json(income);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await Income.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true },
    );
    if (!updated) return res.status(404).json({ error: 'Income record not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Income.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!deleted) return res.status(404).json({ error: 'Income record not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
