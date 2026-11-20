import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from './api';

const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => today().slice(0, 7);
const emptyRecord = () => ({ date: today(), category: '', amount: '', description: '' });

function money(value, currency = 'BDT', language = 'en') {
  const locale = language === 'Bangla' ? 'bn-BD' : ({ BDT: 'en-BD', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB', INR: 'en-IN' }[currency] || 'en-BD');
  return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number(value || 0));
}

function AuthPage({ onAuthenticated }) {
  const [page, setPage] = useState(window.location.pathname === '/signup.html' ? 'signup' : 'login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const signup = page === 'signup';

  useEffect(() => {
    const sync = () => setPage(window.location.pathname === '/signup.html' ? 'signup' : 'login');
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  function navigate(next) {
    window.history.pushState({}, '', next === 'signup' ? '/signup.html' : '/login.html');
    setPage(next);
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const payload = signup
      ? { name: values.name.trim(), email: values.email.trim(), username: values.username.trim().toLowerCase(), password: values.password }
      : { username: values.username.trim(), password: values.password };
    try {
      const result = await api[signup ? 'signup' : 'login'](payload);
      localStorage.setItem('authToken', result.token);
      onAuthenticated(result.user);
      window.history.replaceState({}, '', '/');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page active">
      <section className="glass-card" aria-labelledby="auth-title">
        <div className="auth-left">
          <div className="brand-mark" aria-hidden="true">P</div>
          <h1 className="auth-title" id="auth-title">{signup ? 'Create your account' : 'PocketSplit'}</h1>
          <p className="auth-subtitle">{signup ? 'Start managing your finances today' : 'Manage your expenses and split smartly'}</p>
          <form className="auth-form" onSubmit={submit}>
            {signup && <>
              <label className="auth-label" htmlFor="auth-name">Full name</label>
              <input className="auth-input" id="auth-name" name="name" autoComplete="name" required />
              <label className="auth-label" htmlFor="auth-email">Email address</label>
              <input className="auth-input" id="auth-email" name="email" type="email" autoComplete="email" required />
            </>}
            <label className="auth-label" htmlFor="auth-username">Username</label>
            <input className="auth-input" id="auth-username" name="username" autoComplete="username" minLength={3} maxLength={16} required />
            <label className="auth-label" htmlFor="auth-password">Password</label>
            <input className="auth-input" id="auth-password" name="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={signup ? 2 : undefined} required />
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="grad-btn" disabled={busy}>{busy ? 'Please wait…' : signup ? 'CREATE ACCOUNT' : 'LOGIN'}</button>
          </form>
          <p className="auth-switch">{signup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button className="auth-link" type="button" onClick={() => navigate(signup ? 'login' : 'signup')}>{signup ? 'Log in' : 'Sign up'}</button>
          </p>
        </div>
        <aside className="auth-right">
          <h2>{signup ? 'Why PocketSplit?' : 'Welcome back'}</h2>
          <ul><li><span aria-hidden="true">✓</span> Track shared and daily expenses</li><li><span aria-hidden="true">✓</span> Keep monthly budgets in view</li><li><span aria-hidden="true">✓</span> Understand your spending</li></ul>
          <div className="auth-orbit auth-orbit-one" aria-hidden="true" /><div className="auth-orbit auth-orbit-two" aria-hidden="true" />
        </aside>
      </section>
    </main>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [restoring, setRestoring] = useState(Boolean(localStorage.getItem('authToken')));
  const [tab, setTab] = useState('dashboard');
  const [data, setData] = useState({ expenses: [], incomes: [], categories: [], budgets: [], reports: [] });
  const [notice, setNotice] = useState(null);
  const [aboutOpen, setAboutOpen] = useState(false);

  const notify = useCallback((message, type = 'success') => setNotice({ message, type, key: Date.now() }), []);
  const refresh = useCallback(async (activeUser = user) => {
    if (!activeUser) return;
    const [transactions, incomes, categories, budgets, reports] = await Promise.all([
      api.getTransactions(activeUser.id), api.getIncomes(activeUser.id), api.getCategories(activeUser.id),
      api.getBudgets(activeUser.id), api.getReports(activeUser.id),
    ]);
    setData({ expenses: transactions.filter((item) => item.type === 'expense'), incomes, categories, budgets, reports });
  }, [user]);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) return;
    api.me().then(({ user: activeUser }) => setUser(activeUser)).catch(() => {
      localStorage.removeItem('authToken');
    }).finally(() => setRestoring(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    document.documentElement.dataset.theme = (user.theme || 'Light').toLowerCase();
    document.documentElement.style.colorScheme = user.theme === 'Dark' ? 'dark' : 'light';
    document.documentElement.lang = user.language === 'Bangla' ? 'bn' : 'en';
    document.title = 'PocketSplit';
    refresh().catch((error) => notify(error.message, 'error'));
  }, [user, refresh, notify]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function perform(action, successMessage) {
    try {
      const result = await action();
      await refresh();
      notify(successMessage);
      return result;
    } catch (error) {
      notify(error.message, 'error');
      return null;
    }
  }

  function logout() {
    if (!window.confirm('Are you sure you want to log out?')) return;
    localStorage.removeItem('authToken');
    setUser(null);
    setData({ expenses: [], incomes: [], categories: [], budgets: [], reports: [] });
    setTab('dashboard');
  }

  if (restoring) return <div className="loading-screen" role="status">Loading PocketSplit…</div>;
  if (!user) return <AuthPage onAuthenticated={setUser} />;

  const contentProps = { user, setUser, data, refresh, perform, notify, onTab: setTab };
  const screens = {
    dashboard: <Dashboard {...contentProps} />,
    expenses: <RecordPage key="expense" kind="expense" {...contentProps} />,
    income: <RecordPage key="income" kind="income" {...contentProps} />,
    categories: <CategoryPage {...contentProps} />,
    budgets: <BudgetPage {...contentProps} />,
    reports: <ReportsPage {...contentProps} />,
    charts: <ExpenseChart {...contentProps} />,
    profile: <ProfilePage {...contentProps} />,
    settings: <SettingsPage {...contentProps} />,
  };

  const nav = [
    ['dashboard', 'Overview', '⌂'], ['expenses', 'Expenses', '−'], ['income', 'Income', '+'],
    ['categories', 'Categories', '▦'], ['budgets', 'Budgets', '◷'], ['reports', 'Reports', '▤'], ['charts', 'Charts', '📊'],
    ['profile', 'Profile', '◉'], ['settings', 'Settings', '⚙'],
  ];

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-title"><span className="header-mark">P</span> PocketSplit</div>
        <div className="header-actions"><span className="header-user">{user.name}</span><button className="header-link" onClick={() => setAboutOpen(true)}>About</button><button className="header-link" onClick={logout}>Log out</button></div>
      </header>
      <div className="app-body">
        <nav className="sidebar" aria-label="Main navigation">
          {nav.map(([id, label, icon]) => <button key={id} className={`nav-btn ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}><span className="nav-icon" aria-hidden="true">{icon}</span><span>{label}</span></button>)}
        </nav>
        <main className="content" id="main-content">{screens[tab]}</main>
      </div>
      {aboutOpen && <div className="modal-overlay active" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAboutOpen(false); }}>
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="about-title"><h3 id="about-title">PocketSplit</h3><p>Track spending, manage budgets, and keep shared expenses organized.</p><button className="modal-close" onClick={() => setAboutOpen(false)}>Close</button></section>
      </div>}
      {notice && <div className={`toast show ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'} key={notice.key}>{notice.message}</div>}
    </div>
  );
}

function PageHeading({ title, subtitle }) {
  return <div className="page-heading"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div></div>;
}

function Section({ title, children, className = '' }) {
  return <section className={`section-card blue ${className}`}><h2 className="section-title">{title}</h2>{children}</section>;
}

function EmptyRow({ columns, children = 'No records yet' }) {
  return <tr><td className="empty-cell" colSpan={columns}>{children}</td></tr>;
}

function Dashboard({ user, data, onTab }) {
  const month = currentMonth();
  const currentExpenses = data.expenses.filter((item) => item.date?.startsWith(month));
  const currentIncomes = data.incomes.filter((item) => item.date?.startsWith(month));
  const spent = currentExpenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const received = currentIncomes.reduce((sum, item) => sum + Number(item.amount), 0);
  const categorySpend = currentExpenses.reduce((totals, item) => ({ ...totals, [item.category]: (totals[item.category] || 0) + Number(item.amount) }), {});
  const topCategory = Object.entries(categorySpend).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  const recent = [...data.expenses.map((item) => ({ ...item, type: 'Expense' })), ...data.incomes.map((item) => ({ ...item, type: 'Income' }))]
    .sort((a, b) => `${b.date}${b.createdAt || ''}`.localeCompare(`${a.date}${a.createdAt || ''}`)).slice(0, 6);
  const currency = user.currency || 'BDT';

  return <>
    <PageHeading title={`Welcome back, ${user.name}`} subtitle={new Date().toLocaleDateString(user.language === 'Bangla' ? 'bn-BD' : 'en', { month: 'long', year: 'numeric' })} />
    <div className="stats-grid">
      <StatCard label="Income this month" value={money(received, currency, user.language)} tone="green" />
      <StatCard label="Spent this month" value={money(spent, currency, user.language)} tone="red" />
      <StatCard label="Current balance" value={money(received - spent, currency, user.language)} tone="blue" />
      <StatCard label="Top category" value={topCategory} tone="purple" />
    </div>
    <Section title="Recent activity">
      <DataTable headers={['Date', 'Type', 'Description', 'Category', 'Amount']}>
        {recent.length ? recent.map((item) => <tr key={`${item.type}-${item._id}`}><td>{item.date}</td><td><span className={`type-pill ${item.type.toLowerCase()}`}>{item.type}</span></td><td>{item.description || '—'}</td><td>{item.category}</td><td className={item.type === 'Income' ? 'amount-positive' : ''}>{item.type === 'Income' ? '+' : '−'}{money(item.amount, item.currency || currency, user.language)}</td></tr>) : <EmptyRow columns={5}>No transactions recorded yet</EmptyRow>}
      </DataTable>
    </Section>
    <div className="quick-actions"><button className="module-card" onClick={() => onTab('expenses')}>Add an expense <span>→</span></button><button className="module-card" onClick={() => onTab('income')}>Record income <span>→</span></button><button className="module-card" onClick={() => onTab('budgets')}>Review budgets <span>→</span></button></div>
  </>;
}

function StatCard({ label, value, tone }) {
  return <div className="stat-card"><div className="stat-label">{label}</div><div className={`stat-value ${tone}`}>{value}</div></div>;
}

function DataTable({ headers, children }) {
  return <div className="table-wrap"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}

function FormField({ label, value, onChange, type = 'text', options, placeholder, min, step, readOnly = false }) {
  const id = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return <div className="form-group"><label htmlFor={id}>{label}</label>{options
    ? <select className="form-select" id={id} value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select {label.toLowerCase()}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
    : <input className="form-input" id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} min={min} step={step} readOnly={readOnly} />}</div>;
}

function RecordPage({ kind, user, data, perform, notify }) {
  const isExpense = kind === 'expense';
  const records = isExpense ? data.expenses : data.incomes;
  const categories = isExpense ? data.categories.map((item) => item.name) : ['Salary', 'Freelance', 'Business', 'Investment', 'Bonus', 'Other'];
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(emptyRecord);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  // NEW: client-side search + category filter (no backend change needed)
  const visibleRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((record) =>
      (!filterCategory || record.category === filterCategory) &&
      (!term || `${record.description || ''} ${record.category} ${record.date} ${record.amount}`.toLowerCase().includes(term)));
  }, [records, search, filterCategory]);
  const visibleTotal = visibleRecords.reduce((sum, record) => sum + Number(record.amount), 0);
  const filtering = Boolean(search.trim() || filterCategory);

  function select(record) {
    setSelectedId(record._id);
    setForm({ date: record.date, category: record.category, amount: String(record.amount), description: record.description || '' });
  }

  function clear() {
    setSelectedId('');
    setForm(emptyRecord());
  }

  async function save(event) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!form.date || !form.category || !Number.isFinite(amount) || amount <= 0) {
      notify('Enter a date, category, and amount greater than zero', 'error');
      return;
    }
    const payload = { ...form, amount, ...(isExpense ? { type: 'expense' } : {}) };
    const result = await perform(() => selectedId
      ? (isExpense ? api.updateTransaction(selectedId, payload) : api.updateIncome(selectedId, payload))
      : (isExpense ? api.addTransaction(user.id, payload) : api.addIncome(user.id, payload)), `${isExpense ? 'Expense' : 'Income'} ${selectedId ? 'updated' : 'added'}`);
    if (result) clear();
  }

  async function remove() {
    if (!selectedId) return notify(`Select ${isExpense ? 'an expense' : 'an income record'} to delete`, 'error');
    if (!window.confirm(`Delete this ${isExpense ? 'expense' : 'income record'}?`)) return;
    const result = await perform(() => isExpense ? api.deleteTransaction(selectedId) : api.deleteIncome(selectedId), `${isExpense ? 'Expense' : 'Income'} deleted`);
    if (result) clear();
  }

  return <>
    <PageHeading title={isExpense ? 'Expenses' : 'Income'} subtitle={isExpense ? 'Record and manage your spending.' : 'Record and manage money coming in.'} />
    <Section title={`${selectedId ? 'Update' : 'Add'} ${isExpense ? 'expense' : 'income'}`}>
      <form className="form-row" onSubmit={save}>
        <FormField label="Date" type="date" value={form.date} onChange={(value) => update('date', value)} />
        <FormField label="Category" value={form.category} options={categories} onChange={(value) => update('category', value)} />
        <FormField label="Amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={(value) => update('amount', value)} placeholder="0.00" />
        <FormField label="Description" value={form.description} onChange={(value) => update('description', value)} placeholder="Optional" />
        <div className="form-actions"><button className="btn btn-blue" type="submit">{selectedId ? 'Save changes' : 'Add'}</button>{selectedId && <><button className="btn btn-red" type="button" onClick={remove}>Delete</button><button className="btn btn-quiet" type="button" onClick={clear}>Cancel</button></>}</div>
      </form>
    </Section>
    <Section title={`Your ${isExpense ? 'expenses' : 'income records'}`}>
      <div className="form-row" style={{ marginBottom: 12 }}>
        <FormField label="Search" value={search} onChange={setSearch} placeholder="Description, category, date…" />
        <FormField label="Filter category" value={filterCategory} options={categories} onChange={setFilterCategory} />
        <div className="form-actions">{filtering && <button className="btn btn-quiet" type="button" onClick={() => { setSearch(''); setFilterCategory(''); }}>Clear filters</button>}</div>
      </div>
      <p className="auth-subtitle" style={{ margin: '0 0 8px' }}>
        Showing {visibleRecords.length} of {records.length} · Total: <strong>{money(visibleTotal, user.currency, user.language)}</strong>
      </p>
      <DataTable headers={['ID', 'Date', 'Category', 'Amount', 'Description']}>
        {visibleRecords.length ? visibleRecords.map((record) => <tr key={record._id} className={selectedId === record._id ? 'selected' : ''} onClick={() => select(record)} tabIndex="0" onKeyDown={(event) => { if (event.key === 'Enter') select(record); }}><td>{record._id.slice(-4)}</td><td>{record.date}</td><td>{record.category}</td><td>{money(record.amount, record.currency || user.currency, user.language)}</td><td>{record.description || '—'}</td></tr>) : <EmptyRow columns={5}>{filtering ? 'No records match your search' : isExpense ? 'No expenses yet' : 'No income recorded yet'}</EmptyRow>}
      </DataTable>
    </Section>
  </>;
}

function CategoryPage({ user, data, perform, notify }) {
  const [selected, setSelected] = useState(null);
  const [name, setName] = useState('');
  async function save(event) {
    event.preventDefault();
    if (!name.trim()) return notify('Category name cannot be empty', 'error');
    await perform(() => selected ? api.updateCategory(selected._id, { name: name.trim() }) : api.addCategory(user.id, { name: name.trim() }), `Category ${selected ? 'updated' : 'added'}`);
    setSelected(null); setName('');
  }
  async function remove() {
    if (!selected) return notify('Select a category to delete', 'error');
    if (!window.confirm('Delete this category?')) return;
    await perform(() => api.deleteCategory(selected._id), 'Category deleted');
    setSelected(null); setName('');
  }
  return <>
    <PageHeading title="Categories" subtitle="Organize expenses with your own categories." />
    <Section title={selected ? 'Update category' : 'Add category'}>
      <form className="form-row" onSubmit={save}><FormField label="Category name" value={name} onChange={setName} placeholder="For example, groceries" />
        <div className="form-actions"><button className="btn btn-blue">{selected ? 'Save changes' : 'Add category'}</button>{selected && <><button className="btn btn-red" type="button" onClick={remove}>Delete</button><button className="btn btn-quiet" type="button" onClick={() => { setSelected(null); setName(''); }}>Cancel</button></>}</div>
      </form>
    </Section>
    <Section title="Your categories"><DataTable headers={['ID', 'Category name']}>
      {data.categories.length ? data.categories.map((category) => <tr key={category._id} className={selected?._id === category._id ? 'selected' : ''} onClick={() => { setSelected(category); setName(category.name); }} tabIndex="0" onKeyDown={(event) => { if (event.key === 'Enter') { setSelected(category); setName(category.name); } }}><td>{category._id.slice(-4)}</td><td>{category.name}</td></tr>) : <EmptyRow columns={2}>No categories yet</EmptyRow>}
    </DataTable></Section>
  </>;
}

function BudgetPage({ user, data, perform, notify }) {
  const [month, setMonth] = useState(currentMonth());
  const [amount, setAmount] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const spending = useMemo(() => data.expenses.reduce((totals, item) => ({ ...totals, [item.date.slice(0, 7)]: (totals[item.date.slice(0, 7)] || 0) + Number(item.amount) }), {}), [data.expenses]);
  async function save(event) {
    event.preventDefault();
    if (!month || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return notify('Enter a month and a budget amount greater than zero', 'error');
    await perform(() => api.saveBudget(user.id, { month, amount: Number(amount) }), 'Budget saved');
    setSelectedId(''); setAmount(''); setMonth(currentMonth());
  }
  async function remove() {
    if (!selectedId) return notify('Select a budget to delete', 'error');
    if (!window.confirm('Delete this budget?')) return;
    await perform(() => api.deleteBudget(selectedId), 'Budget deleted');
    setSelectedId(''); setAmount(''); setMonth(currentMonth());
  }
  return <>
    <PageHeading title="Budgets" subtitle="Set a monthly limit and keep an eye on spending." />
    <Section title="Set a monthly budget"><form className="form-row" onSubmit={save}>
      <FormField label="Month" type="month" value={month} onChange={setMonth} />
      <FormField label="Budget amount" type="number" min="0.01" step="0.01" value={amount} onChange={setAmount} placeholder="0.00" />
      <div className="form-actions"><button className="btn btn-blue">Save budget</button>{selectedId && <button className="btn btn-red" type="button" onClick={remove}>Delete</button>}</div>
    </form></Section>
    <Section title="Monthly budgets"><DataTable headers={['Month', 'Budget', 'Spent', 'Remaining']}>
      {data.budgets.length ? data.budgets.map((budget) => {
        const spent = spending[budget.month] || 0;
        return <tr key={budget._id} className={selectedId === budget._id ? 'selected' : ''} onClick={() => { setSelectedId(budget._id); setMonth(budget.month); setAmount(String(budget.amount)); }} tabIndex="0" onKeyDown={(event) => { if (event.key === 'Enter') { setSelectedId(budget._id); setMonth(budget.month); setAmount(String(budget.amount)); } }}><td>{budget.month}</td><td>{money(budget.amount, user.currency, user.language)}</td><td>{money(spent, user.currency, user.language)}</td><td className={spent > budget.amount ? 'amount-negative' : ''}>{money(Number(budget.amount) - spent, user.currency, user.language)}</td></tr>;
      }) : <EmptyRow columns={4}>No budgets yet</EmptyRow>}
    </DataTable></Section>
  </>;
}

function ReportsPage({ user, data }) {
  return <>
    <PageHeading title="Reports" subtitle="Totals by category across your records." />
    <Section title="Income and expense summary"><DataTable headers={['Type', 'Category', 'Total']}>
      {data.reports.length ? data.reports.map((report) => <tr key={`${report.type}-${report.category}`}><td><span className={`type-pill ${report.type}`}>{report.type}</span></td><td>{report.category}</td><td>{money(report.total, user.currency, user.language)}</td></tr>) : <EmptyRow columns={3}>No report data yet</EmptyRow>}
    </DataTable></Section>
  </>;
}

function ProfilePage({ user, setUser, notify, perform }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState('');
  return <>
    <PageHeading title="Profile" subtitle="Update your personal information." />
    <Section title="Your account"><form className="profile-form" onSubmit={async (event) => {
      event.preventDefault();
      if (!name.trim() || !email.trim()) return notify('Name and email are required', 'error');
      const payload = { name: name.trim(), email: email.trim() };
      if (password) payload.password = password;
      const updated = await perform(() => api.updateProfile(user.id, payload), 'Profile updated');
      if (updated) { setUser((current) => ({ ...current, ...updated })); setPassword(''); }
    }}>
      <FormField label="Full name" value={name} onChange={setName} />
      <FormField label="Username" value={user.username} onChange={() => {}} readOnly />
      <FormField label="Email" type="email" value={email} onChange={setEmail} />
      <FormField label="New password" type="password" value={password} onChange={setPassword} placeholder="Leave blank to keep current password" />
      <button className="btn btn-blue">Save profile</button>
    </form></Section>
  </>;
}

function SettingsPage({ user, setUser, perform, notify }) {
  const [settings, setSettings] = useState({ theme: user.theme || 'Light', currency: user.currency || 'BDT', notifications: user.notifications ?? true, language: user.language || 'English' });
  const update = (key, value) => setSettings((current) => ({ ...current, [key]: value }));
  return <>
    <PageHeading title="Settings" subtitle="Choose how PocketSplit looks and formats amounts." />
    <Section title="Preferences" className="settings-card"><form className="settings-form" onSubmit={async (event) => {
      event.preventDefault();
      const updated = await perform(() => api.updateProfile(user.id, settings), 'Settings saved');
      if (updated) setUser((current) => ({ ...current, ...updated }));
    }}>
      <div className="settings-row"><label htmlFor="theme-setting">Theme</label><select className="form-select" id="theme-setting" value={settings.theme} onChange={(event) => update('theme', event.target.value)}><option>Light</option><option>Dark</option></select></div>
      <div className="settings-row"><label htmlFor="currency-setting">Currency</label><select className="form-select" id="currency-setting" value={settings.currency} onChange={(event) => update('currency', event.target.value)}><option value="BDT">Bangladeshi Taka (BDT)</option><option value="USD">US Dollar (USD)</option><option value="EUR">Euro (EUR)</option><option value="GBP">British Pound (GBP)</option><option value="INR">Indian Rupee (INR)</option></select></div>
      <div className="settings-row"><label htmlFor="language-setting">Language</label><select className="form-select" id="language-setting" value={settings.language} onChange={(event) => update('language', event.target.value)}><option>English</option><option>Bangla</option><option>Spanish</option><option>French</option></select></div>
      <div className="settings-row"><label htmlFor="notification-setting">Enable notifications</label><input id="notification-setting" type="checkbox" checked={settings.notifications} onChange={(event) => update('notifications', event.target.checked)} /></div>
      <div className="currency-preview">Example: <strong>{money(1250.5, settings.currency, settings.language)}</strong></div>
      <button className="btn btn-blue">Save preferences</button>
    </form></Section>
  </>;
}

function ExpenseChart({ user, data }) {
  const month = currentMonth();
  const monthExpenses = data.expenses.filter((item) => item.date?.startsWith(month));

  const categoryTotals = monthExpenses.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + Number(item.amount);
    return acc;
  }, {});

  const sorted = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const max = sorted[0]?.[1] || 1;
  const currency = user.currency || 'BDT';
  const BAR_COLORS = ['#4169e1', '#00b894', '#dc143c', '#ff8c00', '#9b5cff', '#20d4d1', '#e84393', '#f1c40f'];

  if (sorted.length === 0) {
    return (
      <>
        <PageHeading title="Spending Chart" subtitle="Visual breakdown of this month's expenses." />
        <Section title="This month — by category">
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>
            No expenses recorded this month yet.
          </p>
        </Section>
      </>
    );
  }

  return (
    <>
      <PageHeading title="Spending Chart" subtitle={`Visual breakdown of ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}.`} />
      <Section title="Expenses by category — this month">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sorted.map(([category, total], index) => {
            const pct = Math.round((total / max) * 100);
            const color = BAR_COLORS[index % BAR_COLORS.length];
            return (
              <div key={category}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>
                  <span>{category}</span>
                  <span style={{ color }}>{money(total, currency, user.language)}</span>
                </div>
                <div style={{ background: '#e8edf5', borderRadius: 8, height: 22, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 8, transition: 'width 0.5s ease', display: 'flex', alignItems: 'center', paddingLeft: 8, color: '#fff', fontSize: 11, fontWeight: 700 }}>
                    {pct > 10 ? `${pct}%` : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>
      <Section title="Summary">
        <DataTable headers={['Category', 'Amount', '% of Total']}>
          {sorted.map(([category, total]) => {
            const grandTotal = sorted.reduce((s, [, v]) => s + v, 0);
            const share = ((total / grandTotal) * 100).toFixed(1);
            return (
              <tr key={category}>
                <td>{category}</td>
                <td>{money(total, currency, user.language)}</td>
                <td>{share}%</td>
              </tr>
            );
          })}
          <tr style={{ fontWeight: 700, background: '#f0f5fa' }}>
            <td>Total</td>
            <td>{money(sorted.reduce((s, [, v]) => s + v, 0), currency, user.language)}</td>
            <td>100%</td>
          </tr>
        </DataTable>
      </Section>
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
