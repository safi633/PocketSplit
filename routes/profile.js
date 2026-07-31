const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { requireAuth, requireSameUser } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/:id', requireSameUser, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', requireSameUser, async (req, res) => {
  try {
    const update = {};
    for (const field of ['name', 'email', 'theme', 'notifications', 'language']) {
      if (req.body[field] !== undefined) update[field] = req.body[field];
    }

    if (update.name !== undefined) update.name = update.name.trim();

    if (update.email !== undefined) update.email = update.email.trim().toLowerCase();

    if (req.body.password) {
      update.password = await bcrypt.hash(req.body.password, 10);
    }

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
