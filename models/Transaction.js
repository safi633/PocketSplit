const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true, enum: ['income', 'expense'] },
  amount: { type: Number, required: true, min: 0.01 },
  currency: { type: String, enum: ['BDT', 'USD', 'EUR', 'GBP', 'INR'], required: true },
  category: { type: String, required: true, trim: true },
  date: { type: String, required: true },
  description: { type: String, default: '' },
}, { timestamps: true });

transactionSchema.index({ userId: 1, date: -1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
