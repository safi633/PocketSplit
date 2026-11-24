import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from './api';
import pocketSplitLogo from '../pocketsplit-logo.png';

const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => today().slice(0, 7);
const emptyRecord = () => ({ date: today(), category: '', amount: '', description: '' });

function displayDate(value, language = 'English') {
  const [year, month, day] = String(value || '').split('-').map(Number);
  if (!year || !month || !day) return value || '';
  const locale = language === 'Bangla' ? 'bn-BD' : 'en-GB';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(year, month - 1, day));
}

function money(value, currency = 'BDT', language = 'en') {
  const locale = language === 'Bangla' ? 'bn-BD' : ({ BDT: 'en-BD', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB', INR: 'en-IN' }[currency] || 'en-BD');
  if (value === null || value === undefined || value === '') return '';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';
  const formattedAmount = new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
  return `${currency} ${formattedAmount}`;
}

function CashValue({ amount, currency, language, className = '' }) {
  return <span className={`cash-value ${className}`}>{money(amount, currency, language)}</span>;
}

function totalsByCurrency(records, defaultCurrency) {
  return records.reduce((totals, record) => {
    const currency = record.currency || defaultCurrency;
    totals[currency] = (totals[currency] || 0) + Number(record.amount);
    return totals;
  }, {});
}

function CurrencyTotals({ totals, fallbackCurrency, language }) {
  const entries = Object.entries(totals);
  if (!entries.length) entries.push([fallbackCurrency, 0]);
  return <span className="currency-totals">{entries.map(([currency, amount]) => <CashValue key={currency} amount={amount} currency={currency} language={language} />)}</span>;
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
          <BrandLockup className="auth-logo" />
          <h1 className="auth-title" id="auth-title">{signup ? 'Create your account' : 'Welcome back'}</h1>
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
  const [chatMessages, setChatMessages] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [coachOrigin, setCoachOrigin] = useState(null);
  const coachLauncherRef = useRef(null);
  const [data, setData] = useState({ expenses: [], incomes: [], categories: [], budgets: [], reports: [] });
  const [notice, setNotice] = useState(null);
  const [aboutOpen, setAboutOpen] = useState(false);

  const notify = useCallback((message, type = 'success') => setNotice({ message, type, key: Date.now() }), []);
  const closeCoach = useCallback(() => {
    setChatOpen(false);
    window.setTimeout(() => coachLauncherRef.current?.focus(), 0);
  }, []);
  const openCoach = useCallback(() => {
    const button = coachLauncherRef.current;
    if (button) {
      const launcher = button.getBoundingClientRect();
      const mobile = window.matchMedia('(max-width: 700px)').matches;
      const width = mobile ? window.innerWidth - 20 : Math.min(440, window.innerWidth - 32);
      const height = mobile ? window.innerHeight - 20 : Math.min(720, window.innerHeight - 32);
      const left = mobile ? 10 : window.innerWidth - 24 - width;
      const top = mobile ? 10 : window.innerHeight - 24 - height;
      setCoachOrigin({ x: launcher.left + launcher.width / 2 - left, y: launcher.top + launcher.height / 2 - top });
    }
    setChatOpen(true);
  }, []);
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
    const isDark = user.theme === 'Dark';
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
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
    setChatMessages([]);
    setChatOpen(false);
    setTab('dashboard');
  }

  if (restoring) return <div className="loading-screen" role="status">Loading PocketSplit…</div>;
  if (!user) return <AuthPage onAuthenticated={setUser} />;

  const contentProps = { user, setUser, data, refresh, perform, notify, onTab: setTab };
  const screens = {
    dashboard: <Dashboard {...contentProps} onOpenCoach={openCoach} coachOpen={chatOpen} launcherRef={coachLauncherRef} />,
    expenses: <RecordPage key="expense" kind="expense" {...contentProps} />,
    income: <RecordPage key="income" kind="income" {...contentProps} />,
    categories: <CategoryPage {...contentProps} />,
    budgets: <BudgetPage {...contentProps} />,
    reports: <ReportsPage {...contentProps} />,
    profile: <ProfilePage {...contentProps} onLogout={logout} />,
    settings: <SettingsPage {...contentProps} />,
  };

  const nav = [
    ['dashboard', 'Overview', 'overview'], ['expenses', 'Expenses', 'expenses'], ['income', 'Income', 'income'],
    ['categories', 'Categories', 'categories'], ['budgets', 'Budgets', 'budgets'], ['reports', 'Reports', 'reports'],
    ['profile', 'Profile', 'profile'], ['settings', 'Settings', 'settings'],
  ];

  return (
    <div className="app-shell">
      <header className="app-header">
        <BrandLockup className="app-logo" />
        <div className="header-actions"><span className="header-user">{user.name}</span><button className="header-link" type="button" onClick={() => setAboutOpen(true)} aria-label="About"><NavIcon name="about" /></button><button className="header-link" type="button" onClick={logout} aria-label="Log out"><NavIcon name="logout" /></button></div>
      </header>
      <div className="app-body">
        <nav className="sidebar" aria-label="Main navigation">
          {nav.map(([id, label, icon]) => <button key={id} className={`nav-btn ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)} aria-label={label} title={label} aria-current={tab === id ? 'page' : undefined}><NavIcon name={icon} /><span>{label}</span></button>)}
        </nav>
        <main className="content" id="main-content">{screens[tab]}</main>
      </div>
      {chatOpen && <AIChatPage messages={chatMessages} setMessages={setChatMessages} refresh={refresh} setUser={setUser} onClose={closeCoach} origin={coachOrigin} language={user.language} />}
      {aboutOpen && <div className="modal-overlay active" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAboutOpen(false); }}>
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="about-title"><h3 id="about-title">PocketSplit</h3><p>Track spending, manage budgets, and keep shared expenses organized.</p><button className="modal-close" onClick={() => setAboutOpen(false)}>Close</button></section>
      </div>}
      {notice && <div className={`toast show ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'} key={notice.key}>{notice.message}</div>}
    </div>
  );
}

function BrandMark() {
  return <img className="brand-symbol" src={pocketSplitLogo} alt="" aria-hidden="true" />;
}

function BrandLockup({ className = '' }) {
  return <div className={`brand-lockup ${className}`}>
    <BrandMark />
    <span className="brand-wordmark"><span>Pocket</span><strong>Split</strong></span>
  </div>;
}

function NavIcon({ name }) {
  const paths = {
    overview: <><path d="M3 13a9 9 0 1 1 18 0"/><path d="m12 13 4-4"/><path d="M5 18h14"/></>,
    expenses: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/></>,
    income: <><path d="M12 19V5"/><path d="m6 11 6-6 6 6"/><path d="M5 21h14"/></>,
    categories: <><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></>,
    budgets: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h3M8 17h6"/></>,
    reports: <><path d="M4 19V5M4 19h17"/><path d="m7 15 4-4 3 2 5-6"/></>,
    profile: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    settings: <><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.28 5.28l1.41 1.41M17.31 17.31l1.41 1.41M18.72 5.28l-1.41 1.41M6.69 17.31l-1.41 1.41"/></>,
    about: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7h.01"/></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></>,
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h8"/></>,
    smile: <><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></>,
    mic: <><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></>,
  };
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function ChatText({ text }) {
  const renderInline = (line, lineIndex) => line.split(/(\*\*.+?\*\*)/g).map((part, partIndex) => (
    part.startsWith('**') && part.endsWith('**') && part.length > 3
      ? <strong key={`${lineIndex}-${partIndex}`}>{part.slice(2, -2)}</strong>
      : part
  ));
  return <p>{String(text ?? '').split('\n').map((line, index) => <React.Fragment key={index}>{index > 0 && <br />}{renderInline(line, index)}</React.Fragment>)}</p>;
}

function PageHeading({ title, subtitle, actions }) {
  return <div className="page-heading"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{actions && <div className="page-heading-actions">{actions}</div>}</div>;
}

function Section({ title, children, className = '' }) {
  return <section className={`section-card blue ${className}`}><h2 className="section-title">{title}</h2>{children}</section>;
}

function EmptyRow({ columns, children = 'No records yet' }) {
  return <tr><td className="empty-cell" colSpan={columns}>{children}</td></tr>;
}

function Dashboard({ user, data, onTab, onOpenCoach, coachOpen, launcherRef }) {
  const month = currentMonth();
  const currentExpenses = data.expenses.filter((item) => item.date?.startsWith(month));
  const currentIncomes = data.incomes.filter((item) => item.date?.startsWith(month));
  const currency = user.currency || 'BDT';
  const spent = totalsByCurrency(currentExpenses, currency);
  const received = totalsByCurrency(currentIncomes, currency);
  const balance = Object.fromEntries([...new Set([...Object.keys(spent), ...Object.keys(received)])]
    .map((code) => [code, (received[code] || 0) - (spent[code] || 0)]));
  const categorySpend = currentExpenses.reduce((totals, item) => {
    const key = `${item.currency || currency}:${item.category}`;
    totals[key] = (totals[key] || 0) + Number(item.amount);
    return totals;
  }, {});
  const topCategory = Object.entries(categorySpend).sort((a, b) => b[1] - a[1])[0]?.[0].split(':').slice(1).join(':') || '—';
  const recent = [...data.expenses.map((item) => ({ ...item, type: 'Expense' })), ...data.incomes.map((item) => ({ ...item, type: 'Income' }))]
    .sort((a, b) => `${b.date}${b.createdAt || ''}`.localeCompare(`${a.date}${a.createdAt || ''}`)).slice(0, 6);
  const monthlyBudget = data.budgets.find((budget) => budget.month === month);
  const budgetCurrency = monthlyBudget?.currency || currency;
  const budgetSpent = spent[budgetCurrency] || 0;
  const recommendations = [
    monthlyBudget
      ? budgetSpent > Number(monthlyBudget.amount)
        ? `Over budget by ${money(budgetSpent - Number(monthlyBudget.amount), budgetCurrency, user.language)}`
        : `${money(Number(monthlyBudget.amount) - budgetSpent, budgetCurrency, user.language)} left in budget`
      : 'Set a monthly budget with AI',
    Object.keys(categorySpend).length ? `Review ${topCategory} spending` : 'Ask AI for a spending tip',
    currentIncomes.length ? 'Ask AI to summarize your month' : 'Track income for a fuller picture',
  ];
  const recommendationKey = recommendations.join('|');
  const [recommendationIndex, setRecommendationIndex] = useState(0);

  useEffect(() => {
    setRecommendationIndex(0);
    const interval = window.setInterval(() => {
      setRecommendationIndex((current) => (current + 1) % recommendations.length);
    }, 10000);
    return () => window.clearInterval(interval);
  }, [recommendationKey]);

  return <>
    <PageHeading title={`Welcome back, ${user.name}`} subtitle={new Intl.DateTimeFormat(user.language === 'Bangla' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())} actions={<><span key={recommendationIndex} className="ai-coach-tip" aria-hidden="true">{recommendations[recommendationIndex]}</span><button ref={launcherRef} data-tip-cycle={recommendationIndex} className="ai-coach-launcher" type="button" onClick={onOpenCoach} aria-haspopup="dialog" aria-expanded={coachOpen} aria-label="Open AI Coach" title="Open AI Coach"><svg key={recommendationIndex} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 14.5 9.5 21.5 12 14.5 14.5 12 21.5 9.5 14.5 2.5 12 9.5 9.5Z"/><circle cx="19.5" cy="5" r="1.25"/></svg><span className="sr-only">AI Coach</span></button></>} />
    <div className="stats-grid">
      <StatCard label="Income this month" value={<CurrencyTotals totals={received} fallbackCurrency={currency} language={user.language} />} tone="green" />
      <StatCard label="Spent this month" value={<CurrencyTotals totals={spent} fallbackCurrency={currency} language={user.language} />} tone="red" />
      <StatCard label="Current balance" value={<CurrencyTotals totals={balance} fallbackCurrency={currency} language={user.language} />} tone="blue" />
      <StatCard label="Top category" value={topCategory} tone="purple" />
    </div>
    <Section title="Recent activity">
      <DataTable headers={['Date', 'Type', 'Description', 'Category', 'Amount']}>
        {recent.length ? recent.map((item) => <tr key={`${item.type}-${item._id}`}><td>{displayDate(item.date, user.language)}</td><td><span className={`type-pill ${item.type.toLowerCase()}`}>{item.type}</span></td><td>{item.description || '—'}</td><td>{item.category}</td><td className={item.type === 'Income' ? 'amount-positive' : ''}>{item.type === 'Income' ? '+' : '−'}<CashValue amount={item.amount} currency={item.currency || currency} language={user.language} /></td></tr>) : <EmptyRow columns={5}>No transactions recorded yet</EmptyRow>}
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
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

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
      <DataTable headers={['Date', 'Category', 'Amount', 'Description']}>
        {records.length ? records.map((record) => <tr key={record._id} className={selectedId === record._id ? 'selected' : ''} onClick={() => select(record)} tabIndex="0" onKeyDown={(event) => { if (event.key === 'Enter') select(record); }}><td>{displayDate(record.date, user.language)}</td><td>{record.category}</td><td><CashValue amount={record.amount} currency={record.currency || user.currency} language={user.language} /></td><td>{record.description || '—'}</td></tr>) : <EmptyRow columns={4}>{isExpense ? 'No expenses yet' : 'No income recorded yet'}</EmptyRow>}
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
    <Section title="Your categories"><DataTable headers={['Category name']}>
      {data.categories.length ? data.categories.map((category) => <tr key={category._id} className={selected?._id === category._id ? 'selected' : ''} onClick={() => { setSelected(category); setName(category.name); }} tabIndex="0" onKeyDown={(event) => { if (event.key === 'Enter') { setSelected(category); setName(category.name); } }}><td>{category.name}</td></tr>) : <EmptyRow columns={1}>No categories yet</EmptyRow>}
    </DataTable></Section>
  </>;
}

function BudgetPage({ user, data, perform, notify }) {
  const [month, setMonth] = useState(currentMonth());
  const [amount, setAmount] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const spending = useMemo(() => data.expenses.reduce((totals, item) => {
    const key = `${item.date.slice(0, 7)}:${item.currency || user.currency || 'BDT'}`;
    totals[key] = (totals[key] || 0) + Number(item.amount);
    return totals;
  }, {}), [data.expenses, user.currency]);
  async function save(event) {
    event.preventDefault();
    if (!month || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return notify('Enter a month and a budget amount greater than zero', 'error');
    const existingBudget = data.budgets.find((budget) => budget.month === month);
    await perform(() => api.saveBudget(user.id, { month, amount: Number(amount), currency: existingBudget?.currency || user.currency || 'BDT' }), 'Budget saved');
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
        const budgetCurrency = budget.currency || user.currency || 'BDT';
        const spent = spending[`${budget.month}:${budgetCurrency}`] || 0;
        return <tr key={budget._id} className={selectedId === budget._id ? 'selected' : ''} onClick={() => { setSelectedId(budget._id); setMonth(budget.month); setAmount(String(budget.amount)); }} tabIndex="0" onKeyDown={(event) => { if (event.key === 'Enter') { setSelectedId(budget._id); setMonth(budget.month); setAmount(String(budget.amount)); } }}><td>{budget.month}</td><td><CashValue amount={budget.amount} currency={budgetCurrency} language={user.language} /></td><td><CashValue amount={spent} currency={budgetCurrency} language={user.language} /></td><td className={spent > budget.amount ? 'amount-negative' : ''}><CashValue amount={Number(budget.amount) - spent} currency={budgetCurrency} language={user.language} /></td></tr>;
      }) : <EmptyRow columns={4}>No budgets yet</EmptyRow>}
    </DataTable></Section>
  </>;
}

function AIChatPage({ messages, setMessages, refresh, setUser, onClose, origin, language }) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pendingMessage, setPendingMessage] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [attachment, setAttachment] = useState(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [actionBusy, setActionBusy] = useState('');
  const isMounted = useRef(true);
  const activeRequest = useRef(null);
  const composerRef = useRef(null);
  const fileInputRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const threadRef = useRef(null);

  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [messages, pendingMessage, busy]);

  function startNewChat() {
    const actionIds = messages.map((entry) => entry.pendingAction?.id).filter(Boolean);
    setMessages([]);
    setDraft('');
    setAttachment(null);
    setEmojiPickerOpen(false);
    speechRecognitionRef.current?.stop();
    setError('');
    Promise.allSettled(actionIds.map((id) => api.cancelAiAction(id)));
  }

  useEffect(() => {
    isMounted.current = true;
    composerRef.current?.focus();
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      isMounted.current = false;
      window.removeEventListener('keydown', closeOnEscape);
      activeRequest.current?.abort();
      speechRecognitionRef.current?.stop();
    };
  }, [onClose]);

  async function selectAttachment(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (file.name.length > 120) {
      setError('That file name is too long. Rename it and try again.');
      return;
    }
    if (!['.txt', '.csv', '.md', '.json'].includes(extension)) {
      setError('Choose a text, CSV, Markdown, or JSON file.');
      return;
    }
    if (file.size > 16000) {
      setError('Files must be 16 KB or smaller.');
      return;
    }
    try {
      const text = await file.text();
      if (!text.trim()) return setError('That file is empty. Choose a file with text.');
      if (text.length > 16000) return setError('The file contains too much text. Choose a file under 16 KB.');
      setAttachment({ name: file.name, text });
      setError('');
    } catch {
      setError('Could not read that file. Try a text, CSV, Markdown, or JSON file.');
    }
  }

  function toggleVoiceInput() {
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Voice input is not supported by this browser. Try a browser with speech recognition.');
      return;
    }
    const recognition = new SpeechRecognition();
    const locale = { Bangla: 'bn-BD', Spanish: 'es-ES', French: 'fr-FR' }[language] || 'en-US';
    recognition.lang = locale;
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => { if (isMounted.current) { setListening(true); setError(''); } };
    recognition.onresult = (event) => {
      const transcript = [...event.results].map((result) => result[0]?.transcript || '').join(' ').trim();
      if (transcript) setDraft((current) => [current.trim(), transcript].filter(Boolean).join(' ').slice(0, 1500));
    };
    recognition.onerror = (event) => {
      if (!isMounted.current) return;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') setError('Allow microphone access to use voice input.');
      else if (event.error !== 'aborted' && event.error !== 'no-speech') setError('Voice input could not start. Please try again.');
    };
    recognition.onend = () => { if (isMounted.current) setListening(false); speechRecognitionRef.current = null; };
    speechRecognitionRef.current = recognition;
    try { recognition.start(); } catch { speechRecognitionRef.current = null; setListening(false); setError('Voice input could not start. Please try again.'); }
  }

  function addEmoji(emoji) {
    setDraft((current) => `${current}${emoji}`);
    setEmojiPickerOpen(false);
    composerRef.current?.focus();
  }

  async function sendMessage(value = draft) {
    const selectedAttachment = attachment;
    const message = value.trim() || (selectedAttachment ? `Please review the attached file, ${selectedAttachment.name}.` : '');
    if (!message || busy || message.length > 1500) return;

    const history = messages.slice(-12).map(({ role, text, actionResult, attachment: historyAttachment }) => ({
      role,
      text: actionResult ? `${text}\n${actionResult}` : text,
      ...(historyAttachment ? { attachment: historyAttachment } : {}),
    }));
    setDraft('');
    if (composerRef.current) composerRef.current.style.height = '38px';
    setError('');
    setBusy(true);
    setPendingMessage(message);
    setPendingAttachment(selectedAttachment);
    setEmojiPickerOpen(false);
    speechRecognitionRef.current?.stop();
    const controller = new AbortController();
    activeRequest.current = controller;
    try {
      const result = await api.chatWithCoach(message, history, 'auto', controller.signal, selectedAttachment);
      if (isMounted.current) {
        setMessages((current) => [...current, { role: 'user', text: message, ...(selectedAttachment ? { attachment: selectedAttachment } : {}) }, { role: 'assistant', text: result.reply, pendingAction: result.pendingAction || null }]);
        setAttachment(null);
      }
    } catch (requestError) {
      if (!controller.signal.aborted && isMounted.current) { setError(requestError.message); setDraft(message); }
    } finally {
      if (isMounted.current) {
        setPendingMessage('');
        setPendingAttachment(null);
        setBusy(false);
      }
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  }

  async function resolveAction(actionId, approve) {
    setActionBusy(actionId);
    setError('');
    try {
      const result = approve ? await api.confirmAiAction(actionId) : await api.cancelAiAction(actionId);
      if (isMounted.current) setMessages((current) => current.map((entry) => entry.pendingAction?.id === actionId
        ? { ...entry, pendingAction: null, actionResult: result.reply || 'Canceled; no changes were made.' }
        : entry));
      if (approve) {
        try { await refresh(); } catch (refreshError) { if (isMounted.current) setError(`Change saved, but the latest records could not be refreshed: ${refreshError.message}`); }
        try {
          const { user: updatedUser } = await api.me();
          if (isMounted.current) setUser(updatedUser);
        } catch (refreshError) { if (isMounted.current) setError(`Change saved, but profile data could not be refreshed: ${refreshError.message}`); }
      }
    } catch (requestError) {
      if (isMounted.current) setError(requestError.message);
    } finally {
      if (isMounted.current) setActionBusy('');
    }
  }

  return <aside className="ai-coach-window" style={origin ? { '--coach-origin-x': `${origin.x}px`, '--coach-origin-y': `${origin.y}px` } : undefined} role="dialog" aria-modal="false" aria-label="PocketSplit AI Coach">
    <section className="ai-coach-card" aria-label="PocketSplit AI Coach chat">
      <div className="ai-coach-heading">
        <div className="coach-brand"><img className="coach-title-logo" src={pocketSplitLogo} alt="" aria-hidden="true" /><div><h2>AI Coach</h2><p>Ask about any part of PocketSplit.</p></div></div>
        <div className="coach-window-actions">
          {messages.length > 0 && <button className="btn btn-quiet" type="button" disabled={busy} onClick={startNewChat}>New chat</button>}
          <button className="coach-close" type="button" onClick={onClose} aria-label="Close AI Coach" title="Close">×</button>
        </div>
      </div>
      <div ref={threadRef} className="chat-thread" role="log" aria-label="Chat messages" aria-live="polite" aria-relevant="additions">
        {messages.length === 0 && <>
          <p className="chat-empty">Ask a question or choose a suggestion to start.</p>
          <div className="ai-suggestions" aria-label="Suggested questions">
            <button type="button" onClick={() => sendMessage('How much did I spend this month?')}>How much did I spend this month?</button>
            <button type="button" onClick={() => sendMessage('Which categories cost me the most?')}>Which categories cost me the most?</button>
            <button type="button" onClick={() => sendMessage('Am I on track with my budget?')}>Am I on track with my budget?</button>
          </div>
        </>}
        {messages.map((entry, index) => <div key={`${index}-${entry.role}`} className={`chat-message-group ${entry.role}`}>
          <span className="chat-message-role">{entry.role === 'assistant' ? 'AI Coach' : 'You'}</span>
          <article className="chat-message">
            {entry.attachment && <div className="chat-file-chip"><NavIcon name="file" /><span>{entry.attachment.name}</span></div>}
          <ChatText text={entry.text} />
          {entry.pendingAction && <div className="chat-action-preview">
            <strong>Review proposed change</strong>
            <dl>{Object.entries(entry.pendingAction.preview).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value ?? '')}</dd></div>)}</dl>
            <div className="chat-action-buttons">
              <button className="btn btn-blue" type="button" disabled={Boolean(actionBusy)} onClick={() => resolveAction(entry.pendingAction.id, true)}>{actionBusy === entry.pendingAction.id ? 'Saving…' : 'Approve and save'}</button>
              <button className="btn btn-quiet" type="button" disabled={Boolean(actionBusy)} onClick={() => resolveAction(entry.pendingAction.id, false)}>Cancel</button>
            </div>
          </div>}
          {entry.actionResult && <p className="chat-action-result">{entry.actionResult}</p>}
          </article>
        </div>)}
        {pendingMessage && <div className="chat-message-group user"><span className="chat-message-role">You</span><article className="chat-message">{pendingAttachment && <div className="chat-file-chip"><NavIcon name="file" /><span>{pendingAttachment.name}</span></div>}<ChatText text={pendingMessage} /></article></div>}
        {busy && <p className="chat-status" role="status">AI Coach is thinking…</p>}
      </div>
      {error && <p className="chat-error" role="alert">{error}</p>}
      {attachment && <div className="chat-attachment-preview"><NavIcon name="file" /><span>{attachment.name}</span><button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment" title="Remove attachment">×</button></div>}
      <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); sendMessage(); }}>
        <div className="chat-composer-leading">
          <input ref={fileInputRef} className="sr-only" type="file" accept=".txt,.csv,.md,.json,text/plain,text/csv,application/json" onChange={selectAttachment} tabIndex={-1} aria-hidden="true" />
          <button className="chat-tool-button" type="button" onClick={() => fileInputRef.current?.click()} disabled={busy} aria-label="Attach a text file" title="Attach a text file"><NavIcon name="file" /></button>
        </div>
        <label className="sr-only" htmlFor="ai-coach-message">Your question</label>
        <textarea ref={composerRef} id="ai-coach-message" value={draft} onChange={(event) => {
          setDraft(event.target.value);
          event.currentTarget.style.height = '38px';
          event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 112)}px`;
        }} maxLength={1500} rows={1} placeholder="Message AI Coach…" disabled={busy} />
        <div className="chat-composer-trailing">
          <div className="chat-emoji-wrap">
            <button className="chat-tool-button" type="button" onClick={() => setEmojiPickerOpen((open) => !open)} disabled={busy} aria-label="Choose emoji" title="Choose emoji" aria-expanded={emojiPickerOpen}><NavIcon name="smile" /></button>
            {emojiPickerOpen && <div className="chat-emoji-picker" role="group" aria-label="Choose an emoji">{['😀', '😃', '🙂', '😅', '😂', '🙌', '👍', '❤️', '💸', '📊', '🎯', '🎉', '🤔', '😢', '✨'].map((emoji) => <button key={emoji} type="button" onClick={() => addEmoji(emoji)} aria-label={`Insert ${emoji}`}>{emoji}</button>)}</div>}
          </div>
          <button className={`chat-tool-button chat-voice-button ${listening ? 'is-listening' : ''}`} type="button" onClick={toggleVoiceInput} disabled={busy} aria-label={listening ? 'Stop voice input' : 'Dictate a message'} title={listening ? 'Stop voice input' : 'Dictate a message'} aria-pressed={listening}><NavIcon name="mic" /></button>
          <button className="btn btn-blue" type="submit" disabled={busy || (!draft.trim() && !attachment)}>Send</button>
        </div>
      </form>
    </section>
  </aside>;
}

function ReportsPage({ user, data }) {
  return <>
    <PageHeading title="Reports" subtitle="Totals by category across your records." />
    <Section title="Income and expense summary"><DataTable headers={['Type', 'Category', 'Total']}>
      {data.reports.length ? data.reports.map((report) => <tr key={`${report.type}-${report.currency}-${report.category}`}><td><span className={`type-pill ${report.type}`}>{report.type}</span></td><td>{report.category}</td><td><CashValue amount={report.total} currency={report.currency || user.currency} language={user.language} /></td></tr>) : <EmptyRow columns={3}>No report data yet</EmptyRow>}
    </DataTable></Section>
  </>;
}

function ProfilePage({ user, setUser, notify, perform, onLogout }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState('');
  const [editing, setEditing] = useState(false);
  const initials = String(user.name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
  return <>
    <PageHeading title="Profile" subtitle="Update your personal information." />
    <div className="profile-page">
      <section className="profile-identity-card" aria-label="Account identity">
        <div className="profile-avatar" aria-hidden="true">{initials}</div>
        <div className="profile-identity-main"><span className="profile-kicker">PocketSplit account</span><h2>{user.name}</h2><p>{user.email}</p></div>
        <div className="profile-username"><span>Username</span><strong>@{user.username}</strong></div>
      </section>
      <section className="section-card profile-details">
        <div className="profile-details-heading"><h2 className="section-title">Personal information</h2>{!editing && <button className="profile-edit-button" type="button" onClick={() => setEditing(true)}><NavIcon name="edit" />Edit profile</button>}</div>
        {editing ? <>
          <p className="profile-help">Update your account details below. Your username cannot be changed.</p>
          <form className="profile-form" onSubmit={async (event) => {
            event.preventDefault();
            if (!name.trim() || !email.trim()) return notify('Name and email are required', 'error');
            const payload = { name: name.trim(), email: email.trim() };
            if (password) payload.password = password;
            const updated = await perform(() => api.updateProfile(user.id, payload), 'Profile updated');
            if (updated) { setUser((current) => ({ ...current, ...updated })); setPassword(''); setEditing(false); }
          }}>
            <FormField label="Full name" value={name} onChange={setName} />
            <FormField label="Email address" type="email" value={email} onChange={setEmail} />
            <FormField label="New password" type="password" value={password} onChange={setPassword} placeholder="Leave blank to keep your current password" />
            <div className="profile-form-actions"><button className="btn btn-blue" type="submit">Save changes</button><button className="btn btn-quiet" type="button" onClick={() => { setName(user.name); setEmail(user.email); setPassword(''); setEditing(false); }}>Cancel</button></div>
          </form>
        </> : <>
          <p className="profile-help">Your profile details are shown below. Select Edit profile to make changes.</p>
          <dl className="profile-info-list"><div><dt>Full name</dt><dd>{user.name}</dd></div><div><dt>Email address</dt><dd>{user.email}</dd></div><div><dt>Username</dt><dd>@{user.username}</dd></div></dl>
        </>}
        <div className="profile-account-actions"><button className="btn btn-red profile-logout-button" type="button" onClick={onLogout}><NavIcon name="logout" />Log out</button></div>
      </section>
    </div>
  </>;
}

function SettingsPage({ user, setUser, perform, notify }) {
  const [settings, setSettings] = useState({ theme: user.theme || 'Light', currency: user.currency || 'BDT', notifications: user.notifications ?? true, language: user.language || 'English' });
  const [themeBusy, setThemeBusy] = useState(false);
  const update = (key, value) => setSettings((current) => ({ ...current, [key]: value }));
  async function saveTheme(checked) {
    if (themeBusy) return;
    const theme = checked ? 'Dark' : 'Light';
    setThemeBusy(true);
    try {
      const updated = await perform(() => api.updateProfile(user.id, { theme }), 'Theme updated');
      if (updated) {
        setUser((current) => ({ ...current, ...updated }));
        update('theme', theme);
      }
    } finally {
      setThemeBusy(false);
    }
  }
  return <>
    <PageHeading title="Settings" subtitle="Choose how PocketSplit looks and formats amounts." />
    <Section title="Preferences" className="settings-card"><p className="settings-intro">Personalize the app and choose how your amounts are displayed.</p><form className="settings-form" onSubmit={async (event) => {
      event.preventDefault();
      const updated = await perform(() => api.updateProfile(user.id, settings), 'Settings saved');
      if (updated) setUser((current) => ({ ...current, ...updated }));
    }}>
      <SettingToggle id="theme-setting" label="Theme" description="Choose the app appearance. Changes save immediately." checked={settings.theme === 'Dark'} onChange={saveTheme} disabled={themeBusy} onLabel="Dark" offLabel="Light" />
      <div className="settings-row"><div className="settings-label-group"><label htmlFor="currency-setting">Currency</label><span>Used for new entries and totals.</span></div><select className="form-select" id="currency-setting" value={settings.currency} onChange={(event) => update('currency', event.target.value)}><option value="BDT">Bangladeshi Taka (BDT)</option><option value="USD">US Dollar (USD)</option><option value="EUR">Euro (EUR)</option><option value="GBP">British Pound (GBP)</option><option value="INR">Indian Rupee (INR)</option></select></div>
      <div className="settings-row"><div className="settings-label-group"><label htmlFor="language-setting">Language</label><span>Choose the language used in the app.</span></div><select className="form-select" id="language-setting" value={settings.language} onChange={(event) => update('language', event.target.value)}><option>English</option><option>Bangla</option><option>Spanish</option><option>French</option></select></div>
      <SettingToggle id="notification-setting" label="Notifications" description="Receive helpful account updates." checked={settings.notifications} onChange={(checked) => update('notifications', checked)} onLabel="On" offLabel="Off" />
      <div className="currency-preview">Example: <strong><CashValue amount={1250.5} currency={settings.currency} language={settings.language} /></strong></div>
      <button className="btn btn-blue">Save preferences</button>
    </form></Section>
  </>;
}

function SettingToggle({ id, label, description, checked, onChange, disabled = false, onLabel, offLabel }) {
  const labelId = `${id}-label`;
  return <div className="settings-row">
    <div className="settings-label-group"><label id={labelId}>{label}</label><span>{description}</span></div>
    <button className={`settings-toggle ${checked ? 'is-on' : ''}`} type="button" role="switch" aria-labelledby={labelId} aria-checked={checked} aria-busy={disabled} disabled={disabled} onClick={() => onChange(!checked)}>
      <span className="settings-toggle-track" aria-hidden="true"><span /></span><span className="settings-toggle-state">{checked ? onLabel : offLabel}</span>
    </button>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
