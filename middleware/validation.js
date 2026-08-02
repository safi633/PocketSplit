const mongoose = require('mongoose');

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const isValidDate = (value) => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
const isValidMonth = (value) => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const isPositiveAmount = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

const validationError = (res, message) => res.status(400).json({ error: message });

const requireValidId = (param = 'id') => (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params[param])) {
    return validationError(res, 'Invalid resource identifier');
  }
  return next();
};

const validateCategory = (req, res, next) => {
  if (!isNonEmptyString(req.body.name) || req.body.name.trim().length > 50) {
    return validationError(res, 'Category name must be between 1 and 50 characters');
  }
  req.validatedBody = { name: req.body.name.trim() };
  return next();
};

const validateRecord = (requiredType) => (req, res, next) => {
  const { type, date, category, amount, description = '' } = req.body;
  if (!requiredType && !['income', 'expense'].includes(type)) {
    return validationError(res, 'Transaction type must be income or expense');
  }
  if (requiredType && type !== undefined && type !== requiredType) {
    return validationError(res, `Transaction type must be ${requiredType}`);
  }
  if (!isValidDate(date)) return validationError(res, 'Date must use YYYY-MM-DD format');
  if (!isNonEmptyString(category) || category.trim().length > 50) {
    return validationError(res, 'Category must be between 1 and 50 characters');
  }
  if (!isPositiveAmount(amount)) return validationError(res, 'Amount must be greater than zero');
  if (typeof description !== 'string' || description.length > 500) {
    return validationError(res, 'Description must be 500 characters or fewer');
  }
  req.validatedBody = {
    ...(requiredType ? {} : { type }),
    date,
    category: category.trim(),
    amount: Number(amount),
    description: description.trim(),
  };
  return next();
};

const validateBudget = (req, res, next) => {
  const { month, amount } = req.body;
  if (!isValidMonth(month)) return validationError(res, 'Month must use YYYY-MM format');
  if (!isPositiveAmount(amount)) return validationError(res, 'Budget amount must be greater than zero');
  req.validatedBody = { month, amount: Number(amount) };
  return next();
};

module.exports = {
  requireValidId,
  validateBudget,
  validateCategory,
  validateRecord,
  validationError,
};
