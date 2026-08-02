# Expense Tracker

A Node.js, Express, MongoDB expense tracker with separate income records, budgets, categories, and reporting.

## Run locally

1. Copy `.env.example` to `.env` and set a strong `JWT_SECRET`.
2. Start MongoDB locally, or set `MONGO_URI` to your MongoDB connection string.
3. Install and run the app:

   ```sh
   npm install
   npm run dev
   ```

Open `http://localhost:5000`.

## Quality checks

```sh
npm test        # unit / white-box and API / black-box tests
npm run check   # tests plus a production dependency audit
```

The server validates incoming data, limits API requests, sends security headers, uses per-user database indexes, and does not expose project files through the static-file server.
