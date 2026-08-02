const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  theme: { type: String, enum: ['Light', 'Dark'], default: 'Light' },
  currency: { type: String, enum: ['BDT', 'USD', 'EUR', 'GBP', 'INR'], default: 'BDT' },
  notifications: { type: Boolean, default: true },
  language: { type: String, enum: ['English', 'Bangla', 'Spanish', 'French'], default: 'English' },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
