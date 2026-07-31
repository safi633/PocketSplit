const express = require('express');
const mongoose = require('mongoose');
const dns = require('dns');
const { promisify } = require('util');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ quiet: true });

const authRoutes = require('./routes/auth');
const expenseRoutes = require('./routes/expenses');
const incomeRoutes = require('./routes/incomes');
const transactionRoutes = require('./routes/transactions');
const categoryRoutes = require('./routes/categories');
const budgetRoutes = require('./routes/budgets');
const reportRoutes = require('./routes/reports');
const profileRoutes = require('./routes/profile');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 5000;
const mongoDbName = 'expense-tracker';
const mongoUri = withDatabaseName(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/expense-tracker');

function withDatabaseName(uri) {
  const parsedUri = new URL(uri);
  if (!parsedUri.pathname || parsedUri.pathname === '/') {
    parsedUri.pathname = `/${mongoDbName}`;
  }
  return parsedUri.toString();
}

mongoose.set('bufferCommands', false);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/incomes', incomeRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/profile', profileRoutes);

app.get('/api', (req, res) => {
  res.json({
    message: 'Expense Tracker API Running',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    databaseName: mongoose.connection.readyState === 1 ? mongoose.connection.name : null,
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const connectWithDirectAtlasHosts = async () => {
  const srvUrl = new URL(mongoUri);
  const resolver = new dns.Resolver();
  resolver.setServers(['8.8.8.8', '1.1.1.1']);
  const resolveSrv = promisify(resolver.resolveSrv.bind(resolver));
  const resolveTxt = promisify(resolver.resolveTxt.bind(resolver));

  const records = await resolveSrv(`_mongodb._tcp.${srvUrl.hostname}`);
  const txtRecords = await resolveTxt(srvUrl.hostname).catch(() => []);
  const txtParams = new URLSearchParams(txtRecords.map(parts => parts.join('')).join('&'));
  const params = new URLSearchParams(srvUrl.search);

  for (const [key, value] of txtParams) {
    if (!params.has(key)) params.set(key, value);
  }
  if (!params.has('tls')) params.set('tls', 'true');

  const hosts = records.map(record => `${record.name}:${record.port}`).join(',');
  const directUri = `mongodb://${srvUrl.username}:${srvUrl.password}@${hosts}${srvUrl.pathname}?${params.toString()}`;

  console.log('Trying MongoDB direct host connection after resolving SRV records');
  await mongoose.connect(directUri, {
    dbName: mongoDbName,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });
    console.log(`MongoDB connected successfully via direct host URI (database: ${mongoose.connection.name})`);
};

const connectToDatabase = async () => {
  try {
    await mongoose.connect(mongoUri, {
      dbName: mongoDbName,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    console.log(`MongoDB connected successfully (database: ${mongoose.connection.name})`);
    return;
  } catch (err) {
    console.log(`MongoDB connection failed: ${err.message}`);
  }

  // Fallback to direct host connection when the local DNS server rejects SRV lookups.
  if (mongoUri.includes('mongodb+srv')) {
    try {
      await connectWithDirectAtlasHosts();
      return;
    } catch (err) {
      console.log(`MongoDB direct host connection failed: ${err.message}`);
    }
  }

  console.log('The server will keep running, but database features will be unavailable until MongoDB is reachable.');
};

const removeLegacyEmailUniqueIndex = async () => {
  if (mongoose.connection.readyState !== 1) return;

  const indexes = await User.collection.indexes();
  const emailIndex = indexes.find(index => index.name === 'email_1' && index.unique);
  if (emailIndex) {
    await User.collection.dropIndex(emailIndex.name);
    console.log('Removed legacy unique email index');
  }
};

const startServer = async () => {
  await connectToDatabase();
  try {
    await removeLegacyEmailUniqueIndex();
  } catch (err) {
    console.log(`Could not remove legacy email index: ${err.message}`);
  }
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

startServer();
