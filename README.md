# Expense Tracker

The application is split into two projects:

- `frontend/` contains the static HTML, CSS, and browser JavaScript.
- `backend/` contains the Express and MongoDB API.

This is a localhost-only project.

## Run locally

1. In `backend/`, create/edit `.env` with the following variables:

   ```
   PORT=5000
   MONGO_URI=mongodb://127.0.0.1:27017/expense-tracker
   JWT_SECRET=replace-with-a-long-random-secret
   ```

   `MONGO_URI` can point to a local MongoDB or an Atlas cluster. `JWT_SECRET` must be a long random string.

2. Install and start the API:

   ```sh
   cd backend
   npm install
   npm run dev
   ```

3. Serve `frontend/` with any static web server. For example:

   ```sh
   npx serve frontend
   ```

`frontend/js/config.js` automatically uses `http://localhost:5000/api` on localhost.

## Quality checks

```sh
cd backend
npm test
npm run check
```

## Migrating legacy expense records

If you previously stored expenses in a combined `transactions` collection, run the one-time migration to move them into the `expenses` collection:

```sh
cd backend
npm run migrate:expenses
```
