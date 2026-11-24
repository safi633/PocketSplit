const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Budget = require('../models/Budget');
const { requireAuth, requireSameUser } = require('../middleware/auth');
const { requireValidId } = require('../middleware/validation');

const router = express.Router();

router.use(requireAuth);

router.get('/:id', requireValidId(), requireSameUser, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', requireValidId(), requireSameUser, async (req, res) => {
  try {
    const update = {};
    for (const field of ['name', 'email', 'theme', 'currency', 'notifications', 'language']) {
      if (req.body[field] !== undefined) update[field] = req.body[field];
    }

    if (update.name !== undefined) update.name = update.name.trim();

    if (update.email !== undefined) update.email = update.email.trim().toLowerCase();

    if (req.body.password) {
      update.password = await bcrypt.hash(req.body.password, 10);
    }

    const currentUser = await User.findById(req.params.id).select('currency');
    if (!currentUser) return res.status(404).json({ error: 'User not found' });
    if (update.currency && update.currency !== currentUser.currency) {
      await Budget.updateMany(
        { userId: req.params.id, currency: { $exists: false } },
        { $set: { currency: currentUser.currency || 'BDT' } },
      );
    }
    const user = await User.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after', runValidators: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
