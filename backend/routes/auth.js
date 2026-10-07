const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Category = require('../models/Category');
const { JWT_SECRET, requireAuth } = require('../middleware/auth');

const router = express.Router();

const USERNAME_REGEX = /^[a-z0-9_]{3,16}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const safeUserResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  username: user.username,
  theme: user.theme,
  currency: user.currency || 'BDT',
  notifications: user.notifications,
  language: user.language,
});

const validateSignup = ({ name, email, username, password }) => {
  if (!name || !email || !username || !password) {
    return 'All fields are required';
  }
  if (!USERNAME_REGEX.test(username)) {
    return 'Username must be 3 to 16 characters and use letters, numbers, or underscores only';
  }
  if (!EMAIL_REGEX.test(email)) {
    return 'A valid email address is required';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  return null;
};

const authResponse = (user) => ({
  user: safeUserResponse(user),
  token: jwt.sign(
    { id: user._id.toString(), username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' },
  ),
});

router.post('/signup', async (req, res) => {
  try {
    const name = req.body.name?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const username = req.body.username?.trim().toLowerCase();
    const { password } = req.body;

    const validationError = validateSignup({ name, email, username, password });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database is not ready yet. Please try again in a moment.' });
    }

    const existingUser = await User.findOne({ username }).maxTimeMS(5000);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, username, password: hashedPassword });

    const defaults = ['Food', 'Transport', 'Utilities', 'Health', 'Entertainment', 'Shopping', 'Others'];
    const categoryDocs = defaults.map(name => ({ userId: user._id, name }));
    await Category.insertMany(categoryDocs);

    res.status(201).json(authResponse(user));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const login = req.body.username?.trim().toLowerCase();
    const { password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database is not ready yet. Please try again in a moment.' });
    }

    const user = await User.findOne({
      username: login,
    }).maxTimeMS(5000);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    res.json(authResponse(user));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: safeUserResponse(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
