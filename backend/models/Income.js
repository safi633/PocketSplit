const mongoose = require('mongoose');

const incomeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true },
  category: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0.01 },
  currency: { type: String, enum: ['BDT', 'USD', 'EUR', 'GBP', 'INR'], required: true },
  description: { type: String, default: '' },
}, { timestamps: true });

incomeSchema.index({ userId: 1, date: -1, createdAt: -1 });

module.exports = mongoose.model('Income', incomeSchema);
