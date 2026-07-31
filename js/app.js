const state = {
  user: null,
  token: localStorage.getItem('authToken'),
  selectedExpenseId: null,
  selectedIncomeId: null,
  selectedCategoryId: null,
  selectedBudgetId: null,
};

const api = {
  async request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;

    const res = await fetch(`/api${path}`, {
      ...options,
      headers,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },
  login(payload) { return this.request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }); },
  signup(payload) { return this.request('/auth/signup', { method: 'POST', body: JSON.stringify(payload) }); },
  me() { return this.request('/auth/me'); },
  getExpenses(userId) { return this.request(`/expenses/${userId}`); },
  addExpense(userId, payload) { return this.request(`/expenses/${userId}`, { method: 'POST', body: JSON.stringify(payload) }); },
  updateExpense(id, payload) { return this.request(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(payload) }); },
  deleteExpense(id) { return this.request(`/expenses/${id}`, { method: 'DELETE' }); },
  getIncomes(userId) { return this.request(`/incomes/${userId}`); },
  addIncome(userId, payload) { return this.request(`/incomes/${userId}`, { method: 'POST', body: JSON.stringify(payload) }); },
  updateIncome(id, payload) { return this.request(`/incomes/${id}`, { method: 'PUT', body: JSON.stringify(payload) }); },
  deleteIncome(id) { return this.request(`/incomes/${id}`, { method: 'DELETE' }); },
  getTransactions(userId) { return this.request(`/transactions/${userId}`); },
  addTransaction(userId, payload) { return this.request(`/transactions/${userId}`, { method: 'POST', body: JSON.stringify(payload) }); },
  updateTransaction(id, payload) { return this.request(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(payload) }); },
  deleteTransaction(id) { return this.request(`/transactions/${id}`, { method: 'DELETE' }); },
  getCategories(userId) { return this.request(`/categories/${userId}`); },
  addCategory(userId, payload) { return this.request(`/categories/${userId}`, { method: 'POST', body: JSON.stringify(payload) }); },
  updateCategory(id, payload) { return this.request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(payload) }); },
  deleteCategory(id) { return this.request(`/categories/${id}`, { method: 'DELETE' }); },
  getBudgets(userId) { return this.request(`/budgets/${userId}`); },
  saveBudget(userId, payload) { return this.request(`/budgets/${userId}`, { method: 'POST', body: JSON.stringify(payload) }); },
  deleteBudget(id) { return this.request(`/budgets/${id}`, { method: 'DELETE' }); },
  getReports(userId) { return this.request(`/reports/${userId}`); },
  getProfile(id) { return this.request(`/profile/${id}`); },
  updateProfile(id, payload) { return this.request(`/profile/${id}`, { method: 'PUT', body: JSON.stringify(payload) }); },
};

function toast(message, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast show ${type}`;
  setTimeout(() => { el.className = 'toast'; }, 3000);
}

function showPage(id) {
  document.querySelectorAll('.auth-page').forEach((page) => page.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showAbout() {
  document.getElementById('aboutModal').classList.add('active');
}

function closeAbout() {
  document.getElementById('aboutModal').classList.remove('active');
}

function confirm2(message, cb) {
  document.getElementById('confirmMsg').textContent = message;
  document.getElementById('confirmDialog').classList.add('active');
  window.confirmCallback = cb;
}

function confirmYes() {
  document.getElementById('confirmDialog').classList.remove('active');
  if (window.confirmCallback) {
    window.confirmCallback();
    window.confirmCallback = null;
  }
}

function confirmNo() {
  document.getElementById('confirmDialog').classList.remove('active');
  window.confirmCallback = null;
}

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function now() {
  return new Date().toISOString().slice(0, 10);
}

function monthLabel() {
  const d = new Date();
  return d.toLocaleString('default', { month: 'long' }) + ' ' + d.getFullYear();
}

function curYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function isValidUsername(username) {
  return username.length >= 3 && username.length <= 16;
}

async function doLogin() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;

  if (!username || !password) {
    toast('Please enter username and password', 'error');
    return;
  }

  try {
    const response = await api.login({ username, password });
    if (!response?.user) {
      throw new Error('Login failed');
    }
    state.user = response.user;
    state.token = response.token;
    localStorage.setItem('authToken', response.token);
    launchApp();
    toast('Login successful');
  } catch (error) {
    toast(error.message || 'Login failed', 'error');
  }
}

async function doSignup() {
  const payload = {
    name: document.getElementById('suName').value.trim(),
    email: document.getElementById('suEmail').value.trim(),
    username: document.getElementById('suUser').value.trim().toLowerCase(),
    password: document.getElementById('suPass').value,
  };

  if (!payload.name || !payload.email || !payload.username || !payload.password) {
    toast('Please fill in all fields', 'error');
    return;
  }
  if (!isValidUsername(payload.username)) {
    toast('Username must be 3-16 characters long', 'error');
    return;
  }

  try {
    const response = await api.signup(payload);
    state.user = response.user;
    state.token = response.token;
    localStorage.setItem('authToken', response.token);
    toast('Account created successfully');
    launchApp();
  } catch (error) {
    toast(error.message, 'error');
  }
}

function doLogout() {
  confirm2('Are you sure you want to log out?', () => {
    state.user = null;
    state.token = null;
    localStorage.removeItem('authToken');
    document.getElementById('app').classList.remove('active');
    document.querySelectorAll('.auth-page').forEach((p) => p.classList.remove('active'));
    document.getElementById('loginPage').classList.add('active');
  });
}

function launchApp() {
  const app = document.getElementById('app');
  if (!app) {
    window.location.href = '/';
    return;
  }

  document.querySelectorAll('.auth-page').forEach((p) => p.classList.remove('active'));
  app.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('.nav-btn')[0].classList.add('active');
  renderDashboard();
}

function switchTab(tab, btn) {
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  const renderers = {
    dashboard: renderDashboard,
    expenses: renderExpenses,
    income: renderIncome,
    categories: renderCategories,
    budget: renderBudget,
    reports: renderReports,
    profile: renderProfile,
    settings: renderSettings,
  };
  renderers[tab]?.();
}

function setContent(html) {
  document.getElementById('content').innerHTML = html;
}

async function renderDashboard() {
  if (!state.user) return;
  try {
    const transactions = await api.getTransactions(state.user.id);
    const ym = curYM();
    const monthlyTransactions = transactions.filter((item) => item.date && item.date.startsWith(ym));
    const spent = monthlyTransactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + Number(item.amount), 0);
    const received = monthlyTransactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + Number(item.amount), 0);
    const balance = received - spent;
    const catTotals = monthlyTransactions.filter((item) => item.type === 'expense').reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + Number(item.amount);
      return acc;
    }, {});
    const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';
    const recent = [...monthlyTransactions]
      .sort((a, b) => `${b.date}${b.createdAt || ''}`.localeCompare(`${a.date}${a.createdAt || ''}`))
      .slice(0, 5);
    const recentRows = recent.length ? recent.map((item) => `<tr><td>${item.date}</td><td>${item.type === 'income' ? 'Income' : 'Expense'}</td><td>${item.description || ''}</td><td>${item.category}</td><td class="${item.type === 'income' ? 'green' : 'red'}">${item.type === 'income' ? '+' : '-'}${formatMoney(item.amount)}</td></tr>`).join('') : '<tr><td colspan="5" style="text-align:center;color:#999;padding:18px;">No transactions recorded yet</td></tr>';

    setContent(`
      <div class="welcome-header">Welcome back, <span>${state.user.name}!</span></div>
      <div class="month-label">Summary for ${monthLabel()}</div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-label">Income This Month</div><div class="stat-value green">${formatMoney(received)}</div></div>
        <div class="stat-card"><div class="stat-label">Spent This Month</div><div class="stat-value red">${formatMoney(spent)}</div></div>
        <div class="stat-card"><div class="stat-label">Current Balance</div><div class="stat-value blue">${formatMoney(balance)}</div></div>
        <div class="stat-card"><div class="stat-label">Top Category</div><div class="stat-value purple" style="font-size:18px">${topCat}</div></div>
      </div>
      <div class="section-card blue">
        <div class="section-title">Recent Transactions</div>
        <div class="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Category</th><th>Amount</th></tr></thead><tbody>${recentRows}</tbody></table></div>
      </div>
    `);
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function renderExpenses() {
  if (!state.user) return;
  try {
    const [categories, transactions] = await Promise.all([api.getCategories(state.user.id), api.getTransactions(state.user.id)]);
    const expenses = transactions.filter((item) => item.type === 'expense');
    const catOptions = categories.map((c) => `<option value="${c.name}">${c.name}</option>`).join('');
    const rows = expenses.map((e) => `<tr data-id="${e._id}" onclick="selectExpense('${e._id}')" style="cursor:pointer"><td>${e._id.slice(-4)}</td><td>${e.date}</td><td>${e.category}</td><td>${formatMoney(e.amount)}</td><td>${e.description || ''}</td></tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:#999;padding:16px">No expenses yet</td></tr>';

    setContent(`
      <div class="section-card blue">
        <div class="section-title">Add / Update Expense</div>
        <div class="form-row">
          <div class="form-group"><label>Date</label><input class="form-input" id="expDate" type="date" value="${now()}"></div>
          <div class="form-group"><label>Category</label><select class="form-select" id="expCat"><option value="">-- Select --</option>${catOptions}</select></div>
          <div class="form-group"><label>Amount</label><input class="form-input" id="expAmt" type="number" step="0.01" min="0" placeholder="0.00"></div>
          <div class="form-group"><label>Description</label><input class="form-input" id="expDesc" type="text" placeholder="Optional"></div>
          <div class="form-group" style="flex-direction:row;gap:8px;justify-content:flex-end">
            <button class="btn btn-blue" onclick="addExpense()">Add</button>
            <button class="btn btn-green" onclick="updateExpense()">Update</button>
            <button class="btn btn-red" onclick="deleteExpense()">Delete</button>
          </div>
        </div>
      </div>
      <div class="section-card blue">
        <div class="section-title">Expenses</div>
        <div class="table-wrap"><table><thead><tr><th>ID</th><th>Date</th><th>Category</th><th>Amount</th><th>Description</th></tr></thead><tbody id="expTbody">${rows}</tbody></table></div>
      </div>
    `);
    state.selectedExpenseId = null;
  } catch (error) {
    toast(error.message, 'error');
  }
}

function selectExpense(id) {
  state.selectedExpenseId = id;
  const row = document.querySelector(`#expTbody tr[data-id="${id}"]`);
  row?.classList.add('selected');
}

async function addExpense() {
  try {
    const payload = {
      type: 'expense',
      date: document.getElementById('expDate').value,
      category: document.getElementById('expCat').value,
      amount: Number(document.getElementById('expAmt').value),
      description: document.getElementById('expDesc').value.trim(),
    };
    await api.addTransaction(state.user.id, payload);
    toast('Expense added');
    renderExpenses();
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function updateExpense() {
  if (!state.selectedExpenseId) {
    toast('Please select an expense to update', 'error');
    return;
  }
  try {
    const payload = {
      type: 'expense',
      date: document.getElementById('expDate').value,
      category: document.getElementById('expCat').value,
      amount: Number(document.getElementById('expAmt').value),
      description: document.getElementById('expDesc').value.trim(),
    };
    await api.updateTransaction(state.selectedExpenseId, payload);
    toast('Expense updated');
    renderExpenses();
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function deleteExpense() {
  if (!state.selectedExpenseId) {
    toast('Please select an expense to delete', 'error');
    return;
  }
  confirm2('Delete this expense?', async () => {
    try {
      await api.deleteTransaction(state.selectedExpenseId);
      toast('Expense deleted');
      renderExpenses();
    } catch (error) {
      toast(error.message, 'error');
    }
  });
}

async function renderIncome() {
  if (!state.user) return;
  try {
    const incomes = await api.getIncomes(state.user.id);
    const rows = incomes.map((income) => `<tr data-id="${income._id}" onclick="selectIncome('${income._id}')" style="cursor:pointer"><td>${income._id.slice(-4)}</td><td>${income.date}</td><td>${income.category}</td><td>${formatMoney(income.amount)}</td><td>${income.description || ''}</td></tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:#999;padding:16px">No income recorded yet</td></tr>';

    setContent(`
      <div class="section-card blue">
        <div class="section-title">Add / Update Income</div>
        <div class="form-row">
          <div class="form-group"><label>Date</label><input class="form-input" id="incDate" type="date" value="${now()}"></div>
          <div class="form-group"><label>Category</label><select class="form-select" id="incCat"><option value="">-- Select --</option><option>Salary</option><option>Freelance</option><option>Business</option><option>Investment</option><option>Bonus</option><option>Other</option></select></div>
          <div class="form-group"><label>Amount</label><input class="form-input" id="incAmt" type="number" step="0.01" min="0" placeholder="0.00"></div>
          <div class="form-group"><label>Description</label><input class="form-input" id="incDesc" type="text" placeholder="Optional"></div>
          <div class="form-group" style="flex-direction:row;gap:8px;justify-content:flex-end">
            <button class="btn btn-green" onclick="addIncome()">Add</button>
            <button class="btn btn-orange" onclick="updateIncome()">Update</button>
            <button class="btn btn-red" onclick="deleteIncome()">Delete</button>
          </div>
        </div>
      </div>
      <div class="section-card blue">
        <div class="section-title">Income</div>
        <div class="table-wrap"><table><thead><tr><th>ID</th><th>Date</th><th>Category</th><th>Amount</th><th>Description</th></tr></thead><tbody id="incTbody">${rows}</tbody></table></div>
      </div>
    `);
    state.selectedIncomeId = null;
  } catch (error) {
    toast(error.message, 'error');
  }
}

function selectIncome(id) {
  state.selectedIncomeId = id;
  const row = document.querySelector(`#incTbody tr[data-id="${id}"]`);
  row?.classList.add('selected');
}

function incomePayload() {
  return {
    date: document.getElementById('incDate').value,
    category: document.getElementById('incCat').value,
    amount: Number(document.getElementById('incAmt').value),
    description: document.getElementById('incDesc').value.trim(),
  };
}

async function addIncome() {
  try {
    await api.addIncome(state.user.id, incomePayload());
    toast('Income added');
    renderIncome();
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function updateIncome() {
  if (!state.selectedIncomeId) {
    toast('Please select an income record to update', 'error');
    return;
  }
  try {
    await api.updateIncome(state.selectedIncomeId, incomePayload());
    toast('Income updated');
    renderIncome();
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function deleteIncome() {
  if (!state.selectedIncomeId) {
    toast('Please select an income record to delete', 'error');
    return;
  }
  confirm2('Delete this income record?', async () => {
    try {
      await api.deleteIncome(state.selectedIncomeId);
      toast('Income deleted');
      renderIncome();
    } catch (error) {
      toast(error.message, 'error');
    }
  });
}

async function renderCategories() {
  if (!state.user) return;
  try {
    const categories = await api.getCategories(state.user.id);
    const rows = categories.map((c) => `<tr data-id="${c._id}" onclick="state.selectedCategoryId='${c._id}'; document.getElementById('catName').value='${c.name}'; document.querySelectorAll('#catTbody tr').forEach(r=>r.classList.remove('selected')); this.closest('tr').classList.add('selected');" style="cursor:pointer"><td>${c._id.slice(-4)}</td><td>${c.name}</td></tr>`).join('') || '<tr><td colspan="2" style="text-align:center;color:#999;padding:16px">No categories yet</td></tr>';

    setContent(`
      <div class="section-card blue">
        <div class="section-title">Manage Categories</div>
        <div class="form-row">
          <div class="form-group"><label>Category Name</label><input class="form-input" id="catName" type="text" placeholder="e.g. Groceries"></div>
          <div class="form-group" style="flex-direction:row;gap:8px;justify-content:flex-end">
            <button class="btn btn-blue" onclick="addCategory()">Add</button>
            <button class="btn btn-orange" onclick="updateCategory()">Update</button>
            <button class="btn btn-red" onclick="deleteCategory()">Delete</button>
          </div>
        </div>
      </div>
      <div class="section-card blue">
        <div class="section-title">Your Categories</div>
        <div class="table-wrap"><table><thead><tr><th>ID</th><th>Category Name</th></tr></thead><tbody id="catTbody">${rows}</tbody></table></div>
      </div>
    `);
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function addCategory() {
  const name = document.getElementById('catName').value.trim();
  if (!name) {
    toast('Category name cannot be empty', 'error');
    return;
  }
  try {
    await api.addCategory(state.user.id, { name });
    toast('Category added');
    renderCategories();
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function updateCategory() {
  if (!state.selectedCategoryId) {
    toast('Please select a category to update', 'error');
    return;
  }
  try {
    await api.updateCategory(state.selectedCategoryId, { name: document.getElementById('catName').value.trim() });
    toast('Category updated');
    renderCategories();
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function deleteCategory() {
  if (!state.selectedCategoryId) {
    toast('Please select a category to delete', 'error');
    return;
  }
  confirm2('Delete this category?', async () => {
    try {
      await api.deleteCategory(state.selectedCategoryId);
      toast('Category deleted');
      renderCategories();
    } catch (error) {
      toast(error.message, 'error');
    }
  });
}

async function renderBudget() {
  if (!state.user) return;
  try {
    const [budgets, transactions] = await Promise.all([api.getBudgets(state.user.id), api.getTransactions(state.user.id)]);
    const expenses = (transactions || []).filter((item) => item.type === 'expense');
    const rows = budgets.map((b) => {
      const monthExpenses = (expenses || []).filter((e) => e.date && e.date.startsWith(b.month));
      const spent = monthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
      return `<tr data-id="${b._id}" onclick="state.selectedBudgetId='${b._id}'; document.getElementById('budMonth').value='${b.month}'; document.getElementById('budAmt').value='${b.amount}'; document.querySelectorAll('#budTbody tr').forEach(r=>r.classList.remove('selected')); this.closest('tr').classList.add('selected');" style="cursor:pointer"><td>${b._id.slice(-4)}</td><td>${b.month}</td><td>${formatMoney(b.amount)}</td><td>${formatMoney(spent)}</td></tr>`;
    }).join('') || '<tr><td colspan="5" style="text-align:center;color:#999;padding:16px">No budgets yet</td></tr>';

    setContent(`
      <div class="section-card blue">
        <div class="section-title">Add / Update Budget</div>
        <div class="form-row">
          <div class="form-group"><label>Month</label><input class="form-input" id="budMonth" type="month" value="${curYM()}"></div>
          <div class="form-group"><label>Budget Amount</label><input class="form-input" id="budAmt" type="number" step="0.01" min="0" placeholder="0.00"></div>
          <div class="form-group" style="flex-direction:row;gap:8px;justify-content:flex-end">
            <button class="btn btn-blue" onclick="addBudget()">Save</button>
            <button class="btn btn-red" onclick="deleteBudget()">Delete</button>
          </div>
        </div>
      </div>
      <div class="section-card blue">
        <div class="section-title">Budgets</div>
        <div class="table-wrap"><table><thead><tr><th>ID</th><th>Month</th><th>Budget</th><th>Spend</th></tr></thead><tbody id="budTbody">${rows}</tbody></table></div>
      </div>
    `);
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function addBudget() {
  try {
    await api.saveBudget(state.user.id, { month: document.getElementById('budMonth').value, amount: Number(document.getElementById('budAmt').value) });
    toast('Budget saved');
    renderBudget();
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function deleteBudget() {
  if (!state.selectedBudgetId) {
    toast('Please select a budget to delete', 'error');
    return;
  }
  confirm2('Delete this budget?', async () => {
    try {
      await api.deleteBudget(state.selectedBudgetId);
      toast('Budget deleted');
      renderBudget();
    } catch (error) {
      toast(error.message, 'error');
    }
  });
}

async function renderReports() {
  if (!state.user) return;
  try {
    const reports = await api.getReports(state.user.id);
    const rows = reports.length ? reports.map((r) => `<tr><td>${r.type === 'income' ? 'Income' : 'Expense'}</td><td>${r.category}</td><td>${formatMoney(r.total)}</td></tr>`).join('') : '<tr><td colspan="3" style="text-align:center;color:#999;padding:16px">No data yet</td></tr>';
    setContent(`
      <div class="reports-title">Income & Expense Report</div>
      <div class="section-card blue">
        <div class="section-title">Summary Table</div>
        <div class="table-wrap"><table><thead><tr><th>Type</th><th>Category</th><th>Total Amount</th></tr></thead><tbody>${rows}</tbody></table></div>
      </div>
    `);
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function renderProfile() {
  if (!state.user) return;
  try {
    const user = await api.getProfile(state.user.id);
    setContent(`
      <div class="section-card blue">
        <div class="section-title">User Profile</div>
        <div class="profile-form">
          <div class="form-group"><label>Full Name</label><input class="form-input" id="pfName" type="text" value="${user.name}"></div>
          <div class="form-group"><label>Username</label><input class="form-input" id="pfUser" type="text" value="${user.username}" readonly></div>
          <div class="form-group"><label>Email</label><input class="form-input" id="pfEmail" type="text" value="${user.email || ''}"></div>
          <div class="form-group"><label>New Password</label><input class="form-input" id="pfPass" type="password" placeholder="••••••••"></div>
          <button class="btn btn-blue" onclick="updateProfile()" style="margin-top:8px">Update Profile</button>
        </div>
      </div>
    `);
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function updateProfile() {
  try {
    const payload = {
      name: document.getElementById('pfName').value.trim(),
      email: document.getElementById('pfEmail').value.trim(),
      password: document.getElementById('pfPass').value,
    };

    const user = await api.updateProfile(state.user.id, payload);
    state.user = { ...state.user, ...user };
    toast('Profile updated');
    renderProfile();
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function renderSettings() {
  if (!state.user) return;
  try {
    const user = await api.getProfile(state.user.id);
    setContent(`
      <div class="section-card blue" style="max-width:480px">
        <div class="section-title">Application Settings</div>
        <div class="settings-form">
          <div class="settings-row"><label>Theme</label><select class="form-select" id="sTheme"><option ${user.theme === 'Light' ? 'selected' : ''}>Light</option><option ${user.theme === 'Dark' ? 'selected' : ''}>Dark</option></select></div>
          <div class="settings-row"><label>Enable Notifications</label><input type="checkbox" id="sNotif" ${user.notifications ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer"></div>
          <div class="settings-row"><label>Language</label><select class="form-select" id="sLang"><option ${user.language === 'English' ? 'selected' : ''}>English</option><option ${user.language === 'Spanish' ? 'selected' : ''}>Spanish</option><option ${user.language === 'French' ? 'selected' : ''}>French</option></select></div>
          <button class="btn btn-green" onclick="saveSettings()" style="margin-top:8px">Save Settings</button>
        </div>
      </div>
    `);
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function saveSettings() {
  try {
    const payload = {
      theme: document.getElementById('sTheme').value,
      notifications: document.getElementById('sNotif').checked,
      language: document.getElementById('sLang').value,
    };
    const user = await api.updateProfile(state.user.id, payload);
    state.user = { ...state.user, ...user };
    toast('Settings saved');
  } catch (error) {
    toast(error.message, 'error');
  }
}

window.doLogin = doLogin;
window.doSignup = doSignup;
window.showPage = showPage;
window.showAbout = showAbout;
window.closeAbout = closeAbout;
window.doLogout = doLogout;
window.switchTab = switchTab;
window.confirmYes = confirmYes;
window.confirmNo = confirmNo;
window.selectExpense = selectExpense;
window.addExpense = addExpense;
window.updateExpense = updateExpense;
window.deleteExpense = deleteExpense;
window.selectIncome = selectIncome;
window.addIncome = addIncome;
window.updateIncome = updateIncome;
window.deleteIncome = deleteIncome;
window.addCategory = addCategory;
window.updateCategory = updateCategory;
window.deleteCategory = deleteCategory;
window.addBudget = addBudget;
window.deleteBudget = deleteBudget;
window.updateProfile = updateProfile;
window.saveSettings = saveSettings;

async function restoreSession() {
  if (!state.token) return;

  try {
    const response = await api.me();
    state.user = response.user;
    launchApp();
  } catch (error) {
    state.token = null;
    localStorage.removeItem('authToken');
  }
}

restoreSession();
