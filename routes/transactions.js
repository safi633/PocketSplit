const express = require('express');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { requireAuth, requireSameUser } = require('../middleware/auth');
const { requireValidId, validateRecord } = require('../middleware/validation');

const router = express.Router();

router.use(requireAuth);

router.get('/:userId', requireValidId('userId'), requireSameUser, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.params.userId }).sort({ date: -1, createdAt: -1 });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:userId', requireValidId('userId'), requireSameUser, validateRecord(), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('currency');
    if (!user) return res.status(404).json({ error: 'User not found' });
    const transaction = await Transaction.create({
      userId: req.params.userId,
      currency: user.currency || 'BDT',
      ...req.validatedBody,
    });
    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', requireValidId(), validateRecord(), async (req, res) => {
  try {
    const updated = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.validatedBody,
      { new: true, runValidators: true },
    );
    if (!updated) return res.status(404).json({ error: 'Transaction not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', requireValidId(), async (req, res) => {
  try {
    const deleted = await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!deleted) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
