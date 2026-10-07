const express = require('express');
const Income = require('../models/Income');
const User = require('../models/User');
const { requireAuth, requireSameUser } = require('../middleware/auth');
const { requireValidId, validateRecord } = require('../middleware/validation');

const router = express.Router();

router.use(requireAuth);

router.get('/:userId', requireValidId('userId'), requireSameUser, async (req, res) => {
  try {
    const incomes = await Income.find({ userId: req.params.userId }).sort({ date: -1, createdAt: -1 });
    res.json(incomes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:userId', requireValidId('userId'), requireSameUser, validateRecord('income'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('currency');
    if (!user) return res.status(404).json({ error: 'User not found' });
    const income = await Income.create({
      userId: req.params.userId,
      currency: user.currency || 'BDT',
      ...req.validatedBody,
    });
    res.status(201).json(income);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', requireValidId(), validateRecord('income'), async (req, res) => {
  try {
    const updated = await Income.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.validatedBody,
      { returnDocument: 'after', runValidators: true },
    );
    if (!updated) return res.status(404).json({ error: 'Income record not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', requireValidId(), async (req, res) => {
  try {
    const deleted = await Income.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!deleted) return res.status(404).json({ error: 'Income record not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
