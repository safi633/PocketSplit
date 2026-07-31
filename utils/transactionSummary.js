function summarizeTransactions(transactions = []) {
  const totalIncome = transactions
    .filter((item) => item.type === 'income')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const totalExpenses = transactions
    .filter((item) => item.type === 'expense')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const byCategory = transactions
    .map((item) => ({
      type: item.type,
      category: item.category,
      total: Number(item.amount || 0),
    }))
    .reduce((acc, item) => {
      const entry = acc.find((current) => current.type === item.type && current.category === item.category);
      if (entry) {
        entry.total += item.total;
      } else {
        acc.push(item);
      }
      return acc;
    }, []);

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
