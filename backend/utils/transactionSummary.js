function summarizeTransactions(transactions = []) {
  const categoryTotals = new Map();
  let totalIncome = 0;
  let totalExpenses = 0;

  for (const item of transactions) {
    const amount = Number(item.amount);
    if (!Number.isFinite(amount) || amount < 0 || !['income', 'expense'].includes(item.type)) continue;

    if (item.type === 'income') totalIncome += amount;
    if (item.type === 'expense') totalExpenses += amount;

    const category = item.category || 'Uncategorized';
    const key = `${item.type}:${category}`;
    categoryTotals.set(key, (categoryTotals.get(key) || 0) + amount);
  }

  const byCategory = Array.from(categoryTotals, ([key, total]) => {
    const [type, category] = key.split(':');
    return { type, category, total };
  });

  return {
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
    byCategory,
  };
}

module.exports = {
  summarizeTransactions,
};
