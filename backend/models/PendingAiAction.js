const mongoose = require('mongoose');

const pendingAiActionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  operation: { type: String, enum: ['create-expense', 'create-income', 'update-expense', 'update-income', 'delete-expense', 'delete-income', 'set-budget', 'delete-budget', 'create-category', 'update-category', 'delete-category', 'update-profile', 'update-settings'], required: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  preview: { type: mongoose.Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  usedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('PendingAiAction', pendingAiActionSchema);
