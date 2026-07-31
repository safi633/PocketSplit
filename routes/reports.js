const express = require('express');
const Transaction = require('../models/Transaction');
const { requireAuth, requireSameUser } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/:userId', requireSameUser, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.params.userId });
    const totals = transactions.reduce((acc, item) => {
      const key = `${item.type}:${item.category}`;
      acc[key] = (acc[key] || 0) + Number(item.amount);
      return acc;
    }, {});

    res.json(Object.entries(totals).map(([key, total]) => {
      const [type, category] = key.split(':');
      return { type, category, total };
    }).sort((a, b) => a.type.localeCompare(b.type) || a.category.localeCompare(b.category)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
