const mongoose = require('mongoose');
const budgetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month: { type: String, required: true },
  amount: { type: Number, required: true, min: 0.01 },
  currency: { type: String, enum: ['BDT', 'USD', 'EUR', 'GBP', 'INR'], required: true, default: 'BDT' },
}, { timestamps: true });
budgetSchema.index({ userId: 1, month: 1 }, { unique: true });
module.exports = mongoose.model('Budget', budgetSchema);
