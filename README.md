# PocketSplit

The application is split into two projects:

- `frontend/` contains the React interface, built with Vite.
- `backend/` contains the Express and MongoDB API.

The project supports local development and a Vercel multi-service deployment.

## Run locally

1. In `backend/`, create/edit `.env` with the following variables:

   ```
   PORT=5000
   MONGO_URI=mongodb://127.0.0.1:27017/pocketsplit
   JWT_SECRET=replace-with-a-long-random-secret
   GEMINI_API_KEY=your-google-ai-studio-key
   GEMINI_MODEL=gemini-3.5-flash
   ```

   `MONGO_URI` can point to a local MongoDB or an Atlas cluster. `JWT_SECRET` must be a long random string. Copy `backend/.env.example` to `backend/.env` and add your Gemini API key from Google AI Studio. The AI Coach is unavailable until `GEMINI_API_KEY` is configured; all other PocketSplit features continue to work. The API key is used by the backend only and must never be placed in a `VITE_` variable or frontend source.

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

## Deploy on Vercel

The root `vercel.json` defines two services in one Vercel project: the Vite frontend and the Express API. The frontend is routed at `/`; `/api` and `/api/*` are routed to the backend, preserving the API paths used by Express. The frontend uses same-origin `/api` requests in production, so leave `VITE_API_URL` unset unless you intentionally use a separate API host.

Configure these environment variables in the Vercel project for Preview and Production:

- `MONGO_URI`: the MongoDB connection string for the deployment.
- `JWT_SECRET`: a unique, long random value used to sign login tokens.
- `GEMINI_API_KEY`: the Gemini API key used by the server-side AI Coach.
- `GEMINI_MODEL`: optional model name; defaults to `gemini-3.5-flash`. The Coach only exposes Gemini 3.5 Flash, 3.5 Flash-Lite, 2.5 Flash-Lite, and 2.5 Flash models when the API key lists them for `generateContent`.

Set these values in the backend service environment for Preview and Production. Do not commit production values. Run `vercel dev --local` from the repository root to exercise the services and their routing locally.

The AI Coach opens from the icon in the Overview heading. It discovers supported free-tier Flash models for the configured API key; Auto prefers `GEMINI_MODEL` and falls back when a model is temporarily busy or unavailable. Auto is restricted to the listed Flash IDs and never selects Pro or other model families. Google's free-tier quotas and model availability depend on the API project and can change; Gemini 2.5 Flash is deprecated and Google documents a routing change effective December 1, 2026. Check the [current Gemini API pricing and model availability](https://ai.google.dev/gemini-api/docs/pricing) before relying on a specific model. The Coach can read the signed-in user's transactions, income, budgets, categories, reports, profile, and preferences. It can prepare add/update/delete changes to transactions, budgets, and categories, and updates to profile/preferences. Every change requires the user to approve its exact preview. Reports are derived and read-only; passwords, usernames, authentication secrets, and account deletion are not exposed as AI actions. Gemini may receive the chat context and relevant data to answer. Chat is held in the current browser session and is not persisted by PocketSplit.

The Coach can prepare transaction, budget, and category changes, but saving or deleting requires the signed-in user to approve the exact preview in the app. It only reads or changes records belonging to that user. It cannot access server files, source code, credentials, or other users' data.

AI endpoints require authentication and are limited to 20 requests per 15 minutes per user.

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
