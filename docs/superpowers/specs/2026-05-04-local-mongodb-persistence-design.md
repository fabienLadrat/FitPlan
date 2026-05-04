# Local MongoDB Persistence Design

## Goal

FitPlan should save the user's planning data in a local MongoDB database and reload it whenever the application starts. The app should remain usable during local development even if the API or MongoDB is temporarily unavailable.

## Current State

The app is a Vite React SPA. `src/fitplan.tsx` currently stores data through `appStorage`, which falls back to browser `localStorage`. The persisted state is split across four keys:

- `fitplan:sessions`
- `fitplan:equipment`
- `fitplan:customEquipment`
- `fitplan:cycleStart`

There is no backend in the repository yet. The frontend must not connect directly to MongoDB because that would expose database connection details in browser code.

## Recommended Architecture

Add a backend in `server/` using Express and the official MongoDB Node driver.

The server will connect to a local MongoDB instance using `mongodb://127.0.0.1:27017` by default. Configuration will come from environment variables so the connection string and port can change without editing code.

The React app will call the backend API. The backend will be the only code that talks to MongoDB.

## Data Model

Use one MongoDB database named `fitplan` and one collection named `app_state`.

For this personal single-user app, store one document with a stable id:

```json
{
  "_id": "default",
  "sessions": {},
  "equipment": [],
  "customEquipment": [],
  "cycleStart": null,
  "updatedAt": "ISO date"
}
```

This mirrors the current frontend state and avoids premature modeling of individual sessions. It also keeps migration from `localStorage` straightforward.

## API

Add these endpoints:

- `GET /api/fitplan`
  - Returns the saved state.
  - If no document exists yet, returns default empty state.

- `PUT /api/fitplan`
  - Accepts the full app state.
  - Upserts the single MongoDB document.
  - Returns the saved state.

- `GET /api/health`
  - Returns basic API and MongoDB availability status for local debugging.

## Frontend Persistence

Replace the current key-by-key persistence with an app-state persistence adapter:

- On startup, try `GET /api/fitplan`.
- If the request succeeds, hydrate React state from MongoDB.
- If the request fails, fall back to the existing browser storage behavior so the app still opens.
- When state changes after initial load, save the full state to `PUT /api/fitplan`.
- Also update local fallback storage after successful state changes, so the fallback remains useful.

The first implementation can save directly on state changes. Debouncing can be added later if saves become noisy.

## Local Development

Add scripts so development remains simple:

- one script for the Vite frontend
- one script for the Express server
- one script to run both together

Use a Vite dev proxy so frontend code can call `/api/fitplan` without hard-coding hostnames.

Expected local services:

- Vite frontend: `http://localhost:5173`
- API server: `http://localhost:3001`
- MongoDB: `mongodb://127.0.0.1:27017`

## Error Handling

The API should return JSON error responses with useful status codes.

The frontend should not block the UI if MongoDB is unavailable. It should log or silently fall back to local storage for now, matching the current low-friction app behavior.

## Testing And Verification

Verification should include:

- TypeScript build for the React app.
- ESLint.
- API health endpoint with MongoDB running.
- Manual save/reload flow:
  1. Start MongoDB.
  2. Start server and frontend.
  3. Change equipment or add a session.
  4. Refresh the browser.
  5. Confirm the data is restored from MongoDB.

## Out Of Scope

This design does not add authentication, multi-user accounts, cloud MongoDB Atlas, deployment, or per-session MongoDB documents. Those can be introduced later if the app grows beyond personal local use.
