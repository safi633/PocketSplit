const express = require('express');
const Category = require('../models/Category');
const { requireAuth, requireSameUser } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/:userId', requireSameUser, async (req, res) => {
  try {
    const categories = await Category.find({ userId: req.params.userId }).sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:userId', requireSameUser, async (req, res) => {
  try {
    const category = await Category.create({ userId: req.params.userId, name: req.body.name });
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await Category.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true },
    );
    if (!updated) return res.status(404).json({ error: 'Category not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Category.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!deleted) return res.status(404).json({ error: 'Category not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
