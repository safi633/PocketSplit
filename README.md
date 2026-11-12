# PocketSplit

The application is split into two projects:

- `frontend/` contains the React interface, built with Vite.
- `backend/` contains the Express and MongoDB API.

This is a localhost-only project.

## Run locally

1. In `backend/`, create/edit `.env` with the following variables:

   ```
   PORT=5000
   MONGO_URI=mongodb://127.0.0.1:27017/pocketsplit
   JWT_SECRET=replace-with-a-long-random-secret
   ```

   `MONGO_URI` can point to a local MongoDB or an Atlas cluster. `JWT_SECRET` must be a long random string.

2. Install dependencies in the project root and backend, then start both services from the project root:

   ```sh
   npm install
   npm --prefix backend install
   npm run dev
   ```

   Vite serves the frontend at `http://localhost:5173`, and the API runs on port `5000`.

For a production frontend build:

   ```sh
   npm run build:frontend
   npm run start:frontend
   ```

The static frontend can also be served separately after building it. The API can be started with:

   ```sh
   npm --prefix backend run dev
   ```

The React app uses `http://localhost:5000/api` for local API requests. Set `VITE_API_URL` to override the API base URL.

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
