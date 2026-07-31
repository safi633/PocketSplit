const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  theme: { type: String, default: 'Light' },
  notifications: { type: Boolean, default: true },
  language: { type: String, default: 'English' },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
