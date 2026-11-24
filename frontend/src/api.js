const apiBaseUrl = import.meta.env.VITE_API_URL
  || (['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'http://localhost:5000/api' : '/api');

async function request(path, options = {}) {
  const token = localStorage.getItem('authToken');
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const json = (method, body) => ({ method, body: JSON.stringify(body) });

export const api = {
  login: (payload) => request('/auth/login', json('POST', payload)),
  signup: (payload) => request('/auth/signup', json('POST', payload)),
  me: () => request('/auth/me'),
  getTransactions: (userId) => request(`/transactions/${userId}`),
  addTransaction: (userId, payload) => request(`/transactions/${userId}`, json('POST', payload)),
  updateTransaction: (id, payload) => request(`/transactions/${id}`, json('PUT', payload)),
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: 'DELETE' }),
  getIncomes: (userId) => request(`/incomes/${userId}`),
  addIncome: (userId, payload) => request(`/incomes/${userId}`, json('POST', payload)),
  updateIncome: (id, payload) => request(`/incomes/${id}`, json('PUT', payload)),
  deleteIncome: (id) => request(`/incomes/${id}`, { method: 'DELETE' }),
  getCategories: (userId) => request(`/categories/${userId}`),
  addCategory: (userId, payload) => request(`/categories/${userId}`, json('POST', payload)),
  updateCategory: (id, payload) => request(`/categories/${id}`, json('PUT', payload)),
  deleteCategory: (id) => request(`/categories/${id}`, { method: 'DELETE' }),
  getBudgets: (userId) => request(`/budgets/${userId}`),
  saveBudget: (userId, payload) => request(`/budgets/${userId}`, json('POST', payload)),
  deleteBudget: (id) => request(`/budgets/${id}`, { method: 'DELETE' }),
  getReports: (userId) => request(`/reports/${userId}`),
  getProfile: (id) => request(`/profile/${id}`),
  updateProfile: (id, payload) => request(`/profile/${id}`, json('PUT', payload)),
  getAiModels: () => request('/ai/models'),
  chatWithCoach: (message, history, model, signal, attachment) => request('/ai/chat', { ...json('POST', { message, history, model, ...(attachment ? { attachment } : {}) }), signal }),
  confirmAiAction: (id) => request(`/ai/actions/${id}/confirm`, json('POST', {})),
  cancelAiAction: (id) => request(`/ai/actions/${id}/cancel`, json('POST', {})),
};
